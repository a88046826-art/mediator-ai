'use client';

import { useState, useRef } from 'react';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useToast } from '@/hooks/useToast';

interface Props {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: Props) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();

  const { isListening, toggle } = useVoiceRecognition({
    onResult: (t) => setText((prev) => (prev ? `${prev} ${t}` : t)),
    onError: (err) => showToast(`음성 오류: ${err}`, 'error'),
  });

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="p-4 border-t border-border bg-surface">
      <div className="flex gap-2 items-end max-w-3xl mx-auto">
        {/* mic button */}
        <button
          onClick={toggle}
          disabled={disabled}
          title={isListening ? '녹음 중지' : '음성 입력'}
          className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            isListening
              ? 'bg-red-500 text-white'
              : 'bg-surface2 border border-border text-slate-400 hover:border-accent/40 hover:text-accent'
          } disabled:opacity-40`}
        >
          {isListening ? (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1a4 4 0 0 0-4 4v7a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4zm-7 10a7 7 0 0 0 14 0h-2a5 5 0 0 1-10 0H5zm7 10v-3h-2v3H7v2h10v-2h-3z" />
            </svg>
          )}
        </button>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          disabled={disabled}
          placeholder={isListening ? '음성 인식 중...' : '갈등 상황을 설명하거나 질문하세요 (Shift+Enter: 줄바꿈)'}
          className="input-base flex-1 resize-none min-h-[40px] max-h-32 text-sm py-2.5 disabled:opacity-40"
          style={{ height: 'auto' }}
          onInput={(e) => {
            const el = e.currentTarget;
            el.style.height = 'auto';
            el.style.height = Math.min(el.scrollHeight, 128) + 'px';
          }}
        />

        <button
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="shrink-0 w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white hover:bg-purple-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg className="w-4 h-4 rotate-90" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l-7 7m7-7l7 7" />
          </svg>
        </button>
      </div>

      {isListening && (
        <div className="flex items-center justify-center gap-1 mt-3">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="w-0.5 bg-red-400 rounded-full animate-waveAnim"
              style={{ height: '16px', animationDelay: `${i * 0.12}s` }}
            />
          ))}
          <span className="text-xs text-red-400 ml-2">녹음 중 · 말씀하세요</span>
        </div>
      )}
    </div>
  );
}
