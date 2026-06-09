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
// isFinal 단편들을 묵음 1.5초 후 한 번에 저장 — 단어 쪼개짐 방지
const FLUSH_DELAY = 1500;

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
  const lastFinalTextRef = useRef(''); // 재인식 재전달 방지 (auto-restart 후 같은 단어 중복)

  // 누적 버퍼 — 쪼개진 isFinal들을 모아 하나의 문장으로 만든다
  const bufferRef = useRef('');
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushBuffer = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    const text = bufferRef.current.trim();
    if (text) {
      bufferRef.current = '';
      onResultRef.current(text);
    }
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const text = bufferRef.current.trim();
      if (text) {
        bufferRef.current = '';
        onResultRef.current(text);
      }
    }, FLUSH_DELAY);
  }, []);

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
    // 버퍼는 여기서 초기화하지 않음 — auto-restart 시 이어서 누적

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
              // auto-restart 직후 같은 단편 재전달 방지
              if (transcript !== lastFinalTextRef.current) {
                lastFinalTextRef.current = transcript;
                // 버퍼에 누적
                bufferRef.current = bufferRef.current
                  ? bufferRef.current + ' ' + transcript
                  : transcript;
                // 묵음 감지 타이머 리셋 — 계속 말하는 중이면 저장 미룸
                scheduleFlush();
              }
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
        e.error === 'network'     ? '네트워크 오류가 발생했습니다.' :
        e.error;
      onErrorRef.current?.(msg);
    };

    rec.onend = () => {
      if (mySession !== sessionIdRef.current) return;
      recRef.current = null;
      onInterimRef.current?.('');
      if (!userStoppedRef.current && isListeningRef.current) {
        // auto-restart: 버퍼 유지, 타이머도 유지 — 사용자가 아직 말하는 중일 수 있음
        setTimeout(createAndStart, 200);
      } else {
        // 사용자가 직접 정지: 버퍼 즉시 저장
        flushBuffer();
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
    flushBuffer(); // 버퍼에 남은 텍스트 즉시 저장
    try { recRef.current?.stop(); } catch { /* ignore */ }
    recRef.current = null;
  }, [flushBuffer]);

  const toggle = useCallback(() => {
    isListeningRef.current ? stop() : start();
  }, [start, stop]);

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
