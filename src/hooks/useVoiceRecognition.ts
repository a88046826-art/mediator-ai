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
  const lastFinalTextRef = useRef(''); // 중복 방지: 마지막 처리된 텍스트

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
              // 직전 세션에서 이미 처리한 텍스트면 중복 스킵
              if (transcript !== lastFinalTextRef.current) {
                lastFinalTextRef.current = transcript;
                onResultRef.current(transcript);
              }
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
    lastFinalTextRef.current = '';
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

  // 컴포넌트 언마운트 시 반드시 정리 — 없으면 다음 세션과 충돌
  useEffect(() => {
    return () => {
      userStoppedRef.current = true;
      isListeningRef.current = false;
      sessionIdRef.current++; // 진행 중인 세션 무효화
      try { recRef.current?.abort(); } catch { /* ignore */ }
      recRef.current = null;
    };
  }, []);

  return { isListening, isSupported, toggle, stop };
}
