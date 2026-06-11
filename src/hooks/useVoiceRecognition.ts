'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface Options {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (err: string) => void;
}

// ── Web Speech API 구현 ────────────────────────────────────────────────────────

const FLUSH_DELAY = 250;
const DUPLICATE_GUARD_MS = 2500; // 같은 문장이 재시작 직후 반복되는 버그 방어

function checkWebSpeechSupport() {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

function useWebSpeechVoice({ onResult, onInterim, onError }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(checkWebSpeechSupport);

  const onResultRef  = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onErrorRef   = useRef(onError);
  useEffect(() => { onResultRef.current  = onResult; },  [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onErrorRef.current   = onError; },   [onError]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef            = useRef<any>(null);
  const userStoppedRef    = useRef(false);
  const isListeningRef    = useRef(false);
  const sessionIdRef      = useRef(0);
  const nextFinalIndexRef = useRef(0);
  // 최근 처리된 isFinal 텍스트를 시간과 함께 기록 (단어 하나만이 아닌 전체 목록)
  const recentFinalsRef   = useRef<Map<string, number>>(new Map());
  const bufferRef         = useRef('');
  const flushTimerRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBuffer = useCallback(() => {
    if (flushTimerRef.current) { clearTimeout(flushTimerRef.current); flushTimerRef.current = null; }
    const text = bufferRef.current.trim();
    if (text) { bufferRef.current = ''; onResultRef.current(text); }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const text = bufferRef.current.trim();
      if (text) { bufferRef.current = ''; onResultRef.current(text); }
    }, FLUSH_DELAY);
  }, []);

  const createAndStart = useCallback(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRec) return;

    if (recRef.current) { try { recRef.current.abort(); } catch { /* ignore */ } recRef.current = null; }

    const mySession = ++sessionIdRef.current;
    nextFinalIndexRef.current = 0;

    const rec = new SpeechRec();
    rec.lang = 'ko-KR';
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recRef.current = rec;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      if (mySession !== sessionIdRef.current) return;
      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;
        const confidence = result[0].confidence;
        if (result.isFinal) {
          if (i >= nextFinalIndexRef.current) {
            nextFinalIndexRef.current = i + 1;
            void confidence; // confidence 필터 제거 — 저신뢰도 결과도 모두 수용
            const nowMs = Date.now();
            // 만료된 항목 정리
            recentFinalsRef.current.forEach((t, k) => {
              if (nowMs - t > DUPLICATE_GUARD_MS) recentFinalsRef.current.delete(k);
            });
            if (!recentFinalsRef.current.has(transcript)) {
              recentFinalsRef.current.set(transcript, nowMs);
              bufferRef.current = bufferRef.current ? bufferRef.current + ' ' + transcript : transcript;
              scheduleFlush();
            }
            onInterimRef.current?.('');
          }
        } else {
          interimText += transcript;
        }
      }
      if (interimText) onInterimRef.current?.(interimText);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (mySession !== sessionIdRef.current) return;
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      const msg =
        e.error === 'not-allowed' ? '마이크 권한을 허용해 주세요.' :
        e.error === 'network'     ? '네트워크 오류가 발생했습니다.' : e.error;
      if (e.error === 'not-allowed') {
        userStoppedRef.current = true;
        isListeningRef.current = false;
        setIsListening(false);
      }
      onErrorRef.current?.(msg);
    };

    rec.onend = () => {
      if (mySession !== sessionIdRef.current) return;
      recRef.current = null;
      onInterimRef.current?.('');
      if (!userStoppedRef.current && isListeningRef.current) {
        flushBuffer(); // 세션 종료 시점에 즉시 확정 후 재시작
        setTimeout(createAndStart, 50);
      } else {
        flushBuffer();
        isListeningRef.current = false;
        setIsListening(false);
      }
    };

    try { rec.start(); } catch {
      recRef.current = null;
      isListeningRef.current = false;
      setIsListening(false);
      onErrorRef.current?.('음성 인식을 시작할 수 없습니다.');
    }
  }, [scheduleFlush, flushBuffer]);

  const start = useCallback(() => {
    if (isListeningRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    if (!(w.SpeechRecognition ?? w.webkitSpeechRecognition)) {
      onErrorRef.current?.('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용해 주세요.');
      return;
    }
    userStoppedRef.current = false;
    isListeningRef.current = true;
    bufferRef.current = '';
    recentFinalsRef.current.clear();
    setIsListening(true);
    createAndStart();
  }, [createAndStart]);

  const stop = useCallback(() => {
    if (!isListeningRef.current) return;
    userStoppedRef.current = true;
    isListeningRef.current = false;
    setIsListening(false);
    onInterimRef.current?.('');
    flushBuffer();
    try { recRef.current?.stop(); } catch { /* ignore */ }
    recRef.current = null;
  }, [flushBuffer]);

  const toggle = useCallback(() => { isListeningRef.current ? stop() : start(); }, [start, stop]);

  useEffect(() => {
    return () => {
      userStoppedRef.current = true;
      isListeningRef.current = false;
      sessionIdRef.current++;
      flushBuffer();
      try { recRef.current?.abort(); } catch { /* ignore */ }
      recRef.current = null;
    };
  }, [flushBuffer]);

  return { isListening, isSupported, toggle, stop };
}

