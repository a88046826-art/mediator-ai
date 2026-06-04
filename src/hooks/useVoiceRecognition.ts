'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface Options {
  onResult: (text: string) => void;
  onError?: (err: string) => void;
}

export function useVoiceRecognition({ onResult, onError }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(0);

  // Refs so callbacks are always fresh — start() never has to depend on them
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const cleaningUpRef = useRef(false);

  const cleanUp = useCallback(() => {
    if (cleaningUpRef.current) return;
    cleaningUpRef.current = true;

    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close().catch(() => {});
    streamRef.current = null;
    audioCtxRef.current = null;
    analyserRef.current = null;
    setVolume(0);
    setIsListening(false);

    cleaningUpRef.current = false;
  }, []);

  const startVolume = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Guard: recognition may have already ended before stream opened
      if (!recRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      streamRef.current = stream;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(stream).connect(analyser);

      const tick = () => {
        if (!analyserRef.current) return;
        const data = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        setVolume(avg / 128);
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // mic permission denied or not available — no volume visualisation
    }
  }, []);

  const start = useCallback(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRec = w.SpeechRecognition ?? w.webkitSpeechRecognition;

    if (!SpeechRec) {
      onErrorRef.current?.('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용해 주세요.');
      return;
    }

    // Abort any already-running instance
    if (recRef.current) {
      recRef.current.abort();
      recRef.current = null;
    }

    const rec = new SpeechRec();
    rec.lang = 'ko-KR';
    rec.continuous = false;
    rec.interimResults = false;
    recRef.current = rec;

    rec.onstart = () => {
      setIsListening(true);
      startVolume();
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results as ArrayLike<SpeechRecognitionResult>)
        .map((r) => r[0].transcript)
        .join('');
      onResultRef.current(transcript);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      const msg =
        e.error === 'not-allowed'   ? '마이크 권한을 허용해 주세요.' :
        e.error === 'no-speech'     ? '음성이 감지되지 않았습니다.' :
        e.error === 'network'       ? '네트워크 오류가 발생했습니다.' :
        e.error;
      onErrorRef.current?.(msg);
    };

    rec.onend = () => {
      recRef.current = null;
      cleanUp();
    };

    try {
      rec.start();
    } catch {
      recRef.current = null;
      onErrorRef.current?.('음성 인식을 시작할 수 없습니다.');
    }
  }, [startVolume, cleanUp]);

  const stop = useCallback(() => {
    if (!recRef.current) return;
    try {
      recRef.current.stop(); // triggers onend → cleanUp
    } catch {
      recRef.current = null;
      cleanUp();
    }
  }, [cleanUp]);

  const toggle = useCallback(() => {
    isListening ? stop() : start();
  }, [isListening, start, stop]);

  return { isListening, volume, toggle, stop };
}
