'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface Options {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (err: string) => void;
  meetingTopic?: string;
  meetingSpeakers?: string;
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
const SILENCE_MS         = 1500;
const MIN_SPEECH_MS      = 200;    // 300→200: 짧은 단어("네","맞아") 누락 방지
const NOISE_FLOOR_INIT   = 6;
const NOISE_ADAPT_RATE   = 0.015;
const SPEECH_RATIO       = 3.2;    // 3.5→3.2: 조금 더 작은 소리도 감지
const NOISE_FLOOR_MIN    = 3;
const NOISE_FLOOR_MAX    = 15;

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

// 앞뒤 무음 제거: 임계값 이하 샘플을 앞뒤에서 잘라내고 50ms 패딩 유지
function trimSilence(samples: Int16Array, threshold = 150): Int16Array {
  const PADDING = Math.floor(SAMPLE_RATE * 0.05); // 50ms padding
  let start = 0;
  let end = samples.length - 1;
  while (start < samples.length && Math.abs(samples[start]) < threshold) start++;
  while (end > start && Math.abs(samples[end]) < threshold) end--;
  if (start >= end) return samples; // 전부 무음이면 원본 반환 (hallucination 필터가 처리)
  start = Math.max(0, start - PADDING);
  end = Math.min(samples.length - 1, end + PADDING);
  return samples.slice(start, end + 1);
}