// ── Clova Speech 구현 ─────────────────────────────────────────────────────────

const SAMPLE_RATE        = 16000;
const CHUNK_INTERVAL_MS  = 5000;
const SILENCE_THRESHOLD  = 8;
const SILENCE_MS         = 800;
const MIN_SPEECH_MS      = 500;

// 디바이스 실제 샘플레이트 → 16000Hz 다운샘플 (선형 보간)
function resampleTo16k(input: Float32Array, fromRate: number): Int16Array {
  if (fromRate === SAMPLE_RATE) {
    const out = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(input[i] * 32768)));
    return out;
  }
  const ratio = fromRate / SAMPLE_RATE;
  const len = Math.floor(input.length / ratio);
  const out = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    const src = i * ratio;
    const lo = Math.floor(src);
    const hi = Math.min(lo + 1, input.length - 1);
    const t = src - lo;
    const s = input[lo] * (1 - t) + input[hi] * t;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(s * 32768)));
  }
  return out;
}

// 볼륨 정규화: 최대 진폭을 목표값(0.7)으로 스케일
function normalize(samples: Int16Array): Int16Array {
  let max = 0;
  for (let i = 0; i < samples.length; i++) { const a = Math.abs(samples[i]); if (a > max) max = a; }
  if (max < 1000) return samples; // 너무 조용하면 노이즈 증폭 방지
  const scale = Math.min(32767 * 0.7 / max, 3.0); // 최대 3배까지만 증폭
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) out[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] * scale)));
  return out;
}


function encodeWAV(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const dataLen = samples.length * 2;
  const buf = new ArrayBuffer(44 + dataLen);
  const v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true);
  w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, dataLen, true);
  let o = 44;
  for (let i = 0; i < samples.length; i++) { v.setInt16(o, samples[i], true); o += 2; }
  return buf;
}

