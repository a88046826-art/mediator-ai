'use client';

import React, { useEffect, useRef, useCallback } from 'react';
import type { Message } from '@/types';

interface Props {
  messages: Message[];
  isLoading: boolean;
}

function aiBubbleStyle(content: string, isAlert: boolean): string {
  if (isAlert || content.startsWith('⚡'))
    return 'bg-orange-500/10 border border-orange-500/40 text-orange-100';
  if (content.startsWith('📌'))
    return 'bg-blue-500/10 border border-blue-500/40 text-slate-200';
  if (content.startsWith('✅'))
    return 'bg-emerald-500/10 border border-emerald-500/40 text-slate-200';
  return 'bg-surface2 border border-border text-slate-200';
}

function formatTime(ts: string | undefined): string {
  if (!ts) return '';
  const d = new Date(isNaN(Number(ts)) ? ts : Number(ts));
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function ChatWindow({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  useEffect(() => {
    // 사용자가 이미 맨 아래에 있을 때만 자동 스크롤 (위로 읽는 중이면 고정)
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
      style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {messages.map((msg) => {
        const timeLabel = formatTime(msg.timestamp);
        return (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn group`}
          >
            {msg.role === 'ai' && (
              <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-xs mr-2 shrink-0 mt-1">
                🤖
              </div>
            )}
            <div className="flex flex-col gap-0.5 max-w-[85%]">
              <div
                className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-accent text-white rounded-tr-sm'
                    : `${aiBubbleStyle(msg.content, !!msg.isAlert)} rounded-tl-sm`
                }`}
              >
                {msg.content}
              </div>
              {timeLabel && (
                <span className={`text-[10px] text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                  {timeLabel}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {isLoading && (
        <div className="flex justify-start animate-fadeIn">
          <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-xs mr-2 shrink-0 mt-1">
            🤖
          </div>
          <div className="bg-surface2 border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1 items-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-pulse2"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
            ))}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
