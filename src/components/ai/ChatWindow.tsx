'use client';

import { useEffect, useRef } from 'react';
import type { Message } from '@/types';

interface Props {
  messages: Message[];
  isLoading: boolean;
}

function interventionStyle(content: string): string {
  if (content.startsWith('⚡')) return 'bg-orange-500/10 border border-orange-500/40 text-slate-200';
  if (content.startsWith('📌')) return 'bg-blue-500/10 border border-blue-500/40 text-slate-200';
  if (content.startsWith('✅')) return 'bg-emerald-500/10 border border-emerald-500/40 text-slate-200';
  return 'bg-surface2 border border-border text-slate-200';
}

export function ChatWindow({ messages, isLoading }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeIn`}
        >
          {msg.role === 'ai' && (
            <div className="w-7 h-7 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-xs mr-2 shrink-0 mt-1">
              🤖
            </div>
          )}
          <div
            className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
              msg.role === 'user'
                ? 'bg-accent text-white rounded-tr-sm'
                : msg.isAlert
                ? 'bg-red-500/15 border border-red-500/30 text-red-300 rounded-tl-sm'
                : `${interventionStyle(msg.content)} rounded-tl-sm`
            }`}
          >
            {msg.content}
          </div>
        </div>
      ))}

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