function useClovaVoice({ onResult, onInterim, onError }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(
    () => typeof window !== 'undefined' && !!navigator.mediaDevices?.getUserMedia,
  );

  const onResultRef  = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onErrorRef   = useRef(onError);
  useEffect(() => { onResultRef.current  = onResult; },  [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onErrorRef.current   = onError; },   [onError]);

  const audioCtxRef       = useRef<AudioContext | null>(null);
  const processorRef      = useRef<ScriptProcessorNode | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const actualSampleRate  = useRef(SAMPLE_RATE);

  const pcmChunksRef    = useRef<Int16Array[]>([]);
  const totalSamplesRef = useRef(0);
  const isListeningRef    = useRef(false);
  const silenceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunkIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSendingRef      = useRef(false);
  const hasSpeechRef      = useRef(false);
  const lastInterimRef    = useRef('');

  const setInterim = useCallback((text: string) => {
    if (text === lastInterimRef.current) return;
    lastInterimRef.current = text;
    onInterimRef.current?.(text);
  }, []);

  const flush = useCallback(async () => {
    // 전송 중이면 완료 후 재시도 (발화 손실 방지)
    if (isSendingRef.current) {
      if (!silenceTimerRef.current) {
        silenceTimerRef.current = setTimeout(() => { silenceTimerRef.current = null; void flush(); }, 300);
      }
      return;
    }
    // 실제 발화가 없었으면 버퍼만 비우고 전송 안 함 (소음 hallucination 방지)
    if (!hasSpeechRef.current) {
      pcmChunksRef.current = [];
      totalSamplesRef.current = 0;
      return;
    }
    hasSpeechRef.current = false;
    const chunks = pcmChunksRef.current.splice(0);
    const total  = totalSamplesRef.current;
    totalSamplesRef.current = 0;
    if (total < SAMPLE_RATE * (MIN_SPEECH_MS / 1000)) return;

    const combined = new Int16Array(total);
    let off = 0;
    for (const c of chunks) { combined.set(c, off); off += c.length; }

    const processed = normalize(combined);

    isSendingRef.current = true;
    setInterim('인식 중...');
    try {
      const res = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'audio/wav' },
        body: encodeWAV(processed, SAMPLE_RATE),
      });
      if (res.ok) {
        const { text } = await res.json() as { text: string };
        if (text?.trim()) onResultRef.current(text.trim());
      } else if (res.status === 500) {
        const { error } = await res.json() as { error: string };
        if (error === 'STT not configured') onErrorRef.current?.('CLOVA 환경변수를 설정해 주세요.');
      }
    } catch { /* 네트워크 순단 */ }
    finally { isSendingRef.current = false; setInterim(''); }
  }, [setInterim]);

  const scheduleFlush = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => { silenceTimerRef.current = null; flush(); }, SILENCE_MS);
  }, [flush]);

  const teardown = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (chunkIntervalRef.current) { clearInterval(chunkIntervalRef.current); chunkIntervalRef.current = null; }
    try { processorRef.current?.disconnect(); } catch { /* ignore */ }
    try { analyserRef.current?.disconnect(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    processorRef.current = null; analyserRef.current = null;
    streamRef.current = null;   audioCtxRef.current = null;
  }, []);

  const stop = useCallback(() => {
    if (!isListeningRef.current) return;
    isListeningRef.current = false;
    setIsListening(false);
    setInterim('');
    flush();
    teardown();
  }, [flush, teardown, setInterim]);

  const start = useCallback(async () => {
    if (isListeningRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      stream.getAudioTracks()[0].addEventListener('ended', () => {
        if (isListeningRef.current) { stop(); onErrorRef.current?.('마이크 연결이 끊겼습니다. 다시 시작해 주세요.'); }
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
      const ctx = new Ctx({ sampleRate: SAMPLE_RATE }) as AudioContext;
      await ctx.resume();
      audioCtxRef.current = ctx;
      actualSampleRate.current = ctx.sampleRate; // 실제 지원 샘플레이트 기록

      const analyser = ctx.createAnalyser();
      analyserRef.current = analyser;

      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isListeningRef.current) return;
        const input = e.inputBuffer.getChannelData(0);
        // 실제 샘플레이트 → 16000Hz 다운샘플 (48000Hz 기기 대응)
        const pcm = resampleTo16k(input, actualSampleRate.current);
        pcmChunksRef.current.push(pcm);
        totalSamplesRef.current += pcm.length;

        // RMS를 analyser 대신 input buffer 전체로 계산 (더 정확한 발화 감지)
        let rmsSum = 0;
        for (let i = 0; i < input.length; i++) rmsSum += input[i] * input[i];
        const rms = Math.sqrt(rmsSum / input.length) * 127;

        if (rms > SILENCE_THRESHOLD) {
          // 발화 감지 — 실제 말소리 있음
          hasSpeechRef.current = true;
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
          setInterim('🎙 말하는 중...');
        } else if (hasSpeechRef.current && totalSamplesRef.current > SAMPLE_RATE * (MIN_SPEECH_MS / 1000)) {
          // 발화 후 침묵 감지 — 전송
          scheduleFlush();
        }
      };

      const src = ctx.createMediaStreamSource(stream);
      const silence = ctx.createGain();
      silence.gain.value = 0;
      src.connect(analyser); analyser.connect(processor); processor.connect(silence); silence.connect(ctx.destination);

      pcmChunksRef.current = []; totalSamplesRef.current = 0; hasSpeechRef.current = false;
      isListeningRef.current = true;
      setIsListening(true);

      // 3초마다 자동 전송 — 녹음 중지 안 눌러도 실시간으로 텍스트 표시
      chunkIntervalRef.current = setInterval(() => {
        if (!isListeningRef.current || isSendingRef.current) return;
        if (hasSpeechRef.current && totalSamplesRef.current > SAMPLE_RATE * (MIN_SPEECH_MS / 1000)) {
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
          void flush();
        } else if (!hasSpeechRef.current) {
          // 발화 없이 소음만 쌓였으면 버퍼 버림
          pcmChunksRef.current = [];
          totalSamplesRef.current = 0;
        }
      }, CHUNK_INTERVAL_MS);
    } catch (err) {
      const isPerm = err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      onErrorRef.current?.(isPerm ? '마이크 권한을 허용해 주세요.' : '마이크를 시작할 수 없습니다.');
    }
  }, [scheduleFlush, setInterim, stop]);

  const toggle = useCallback(() => { isListeningRef.current ? stop() : start(); }, [start, stop]);

  useEffect(() => {
    return () => { isListeningRef.current = false; if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); teardown(); };
  }, [teardown]);

  return { isListening, isSupported, toggle, stop };
}

// ── 환경변수 기반 스위칭 ───────────────────────────────────────────────────────
// NEXT_PUBLIC_CLOVA_ENABLED=true 설정 시 Clova, 없으면 Web Speech API 폴백
export const useVoiceRecognition =
  process.env.NEXT_PUBLIC_CLOVA_ENABLED === 'true' ? useClovaVoice : useWebSpeechVoice;
