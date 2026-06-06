'use client';

import { useEffect, useRef } from 'react';

export interface TranscriptEntry {
  id: string;
  text: string;
  time: string;
  speaker?: string;
}

interface Props {
  entries: TranscriptEntry[];
  interimText?: string;
  speakerColors?: Record<string, string>;
}

const COLOR_PALETTE = [
  'text-blue-400',
  'text-amber-400',
  'text-green-400',
  'text-purple-400',
];

export function LiveTranscript({ entries, interimText, speakerColors = {} }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [entries, interimText]);

  if (entries.length === 0 && !interimText) {
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
      {entries.map((e) => {
        const speakerColor = e.speaker ? speakerColors[e.speaker] : undefined;
        return (
          <div key={e.id} className="flex gap-2 items-start">
            <div className="shrink-0 w-20 mt-0.5 text-right">
              <span className="text-[10px] font-mono text-slate-600">{e.time}</span>
              {e.speaker && (
                <p className={`text-[10px] font-medium truncate ${speakerColor ?? 'text-slate-400'}`}>
                  {e.speaker}
                </p>
              )}
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">{e.text}</p>
          </div>
        );
      })}
      {interimText && (
        <div className="flex gap-2 items-start">
          <span className="text-[10px] font-mono text-slate-700 mt-1 shrink-0 w-20 text-right">…</span>
          <p className="text-sm text-slate-500 leading-relaxed italic">{interimText}</p>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}

export { COLOR_PALETTE };
