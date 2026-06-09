'use client';

import { useRef, useState } from 'react';
import type { TeamMember } from '@/types';

interface Props {
  members: TeamMember[];
  onStart: (context: string) => void;
}

const FIELDS = [
  {
    key: 'purpose' as const,
    emoji: '🎯',
    label: '목적',
    hint: '이 회의로 뭘 결정/해결할 건지',
    placeholder: '예) 다음 스프린트 핵심 기능 3가지를 결정하기 위해',
  },
  {
    key: 'background' as const,
    emoji: '📋',
    label: '배경·맥락',
    hint: '왜 이 회의가 필요한지',
    placeholder: '예) 이번 분기 출시 일정이 촉박해서',
  },
  {
    key: 'output' as const,
    emoji: '✅',
    label: '원하는 결과물',
    hint: '회의가 끝나면 뭐가 나와야 하는지',
    placeholder: '예) 우선순위 확정 목록 1개, 담당자 배정',
  },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

export function MeetingSetup({ members, onStart }: Props) {
  const [values, setValues] = useState<Record<FieldKey, string>>({
    purpose: '',
    background: '',
    output: '',
  });
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const allFilled = FIELDS.every((f) => values[f.key].trim().length > 0);

  const handleStart = () => {
    if (!allFilled) return;
    const context = [
      `목적: ${values.purpose.trim()}`,
      `배경: ${values.background.trim()}`,
      `결과물: ${values.output.trim()}`,
    ].join('\n');
    onStart(context);
  };

  return (
    <div className="card max-w-xl mx-auto space-y-5">
      <div>
        <h3 className="font-semibold text-slate-200 mb-0.5">회의 설정</h3>
        <p className="text-xs text-slate-500">3가지 항목을 채우면 AI가 회의 맥락을 훨씬 정확하게 파악해요</p>
      </div>

      {members.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2">등록된 팀원</p>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => (
              <span
                key={m.id}
                className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20"
              >
                {m.name}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-4">
        {FIELDS.map((f, idx) => (
          <div key={f.key}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-sm">{f.emoji}</span>
              <span className="text-xs font-semibold text-slate-300">{f.label}</span>
              <span className="text-xs text-slate-600">— {f.hint}</span>
              <span className="ml-auto text-[10px] text-red-400/70 font-mono">필수</span>
            </div>
            <input
              ref={(el) => { inputRefs.current[idx] = el; }}
              type="text"
              className="input-base w-full text-sm"
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return;
                e.preventDefault();
                if (idx < FIELDS.length - 1) {
                  inputRefs.current[idx + 1]?.focus();
                } else {
                  handleStart();
                }
              }}
            />
          </div>
        ))}
      </div>

      <div>
        <button
          className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
          onClick={handleStart}
          disabled={!allFilled}
        >
          AI 중재 시작
        </button>
        {!allFilled && (
          <p className="text-xs text-center text-slate-600 mt-2">
            3가지 항목을 모두 입력해야 시작할 수 있어요
          </p>
        )}
      </div>
    </div>
  );
}
