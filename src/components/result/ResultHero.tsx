'use client';

import type { TestResult } from '@/types';
import { codeInfo } from '@/data/typeData';

interface Props {
  result: TestResult;
}

export function ResultHero({ result }: Props) {
  const primaryInfo = codeInfo[result.primary];
  const secondaryInfo = codeInfo[result.secondary];

  return (
    <div className="card max-w-xl mx-auto text-center mb-6 relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-5"
        style={{ background: `radial-gradient(circle at 50% 0%, ${primaryInfo.color}, transparent 70%)` }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-center gap-3 mb-4">
          <span
            className="text-4xl font-black"
            style={{ color: primaryInfo.color }}
          >
            {result.primary}
          </span>
          <span className="text-slate-500 text-2xl">+</span>
          <span
            className="text-4xl font-black"
            style={{ color: secondaryInfo.color }}
          >
            {result.secondary}
          </span>
        </div>

        <h2 className="text-2xl font-bold text-slate-100 mb-2">{result.type.name}</h2>
        <p className="text-slate-400 leading-relaxed">{result.type.desc}</p>

        <div className="flex justify-center gap-2 mt-4">
          {[result.primary, result.secondary].map((code) => {
            const info = codeInfo[code];
            return (
              <span
                key={code}
                className="px-3 py-1 rounded-full text-xs font-semibold"
                style={{ backgroundColor: `${info.color}20`, color: info.color, border: `1px solid ${info.color}30` }}
              >
                {code} · {info.label}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
