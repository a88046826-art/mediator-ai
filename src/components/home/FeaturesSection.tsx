const features = [
  {
    icon: '🧬',
    title: '성향 진단',
    desc: '20개 질문으로 D·O·C·E 성향 비율을 측정하고 12가지 타입 중 나의 유형을 발견합니다.',
  },
  {
    icon: '🤝',
    title: '팀 분석',
    desc: '팀원 성향을 등록하고 레이더 차트로 팀 구성의 강점과 취약점을 한눈에 파악합니다.',
  },
  {
    icon: '🤖',
    title: 'AI 중재',
    desc: '회의 중 갈등 상황을 설명하면 AI가 각 성향을 고려한 중재안과 대화 스크립트를 제안합니다.',
  },
];

export function FeaturesSection() {
  return (
    <section className="max-w-5xl mx-auto px-4 pb-20">
      <div className="grid sm:grid-cols-3 gap-5">
        {features.map((f) => (
          <div key={f.title} className="card hover:border-accent/40 transition-colors group">
            <div className="text-3xl mb-4">{f.icon}</div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2 group-hover:text-accent transition-colors">
              {f.title}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