// Pre-emphasis 필터: 고주파(자음) 강조 — y[n] = x[n] - 0.97 * x[n-1]
function preEmphasis(samples: Int16Array): Int16Array {
  const out = new Int16Array(samples.length);
  out[0] = samples[0];
  for (let i = 1; i < samples.length; i++) {
    out[i] = Math.max(-32768, Math.min(32767, Math.round(samples[i] - 0.97 * samples[i - 1])));
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

function useClovaVoice({ onResult, onInterim, onError, meetingTopic, meetingSpeakers }: Options) {
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
  const workletNodeRef    = useRef<AudioWorkletNode | null>(null);
  const streamRef         = useRef<MediaStream | null>(null);
  const actualSampleRate  = useRef(SAMPLE_RATE);

  const pcmChunksRef    = useRef<Int16Array[]>([]);
  const totalSamplesRef = useRef(0);
  const isListeningRef    = useRef(false);
  const silenceTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunkIntervalRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const sendQueueRef      = useRef<Int16Array[]>([]);
  const isProcessingRef   = useRef(false);
  const hasSpeechRef      = useRef(false);
  const noiseFloorRef     = useRef(NOISE_FLOOR_INIT);
  const warmupFramesRef   = useRef(0);
  const lastInterimRef    = useRef('');
  const lastTranscriptRef = useRef('');
  const lastFrameRef      = useRef(0);
  const softRecoveryRef   = useRef(false);         // 2단계 복구: 소프트(resume) 시도 여부
  const startRef          = useRef<() => Promise<void>>(async () => {});
  const visibilityHandlerRef = useRef<(() => void) | null>(null);

  const setInterim = useCallback((text: string) => {
    if (text === lastInterimRef.current) return;
    lastInterimRef.current = text;
    onInterimRef.current?.(text);
  }, []);

  // 큐에 쌓인 오디오 세그먼트를 하나씩 순서대로 Groq에 전송
  const processQueue = useCallback(async () => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;
    while (sendQueueRef.current.length > 0) {
      const processed = sendQueueRef.current.shift()!;
      setInterim('인식 중...');
      try {
        const params = new URLSearchParams();
        if (meetingTopic)    params.set('topic',    meetingTopic);
        if (meetingSpeakers) params.set('speakers', meetingSpeakers);
        // 직전 인식 결과를 Whisper 문맥 프롬프트로 전달 (고유명사·맥락 정확도 향상)
        if (lastTranscriptRef.current) params.set('context', lastTranscriptRef.current.slice(-150));
        const abort = new AbortController();
        const timeoutId = setTimeout(() => abort.abort(), 15000);
        const res = await fetch(`/api/stt?${params}`, {
          method: 'POST',
          headers: { 'Content-Type': 'audio/wav' },
          body: encodeWAV(processed, SAMPLE_RATE),
          signal: abort.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const { text } = await res.json() as { text: string };
          const trimmed = text?.trim();
          // 직전 결과와 동일하면 hallucination으로 간주하고 드롭
          if (trimmed && trimmed !== lastTranscriptRef.current) {
            lastTranscriptRef.current = trimmed;
            onResultRef.current(trimmed);
          }
        } else if (res.status === 500) {
          const { error } = await res.json() as { error: string };
          if (error === 'STT not configured') onErrorRef.current?.('CLOVA 환경변수를 설정해 주세요.');
        }
      } catch { /* 네트워크 순단 — 해당 세그먼트 드롭하고 다음으로 */ }
    }
    isProcessingRef.current = false;
    setInterim('');
  }, [setInterim, meetingTopic, meetingSpeakers]);

  // 발화 종료 시: 현재 PCM을 즉시 스냅샷해서 큐에 넣고 전송 시작
  const flush = useCallback(() => {
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

    sendQueueRef.current.push(normalize(preEmphasis(trimSilence(combined))));
    void processQueue();
  }, [processQueue]);

  const scheduleFlush = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(() => { silenceTimerRef.current = null; flush(); }, SILENCE_MS);
  }, [flush]);

  const teardown = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    if (chunkIntervalRef.current) { clearInterval(chunkIntervalRef.current); chunkIntervalRef.current = null; }
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (visibilityHandlerRef.current) {
      document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
      visibilityHandlerRef.current = null;
    }
    try { workletNodeRef.current?.disconnect(); } catch { /* ignore */ }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    workletNodeRef.current = null;
    streamRef.current = null; audioCtxRef.current = null;
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

    // iOS Safari requires AudioContext to be created synchronously within a user gesture handler.
    // Creating it after an `await` loses the gesture context and leaves the context suspended.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Ctx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!Ctx) {
      onErrorRef.current?.('이 브라우저는 오디오 기능을 지원하지 않습니다.');
      return;
    }
    let ctx: AudioContext;
    try {
      ctx = new Ctx({ sampleRate: SAMPLE_RATE }) as AudioContext;
    } catch {
      ctx = new Ctx() as AudioContext; // older iOS ignores sampleRate option
    }
    void ctx.resume(); // fire-and-forget inside user gesture — satisfies iOS autoplay policy

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      streamRef.current = stream;
      stream.getAudioTracks()[0].addEventListener('ended', () => {
        if (!isListeningRef.current) return;
        // 마이크 트랙 종료 → 자동 재시작 (Android에서 알림음 등으로 잠깐 끊길 때)
        isListeningRef.current = false;
        teardown();
        setTimeout(() => { void startRef.current(); }, 800);
      });

      // Resume again in case the context ended up suspended after the async getUserMedia call
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch { /* ignore */ } }
      audioCtxRef.current = ctx;
      actualSampleRate.current = ctx.sampleRate; // 실제 지원 샘플레이트 기록

      await ctx.audioWorklet.addModule('/audio-processor.worklet.js');
      const workletNode = new AudioWorkletNode(ctx, 'pcm-processor');
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e: MessageEvent<Float32Array>) => {
        if (!isListeningRef.current) return;
        lastFrameRef.current = Date.now();
        softRecoveryRef.current = false; // 프레임 수신 시 소프트 복구 플래그 리셋
        const input = e.data;
        // 실제 샘플레이트 → 16000Hz 다운샘플 (48000Hz 기기 대응)
        const pcm = resampleTo16k(input, actualSampleRate.current);
        pcmChunksRef.current.push(pcm);
        totalSamplesRef.current += pcm.length;

        // RMS 계산
        let rmsSum = 0;
        for (let i = 0; i < input.length; i++) rmsSum += input[i] * input[i];
        const rms = Math.sqrt(rmsSum / input.length) * 127;

        warmupFramesRef.current++;

        // 처음 4프레임(~1초)은 노이즈 플로어 캘리브레이션만 수행
        if (warmupFramesRef.current <= 4) {
          noiseFloorRef.current = noiseFloorRef.current * (1 - NOISE_ADAPT_RATE) + rms * NOISE_ADAPT_RATE;
          noiseFloorRef.current = Math.max(NOISE_FLOOR_MIN, Math.min(NOISE_FLOOR_MAX, noiseFloorRef.current));
          return;
        }

        // 적응형 임계값: 노이즈 플로어의 SPEECH_RATIO 배
        const speechThreshold = Math.max(NOISE_FLOOR_MIN * SPEECH_RATIO, noiseFloorRef.current * SPEECH_RATIO);

        if (rms > speechThreshold) {
          // 발화 감지
          hasSpeechRef.current = true;
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
          setInterim('🎙 말하는 중...');
        } else {
          // 침묵 — 노이즈 플로어 서서히 적응
          if (!hasSpeechRef.current) {
            noiseFloorRef.current = noiseFloorRef.current * (1 - NOISE_ADAPT_RATE) + rms * NOISE_ADAPT_RATE;
            noiseFloorRef.current = Math.max(NOISE_FLOOR_MIN, Math.min(NOISE_FLOOR_MAX, noiseFloorRef.current));
          }
          if (hasSpeechRef.current && totalSamplesRef.current > SAMPLE_RATE * (MIN_SPEECH_MS / 1000)) {
            scheduleFlush();
          }
        }
      };

      const src = ctx.createMediaStreamSource(stream);
      const silence = ctx.createGain();
      silence.gain.value = 0;
      src.connect(workletNode);
      workletNode.connect(silence);
      silence.connect(ctx.destination);

      pcmChunksRef.current = []; totalSamplesRef.current = 0; hasSpeechRef.current = false;
      noiseFloorRef.current = NOISE_FLOOR_INIT; warmupFramesRef.current = 0;
      lastTranscriptRef.current = '';
      sendQueueRef.current = []; isProcessingRef.current = false;
      isListeningRef.current = true;
      setIsListening(true);

      // 탭 전환 시 AudioContext resume
      const handleVisibility = () => {
        if (document.visibilityState === 'visible' && audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      };
      visibilityHandlerRef.current = handleVisibility;
      document.addEventListener('visibilitychange', handleVisibility);

      // AudioContext statechange 감지: 알림음·화면잠금 등으로 suspend돼도 즉시 resume
      ctx.addEventListener('statechange', () => {
        if (!isListeningRef.current || audioCtxRef.current?.state !== 'suspended') return;
        audioCtxRef.current.resume().catch(() => {
          // resume 실패 시 전체 재시작
          if (isListeningRef.current) {
            isListeningRef.current = false;
            teardown();
            setTimeout(() => { void startRef.current(); }, 1000);
          }
        });
      });

      // 1초마다 상태 체크 + 2단계 워치독
      heartbeatRef.current = setInterval(() => {
        if (!isListeningRef.current) return;
        if (audioCtxRef.current?.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
        if (lastFrameRef.current > 0) {
          const elapsed = Date.now() - lastFrameRef.current;
          if (elapsed > 3000 && !softRecoveryRef.current) {
            // 1단계: 3초 무응답 → AudioContext resume 소프트 시도
            softRecoveryRef.current = true;
            audioCtxRef.current?.resume().catch(() => {});
          } else if (elapsed > 6000) {
            // 2단계: 6초 무응답 → 전체 하드 재시작
            softRecoveryRef.current = false;
            lastFrameRef.current = 0;
            isListeningRef.current = false;
            teardown();
            setTimeout(() => { void startRef.current(); }, 300);
          }
        }
      }, 1000);

      // 5초마다 체크 — 5초 이상 연속 발화 시 강제 전송 (여러 명 환경에서 청크 적절히 분리)
      chunkIntervalRef.current = setInterval(() => {
        if (!isListeningRef.current) return;
        if (hasSpeechRef.current && totalSamplesRef.current > SAMPLE_RATE * 5) {
          if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
          void flush();
        } else if (!hasSpeechRef.current) {
          pcmChunksRef.current = [];
          totalSamplesRef.current = 0;
        }
      }, CHUNK_INTERVAL_MS);
    } catch (err) {
      ctx.close().catch(() => {}); // cleanup pre-created AudioContext
      const isPerm = err instanceof Error && (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
      onErrorRef.current?.(isPerm ? '마이크 권한을 허용해 주세요.' : '마이크를 시작할 수 없습니다.');
    }
  }, [scheduleFlush, setInterim, stop]);

  const toggle = useCallback(() => { isListeningRef.current ? stop() : start(); }, [start, stop]);

  // startRef 항상 최신 유지 (자동 재시작 클로저에서 사용)
  useEffect(() => { startRef.current = start; }, [start]);

  useEffect(() => {
    return () => { isListeningRef.current = false; if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current); teardown(); };
  }, [teardown]);

  return { isListening, isSupported, toggle, stop };
}

// getUserMedia + Web Audio API 방식은 Chrome/Firefox/iOS Safari 모두 지원.
// Web Speech API는 Chrome 전용이므로 항상 useClovaVoice 사용.
export const useVoiceRecognition = useClovaVoice;
