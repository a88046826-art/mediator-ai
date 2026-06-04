'use client';

import Link from 'next/link';

const tests = [
  {
    href: '/test/code',
    badge: 'CODE TEST',
    emoji: '🧬',
    title: '팀원 성향 진단',
    subtitle: 'D · O · C · E',
    desc: '나의 팀 내 역할과 성향 조합을 알아보세요.\n결과는 12가지 팀원 유형으로 분류됩니다.',
    meta: '20문항 · 약 3분',
    accent: 'from-violet-500/20 to-cyan-500/10',
    border: 'hover:border-violet-400',
    badgeColor: 'bg-accent/20 text-accent',
  },
  {
    href: '/test/philosopher',
    badge: 'PHILOSOPHER TEST',
    emoji: '📜',
    title: '철학자 성향 진단',
    subtitle: 'NIETZSCHE · PLATO · KANT…',
    desc: '나와 닮은 동서양 철학자를 찾아보세요.\n고대부터 근대까지 12인의 사상가와 매칭됩니다.',
    meta: '20문항 · 약 3분',
    accent: 'from-amber-500/20 to-yellow-500/5',
    border: 'hover:border-amber-400',
    badgeColor: 'bg-amber-500/20 text-amber-300',
  },
];

export default function TestHubPage() {
  return (
    <div className="max-w-xl mx-auto px-4 py-16 flex flex-col items-center">
      <p className="text-xs font-mono tracking-widest text-accent uppercase mb-3">
        CODETEST · 성향 진단
      </p>
      <h1 className="text-3xl font-bold text-slate-100 mb-2 text-center">
        어떤 테스트를 할까요?
      </h1>
      <p className="text-slate-400 text-sm mb-12 text-center">
        두 가지 방식으로 나의 CODE 성향을 탐색할 수 있어요.
      </p>

      <div className="w-full flex flex-col gap-5">
        {tests.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`group relative card bg-gradient-to-br ${t.accent} border border-border ${t.border} transition-all duration-200 hover:-translate-y-1 hover:shadow-lg hover:shadow-black/30 no-underline`}
          >
            <div className="flex items-start gap-5 p-6">
              <div className="w-16 h-16 rounded-xl bg-white/5 flex items-center justify-center text-3xl flex-shrink-0">
                {t.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className={`inline-block text-[10px] font-mono tracking-widest px-2 py-0.5 rounded-full mb-2 ${t.badgeColor}`}>
                  {t.badge}
                </div>
                <h2 className="text-xl font-bold text-slate-100 mb-0.5">{t.title}</h2>
                <p className="text-xs font-mono text-slate-500 mb-2">{t.subtitle}</p>
                <p className="text-sm text-slate-400 leading-relaxed whitespace-pre-line">{t.desc}</p>
                <p className="text-xs text-slate-500 mt-3">{t.meta}</p>
              </div>
              <div className="text-slate-600 group-hover:text-slate-300 transition-colors text-xl flex-shrink-0 self-center">
                →
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
