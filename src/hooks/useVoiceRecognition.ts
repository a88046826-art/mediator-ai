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
  const noSpeechRef = useRef(false);
  // session ID prevents stale onresult from a previous session firing after restart
  const sessionIdRef = useRef(0);

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

    const rec = new SpeechRec();
    rec.lang = 'ko-KR';
    // continuous: false — one utterance per session, then onend fires cleanly.
    // We restart manually in onend to get continuous-like behavior without
    // Chrome's result-accumulation bug that causes duplicates.
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    recRef.current = rec;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      // discard results from a session that was already replaced
      if (mySession !== sessionIdRef.current) return;

      let interimText = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const transcript = result[0].transcript.trim();
        if (!transcript) continue;
        const confidence = result[0].confidence;

        if (result.isFinal) {
          if (confidence === 0 || confidence >= MIN_CONFIDENCE) {
            onResultRef.current(transcript);
          }
          onInterimRef.current?.('');
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
      if (e.error === 'no-speech') {
        noSpeechRef.current = true;
        return;
      }
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
        // no-speech 후엔 500ms 딜레이로 권한 팝업 반복 방지
        const delay = noSpeechRef.current ? 500 : 0;
        noSpeechRef.current = false;
        setTimeout(createAndStart, delay);
      } else {
        noSpeechRef.current = false;
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
    userStoppedRef.current = false;
    isListeningRef.current = true;
    setIsListening(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SpeechRec = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SpeechRec) {
      onErrorRef.current?.('이 브라우저는 음성 인식을 지원하지 않습니다. Chrome을 사용해 주세요.');
      isListeningRef.current = false;
      setIsListening(false);
      return;
    }

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
