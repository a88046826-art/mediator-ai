'use client';

import { useState } from 'react';
import type { TeamMember } from '@/types';
import { codeInfo } from '@/data/typeData';

interface Props {
  members: TeamMember[];
  onStart: (context: string) => void;
}

export function MeetingSetup({ members, onStart }: Props) {
  const [topic, setTopic] = useState('');

  return (
    <div className="card max-w-xl mx-auto">
      <h3 className="font-semibold text-slate-200 mb-4">회의 설정</h3>

      {members.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-slate-500 mb-2">등록된 팀원</p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <span
                key={m.id}
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{
                  backgroundColor: `${codeInfo[m.code].color}15`,
                  color: codeInfo[m.code].color,
                  border: `1px solid ${codeInfo[m.code].color}30`,
                }}
              >
                {m.name} ({m.code})
              </span>
            ))}
          </div>
        </div>
      )}

      <label className="block mb-2 text-xs text-slate-400 font-medium">오늘 회의 주제 (선택)</label>
      <textarea
        className="input-base w-full resize-none h-24 text-sm mb-4"
        placeholder="예: 다음 스프린트 우선순위 결정, 마케팅 전략 방향 논의..."
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
      />

      <button
        className="btn-primary w-full"
        onClick={() => onStart(topic)}
      >
        AI 중재 시작
      </button>
    </div>
  );
}
