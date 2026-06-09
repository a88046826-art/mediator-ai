import Link from 'next/link';

const steps = [
  {
    step: '01',
    icon: '🤝',
    title: '팀 구성',
    desc: '함께할 팀원 이름을 등록하세요. 회의 중 발화자를 구분해 AI가 더 정확하게 분석합니다.',
    action: '팀 만들기',
    href: '/team',
  },
  {
    step: '02',
    icon: '🤖',
    title: 'AI 회의 시작',
    desc: '회의 목적과 배경을 입력하고 시작하세요. AI가 대화를 듣고 갈등을 실시간으로 중재합니다.',
    action: '회의 시작하기',
    href: '/ai',
  },
];

export function FeaturesSection() {
  return (
    <section className="max-w-4xl mx-auto px-4 pb-24">
      <p className="text-center text-xs text-slate-500 uppercase tracking-widest mb-10">사용 방법</p>
      <div className="relative grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* connector line (desktop) */}
        <div className="hidden sm:block absolute top-8 left-[calc(25%+1rem)] right-[calc(25%+1rem)] h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent pointer-events-none" />

        {steps.map((s) => (
          <div key={s.step} className="card flex flex-col gap-4 hover:border-accent/40 transition-colors group">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-accent/60 font-bold">{s.step}</span>
              <span className="text-2xl">{s.icon}</span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 mb-1 group-hover:text-accent transition-colors">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
            </div>
            <Link
              href={s.href}
              className="mt-auto inline-block text-xs font-medium text-accent hover:text-accent/80 transition-colors"
            >
              {s.action} →
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
