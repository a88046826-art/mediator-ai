'use client';

import { useState } from 'react';

interface Props {
  onStart: () => void;
}

export function EscapeTheme({ onStart }: Props) {
  const [ready, setReady] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="relative mb-8">
        <div className="w-20 h-20 bg-accent/20 rounded-full flex items-center justify-center text-4xl animate-pulse2">
          🧬
        </div>
        <div className="absolute -right-1 -bottom-1 w-7 h-7 bg-accent2/30 rounded-full flex items-center justify-center text-sm">
          ?
        </div>
      </div>

      <h2 className="text-3xl font-bold mb-3">나는 어떤 팀원 유형일까?</h2>
      <p className="text-slate-400 mb-2">20개 질문 · 약 3분 소요</p>
      <p className="text-slate-500 text-sm mb-10 max-w-sm leading-relaxed">
        D·O·C·E 네 가지 성향 중 나의 강점과 성향 조합을 알아보세요.
        결과는 12가지 팀원 유형으로 분류됩니다.
      </p>

      <label className="flex items-center gap-2 mb-6 cursor-pointer">
        <input
          type="checkbox"
          className="w-4 h-4 accent-purple-500"
          checked={ready}
          onChange={(e) => setReady(e.target.checked)}
        />
        <span className="text-sm text-slate-400">솔직하게 답할 준비가 되었습니다</span>
      </label>

      <button
        className="btn-primary px-10 py-4 text-base disabled:opacity-40 disabled:cursor-not-allowed"
        disabled={!ready}
        onClick={onStart}
      >
        진단 시작하기
      </button>
    </div>
  );
}
