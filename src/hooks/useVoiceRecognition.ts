'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface Options {
  onResult: (text: string) => void;
  onError?: (err: string) => void;
}

export function useVoiceRecognition({ onResult, onError }: Options) {
  const [isListening, setIsListening] = useState(false);

  // Refs so callbacks are always fresh — no stale closure issues
  const onResultRef = useRef(onResult);
  const onErrorRef = useRef(onError);
  useEffect(() => { onResultRef.current = onResult; }, [onResult]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null);

  const cleanUp = useCallback(() => {
    recRef.current = null;
    setIsListening(false);
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

    if (recRef.current) {
      recRef.current.abort();
      recRef.current = null;
    }

    const rec = new SpeechRec();
    rec.lang = 'ko-KR';
    rec.continuous = true;
    rec.interimResults = false;
    recRef.current = rec;

    rec.onstart = () => setIsListening(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // e.resultIndex: index of the first NEW result this event
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          onResultRef.current(e.results[i][0].transcript);
        }
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onerror = (e: any) => {
      const msg =
        e.error === 'not-allowed' ? '마이크 권한을 허용해 주세요.' :
        e.error === 'no-speech'   ? '음성이 감지되지 않았습니다.' :
        e.error === 'network'     ? '네트워크 오류가 발생했습니다.' :
        e.error;
      onErrorRef.current?.(msg);
    };

    rec.onend = () => cleanUp();

    try {
      rec.start();
    } catch {
      recRef.current = null;
      onErrorRef.current?.('음성 인식을 시작할 수 없습니다.');
    }
  }, [cleanUp]);

  const stop = useCallback(() => {
    if (!recRef.current) return;
    try {
      recRef.current.stop();
    } catch {
      cleanUp();
    }
  }, [cleanUp]);

  const toggle = useCallback(() => {
    isListening ? stop() : start();
  }, [isListening, start, stop]);

  return { isListening, toggle, stop };
}
