'use client';

import type { Question } from '@/types';
import { codeInfo } from '@/data/typeData';

interface Props {
  question: Question;
  value: number;
  onChange: (v: number) => void;
}

const labels = ['전혀 아님', '아님', '보통', '그렇다', '매우 그렇다'];

export function QuestionCard({ question, value, onChange }: Props) {
  const info = codeInfo[question.code];
  return (
    <div className="card max-w-xl mx-auto w-full animate-fadeIn">
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold mb-4"
        style={{ backgroundColor: `${info.color}20`, color: info.color, border: `1px solid ${info.color}30` }}
      >
        {question.code} · {info.label}
      </div>

      <p className="text-lg font-semibold text-slate-100 mb-2 leading-snug">{question.text}</p>
      <p className="text-slate-500 text-sm mb-8">{question.sub}</p>

      <div className="flex flex-col gap-2">
        {labels.map((label, i) => {
          const score = i + 1;
          const selected = value === score;
          return (
            <button
              key={score}
              onClick={() => onChange(score)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                selected
                  ? 'border-accent bg-accent/15 text-accent'
                  : 'border-border bg-surface2 text-slate-300 hover:border-accent/40 hover:bg-surface3'
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                  selected ? 'border-accent bg-accent' : 'border-slate-600'
                }`}
              >
                {selected && <span className="w-2 h-2 bg-white rounded-full" />}
              </span>
              <span className="flex-1 text-left">{label}</span>
              <span className="text-xs text-slate-500">{score}점</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
