'use client';

import Link from 'next/link';

export function HeroSection() {
  return (
    <section className="relative flex flex-col items-center justify-center text-center px-4 py-24 overflow-hidden">
      {/* glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-2xl">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse2" />
          AI 팀 중재자 &amp; 성향 진단
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold leading-tight mb-5">
          팀이 왜 자꾸
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-accent to-accent2">
            겉도는지 알고 싶다면
          </span>
        </h1>

        <p className="text-slate-400 text-lg mb-8 leading-relaxed">
          D·O·C·E 성향 진단으로 팀원을 이해하고,
          <br />
          AI 중재자가 회의 갈등을 실시간으로 해결합니다.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/test" className="btn-primary text-base px-8 py-4">
            내 성향 진단하기 →
          </Link>
          <Link href="/ai" className="btn-secondary text-base px-8 py-4">
            AI 중재 시작하기
          </Link>
        </div>
      </div>
    </section>
  );
}
