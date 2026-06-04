'use client';

import { useEffect, useRef } from 'react';

export interface TranscriptEntry {
  id: string;
  text: string;
  time: string;
}

interface Props {
  entries: TranscriptEntry[];
}

export function LiveTranscript({ entries }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-2xl">
          🎙
        </div>
        <p className="text-slate-400 text-sm">마이크를 켜고 말씀하세요</p>
        <p className="text-slate-600 text-xs">인식된 내용이 여기에 실시간으로 쌓입니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4 overflow-y-auto h-full">
      {entries.map((e) => (
        <div key={e.id} className="flex gap-2 items-start">
          <span className="text-[10px] font-mono text-slate-600 mt-1 shrink-0 w-10">{e.time}</span>
          <p className="text-sm text-slate-300 leading-relaxed">{e.text}</p>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
