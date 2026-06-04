'use client';

import type { TestResult } from '@/types';
import { codeInfo } from '@/data/typeData';

interface Props {
  result: TestResult;
}

export function ResultGrid({ result }: Props) {
  const { type, scores } = result;
  const total = Object.values(scores).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="max-w-xl mx-auto space-y-4">
      {/* Score bars */}
      <div className="card">
        <h3 className="font-semibold text-slate-200 mb-4">성향 비율</h3>
        <div className="space-y-3">
          {Object.entries(scores).map(([code, score]) => {
            const info = codeInfo[code as keyof typeof codeInfo];
            const pct = Math.round((score / total) * 100);
            return (
              <div key={code}>
                <div className="flex justify-between text-xs mb-1">
                  <span style={{ color: info.color }}>{code} · {info.label}</span>
                  <span className="text-slate-400">{pct}%</span>
                </div>
                <div className="h-2 bg-surface2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, backgroundColor: info.color }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Strengths */}
      <div className="card">
        <h3 className="font-semibold text-emerald-400 mb-3">💪 강점</h3>
        <ul className="space-y-2">
          {type.strengths.map((s) => (
            <li key={s} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="text-emerald-400 mt-0.5">✓</span>
              {s}
            </li>
          ))}
        </ul>
      </div>

      {/* Weaknesses */}
      <div className="card">
        <h3 className="font-semibold text-red-400 mb-3">⚠️ 주의점</h3>
        <ul className="space-y-2">
          {type.weaknesses.map((w) => (
            <li key={w} className="flex items-start gap-2 text-sm text-slate-300">
              <span className="text-red-400 mt-0.5">!</span>
              {w}
            </li>
          ))}
        </ul>
      </div>

      {/* Tip */}
      <div className="card bg-accent/10 border-accent/30">
        <p className="text-xs text-accent font-semibold mb-1">팀 구성 팁</p>
        <p className="text-slate-300 text-sm leading-relaxed">{type.tip}</p>
      </div>
    </div>
  );
}
