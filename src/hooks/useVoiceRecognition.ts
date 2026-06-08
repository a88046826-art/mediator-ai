'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface Options {
  onResult: (text: string) => void;
  onInterim?: (text: string) => void;
  onError?: (err: string) => void;
}

function checkSupport() {
  if (typeof window === 'undefined') return false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  return !!(w.SpeechRecognition ?? w.webkitSpeechRecognition);
}

const MIN_CONFIDENCE = 0.4;

export function useVoiceRecognition({ onResult, onInterim, onError }: Options) {
  const [isListening, setIsListening] = useState(false);
  const [isSupported] = useState(checkSupport);

  const onResultRef = useRef(onResult);
  const onInterimRef = useRef(onInterim);
  const onErrorRef = useRef(onError);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onInterimRef.current = onInterim; }, [onInterim]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);
  const userStoppedRef = useRef(false);
  const isListeningRef = useRef(false);
  const sessionIdRef = useRef(0);
  const nextFinalIndexRef = useRef(0);

  const createAndStart = useCallback(() => {
    if (typeof window === 'undefined') return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRec) return;

    if (recRef.current) {
      try { recRef.current.abort(); } catch { /* ignore */ }
      recRef.current = null;
    }

    const mySession = ++sessionIdRef.current;
    nextFinalIndexRef.current = 0;

    const rec = new SpeechRec();
    rec.lang = 'ko-KR';
    // continuous: true — 세션을 유지해 Android에서 재시작 시 권한 팝업 반복 방지
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
            if (confidence === 0 || confidence >= MIN_CONFIDENCE) {
              onResultRef.current(transcript);
            }
            onInterimRef.current?.('');
          }
        } else {
          interimText += transcript;
        }
      }
      if (interimText) {
        onInterimRef.current?.(interimText);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      if (mySession !== sessionIdRef.current) return;
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      const msg =
        e.error === 'not-allowed' ? '마이크 권한을 허용해 주세요.' :
        e.error === 'network'     ? '네트워크 오류가 발생했습니다.' :
        e.error;
      onErrorRef.current?.(msg);
    };

    // continuous 모드에서도 네트워크 끊김 등으로 onEnd가 올 수 있음 — 재시작
    rec.onend = () => {
      if (mySession !== sessionIdRef.current) return;
      recRef.current = null;
      onInterimRef.current?.('');
      if (!userStoppedRef.current && isListeningRef.current) {
        setTimeout(createAndStart, 300);
      } else {
        isListeningRef.current = false;
        setIsListening(false);
      }
    };

    try {
      rec.start();
    } catch {
      recRef.current = null;
      isListeningRef.current = false;
      setIsListening(false);
      onErrorRef.current?.('음성 인식을 시작할 수 없습니다.');
    }
  }, []);

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
    setIsListening(true);
    createAndStart();
  }, [createAndStart]);

  const stop = useCallback(() => {
    if (!isListeningRef.current) return;
    userStoppedRef.current = true;
    isListeningRef.current = false;
    setIsListening(false);
    onInterimRef.current?.('');
    try { recRef.current?.stop(); } catch { /* ignore */ }
    recRef.current = null;
  }, []);

  const toggle = useCallback(() => {
    isListeningRef.current ? stop() : start();
  }, [start, stop]);

  return { isListening, isSupported, toggle, stop };
}
