'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface Options {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (err: string) => void;
}

// 16kHz mono — Clova 권장 최소 사양
const SAMPLE_RATE = 16000;
// 시간 도메인 RMS 기준 묵음 임계값 (0~127 스케일)
const SILENCE_THRESHOLD = 8;
// 묵음 N ms 지속 시 청크 전송
const SILENCE_MS = 1500;
// 이보다 짧으면 노이즈로 판단해 버림
const MIN_SPEECH_MS = 400;

function encodeWAV(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const dataLen = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const w = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i));
  };

  w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true);
  w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true);   // fmt chunk size
  v.setUint16(20, 1, true);    // PCM
  v.setUint16(22, 1, true);    // mono
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true); // byte rate
  v.setUint16(32, 2, true);    // block align
  v.setUint16(34, 16, true);   // 16-bit
  w(36, 'data'); v.setUint32(40, dataLen, true);

  let o = 44;
  for (let i = 0; i < samples.length; i++) {
    v.setInt16(o, samples[i], true);
    o += 2;
  }
  return buf;
}

export function useVoiceRecognition({ onResult, onInterim, onError }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(
    () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  );

  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const audioCtxRef  = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef  = useRef<AnalyserNode | null>(null);
  const streamRef    = useRef<MediaStream | null>(null);

  const pcmChunksRef    = useRef<Int16Array[]>([]);
  const totalSamplesRef = useRef(0);
  const isListeningRef  = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isSendingRef    = useRef(false);
  const lastInterimRef  = useRef('');

  // setState를 오디오 콜백에서 매 프레임 호출하지 않도록 중복 제거
  const setInterim = useCallback((text: string) => {
    if (text === lastInterimRef.current) return;
    lastInterimRef.current = text;
    onInterimRef.current?.(text);
  }, []);

  const flush = useCallback(async () => {
    if (isSendingRef.current) return;
    const chunks = pcmChunksRef.current.splice(0); // 원자적으로 비우기
    const total = totalSamplesRef.current;
    totalSamplesRef.current = 0;

    if (total < SAMPLE_RATE * (MIN_SPEECH_MS / 1000)) return; // 너무 짧음 → 노이즈

    // 청크 합치기
    const combined = new Int16Array(total);
    let off = 0;
    for (const c of chunks) { combined.set(c, off); off += c.length; }

    isSendingRef.current = true;
    setInterim('인식 중...');
    try {
      const res = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: encodeWAV(combined, SAMPLE_RATE),
      });

      if (res.ok) {
        const { text } = await res.json() as { text: string };
        if (text?.trim()) onResultRef.current(text.trim());
      } else if (res.status === 500) {
        const { error } = await res.json() as { error: string };
        if (error === 'STT not configured') {
          onErrorRef.current?.('CLOVA_CLIENT_ID / CLOVA_CLIENT_SECRET 환경변수를 설정해 주세요.');
        }
      }
    } catch { /* 네트워크 순단 — 녹음 계속 */ }
    finally {
      isSendingRef.current = false;
      setInterim('');
    }
  }, [setInterim]);

  const scheduleFlush = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => {
      silenceTimerRef.current = null;
      flush();
    }, SILENCE_MS);
  }, [flush]);

  const teardown = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    try { processorRef.current?.disconnect(); } catch { /* ignore */ }
    try { analyserRef.current?.disconnect(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    processorRef.current = null;
    analyserRef.current  = null;
    streamRef.current    = null;
    audioCtxRef.current  = null;
  }, []);

  const stop = useCallback(() => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    setIsListening(false);
    setInterim('');
    flush(); // 남은 버퍼 전송 (비동기, fire-and-forget)
    teardown();
  }, [flush, teardown, setInterim]);

  const start = useCallback(async () => {
    if (isListeningRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;

      // 마이크 스트림 끊기면 자동 정지
      stream.getAudioTracks()[0].addEventListener('ended', () => {
        if (isListeningRef.current) {
          stop();
          onErrorRef.current?.('마이크 연결이 끊겼습니다. 다시 시작해 주세요.');
        }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      const ctx = new Ctx({ sampleRate: SAMPLE_RATE }) as AudioContext;
      await ctx.resume(); // iOS 필수
      audioCtxRef.current = ctx;

      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      const tdData = new Uint8Array(analyser.fftSize); // 시간 도메인 버퍼

      processor.onaudioprocess = (e) => {
        if (!isListeningRef.current) return;
        const input = e.inputBuffer.getChannelData(0);

        // Float32 → Int16 변환
        const pcm = new Int16Array(input.length);
        for (let i = 0; i < input.length; i++) {
          pcm[i] = Math.max(-32768, Math.min(32767, input[i] * 32768));
        }
        pcmChunksRef.current.push(pcm);
        totalSamplesRef.current += pcm.length;

        // 시간 도메인 RMS로 묵음 감지 (주파수 도메인보다 정확)
        analyser.getByteTimeDomainData(tdData);
        let rmsSum = 0;
        for (let i = 0; i < tdData.length; i++) {
          const v = tdData[i] - 128;
          rmsSum += v * v;
        }
        const rms = Math.sqrt(rmsSum / tdData.length);

        if (rms > SILENCE_THRESHOLD) {
          // 발화 감지 — 묵음 타이머 리셋
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
          setInterim('🎙 말하는 중...');
        } else if (totalSamplesRef.current > SAMPLE_RATE * (MIN_SPEECH_MS / 1000)) {
          // 묵음 + 충분한 데이터 → 전송 예약
          scheduleFlush();
        }
      };

      // source → analyser → processor → silence(gain=0) → destination
      const src = ctx.createMediaStreamSource(stream);
      const silence = ctx.createGain();
      silence.gain.value = 0; // 스피커 피드백 방지

      src.connect(analyser);
      analyser.connect(processor);
      processor.connect(silence);
      silence.connect(ctx.destination);

      pcmChunksRef.current = [];
      totalSamplesRef.current = 0;
      isListeningRef.current = true;
      setIsListening(true);
    } catch (err) {
      const isPermission =
        err instanceof Error &&
        (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      onErrorRef.current?.(
        isPermission ? '마이크 권한을 허용해 주세요.' : '마이크를 시작할 수 없습니다.',
      );
    }
  }, [scheduleFlush, setInterim, stop]);

  const toggle = useCallback(() => {
    isListeningRef.current ? stop() : start();
  }, [start, stop]);

  useEffect(() => {
    return () => {
      isListeningRef.current = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      teardown();
    };
  }, [teardown]);

  return { isListening, isSupported, toggle, stop };
}
