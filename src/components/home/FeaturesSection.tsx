import Link from 'next/link';

const steps = [
  {
    step: '01',
    icon: '🤝',
    title: '방 만들기 / 참가',
    desc: '방 코드를 만들어 공유하거나 받은 코드로 입장하세요. 팀원이 각자 기기에서 접속합니다.',
    action: '회의 시작하기',
    href: '/ai',
  },
  {
    step: '02',
    icon: '🤖',
    title: 'AI 실시간 중재',
    desc: '회의 목적을 입력하고 시작하세요. AI가 대화를 듣고 갈등·이탈·에너지 저하를 실시간으로 잡아줍니다.',
    action: '지금 시작하기',
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
