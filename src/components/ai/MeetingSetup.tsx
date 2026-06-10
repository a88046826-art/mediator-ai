'use client';

import { useState } from 'react';
import type { TeamMember } from '@/types';

interface Props {
  members: TeamMember[];
  onStart: (context: string) => void;
}

const FIELDS = [
  {
    key: 'purpose' as const,
    icon: '🎯',
    label: '목적',
    sub: '이 회의로 뭘 결정/해결할 건지',
    placeholder: '예) 다음 분기 마케팅 예산 배분을 결정하기 위해',
    rows: 2,
  },
  {
    key: 'background' as const,
    icon: '📋',
    label: '배경/맥락',
    sub: '왜 이 회의가 필요한지',
    placeholder: '예) 팀 간 의견 차이가 생겨서 조율이 필요한 상황',
    rows: 2,
  },
  {
    key: 'outcome' as const,
    icon: '✅',
    label: '원하는 결과물',
    sub: '회의 끝나면 뭐가 나와야 하는지',
    placeholder: '예) 최종 결론 1개, 실행 계획 3가지',
    rows: 2,
  },
] as const;

type FieldKey = typeof FIELDS[number]['key'];

export function MeetingSetup({ members, onStart }: Props) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    purpose: '',
    background: '',
    outcome: '',
  });
  const [isStarting, setIsStarting] = useState(false);

  const set = (key: FieldKey, val: string) => setValues((prev) => ({ ...prev, [key]: val }));

  const handleStart = () => {
    const parts: string[] = [];
    if (values.purpose.trim())    parts.push(`목적: ${values.purpose.trim()}`);
    if (values.background.trim()) parts.push(`배경: ${values.background.trim()}`);
    if (values.outcome.trim())    parts.push(`결과물: ${values.outcome.trim()}`);
    setIsStarting(true);
    onStart(parts.join('\n'));
  };

  const hasAny = Object.values(values).some((v) => v.trim());

  return (
    <div className="card max-w-xl mx-auto space-y-5">
      <div>
        <h3 className="font-semibold text-slate-200 mb-0.5">회의 설정</h3>
        <p className="text-xs text-slate-500">아는 것만 채워도 괜찮아요. 3가지 모두 채울수록 AI가 더 잘 중재합니다.</p>
      </div>

      {members.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
              {m.name}
            </span>
          ))}
        </div>
      )}

      <div className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base leading-none">{f.icon}</span>
              <span className="text-sm font-medium text-slate-200">{f.label}</span>
              <span className="text-xs text-slate-500">{f.sub}</span>
            </div>
            <textarea
              className="input-base w-full text-sm resize-none"
              rows={f.rows}
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              disabled={isStarting}
            />
          </div>
        ))}
      </div>

      <button
        className="btn-primary w-full py-3 text-sm disabled:opacity-40"
        onClick={handleStart}
        disabled={isStarting}
      >
        {isStarting ? '준비 중...' : hasAny ? '회의 시작하기 →' : '주제 없이 시작하기 →'}
      </button>
    </div>
  );
}
