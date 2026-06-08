'use client';

import Link from 'next/link';

export default function TestHubPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center">
      <p className="text-xs font-mono tracking-widest text-accent uppercase mb-3">
        성향 진단
      </p>
      <h1 className="text-3xl font-bold text-slate-100 mb-2 text-center">
        팀원 성향 진단
      </h1>
      <p className="text-slate-400 text-sm mb-10 text-center">
        팀 협업을 위한 CODE 성향을 알아보세요
      </p>

      {/* 메인: CODE TEST */}
      <Link
        href="/test/code"
        className="group w-full card bg-gradient-to-br from-violet-500/20 to-cyan-500/10 border border-border hover:border-violet-400 transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/30 no-underline mb-10"
      >
        <div className="flex items-start gap-5 p-6">
          <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center text-3xl flex-shrink-0">
            🧬
          </div>
          <div className="flex-1 min-w-0">
            <div className="inline-block text-[10px] font-mono tracking-widest px-2 py-0.5 rounded-full mb-2 bg-accent/20 text-accent">
              CODE TEST
            </div>
            <h2 className="text-xl font-bold text-slate-100 mb-0.5">팀원 성향 진단</h2>
            <p className="text-xs font-mono text-slate-500 mb-2">D · O · C · E</p>
            <p className="text-sm text-slate-400 leading-relaxed">
              나의 팀 내 역할과 성향 조합을 알아보세요.{'\n'}결과는 팀 구성 분석과 AI 회의 중재에 활용됩니다.
            </p>
            <p className="text-xs text-slate-500 mt-3">20문항 · 약 3분</p>
          </div>
          <div className="text-slate-600 group-hover:text-slate-300 transition-colors text-xl flex-shrink-0 self-center">
            →
          </div>
        </div>
      </Link>

      {/* 부수: 철학자 테스트 */}
      <div className="w-full border-t border-border/50 pt-6">
        <p className="text-xs text-slate-600 text-center mb-4">다른 테스트</p>
        <Link
          href="/test/philosopher"
          className="group flex items-center gap-4 px-4 py-3 rounded-xl border border-border hover:border-amber-500/40 hover:bg-amber-500/5 transition-all no-underline"
        >
          <span className="text-xl">📜</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
              철학자 성향 진단
            </p>
            <p className="text-xs text-slate-600">나와 닮은 동서양 철학자 찾기</p>
          </div>
          <span className="text-slate-600 group-hover:text-slate-400 text-sm">→</span>
        </Link>
      </div>
    </div>
  );
}
