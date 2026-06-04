import { codeInfo } from '@/data/typeData';

const descriptions: Record<string, string> = {
  D: '빠른 실행, 결단력, 변화를 두려워하지 않는 돌파형',
  O: '비전 제시, 에너지, 외부 네트워킹의 연결형',
  C: '팀 조율, 투명 소통, 갈등 중재의 협력형',
  E: '데이터 분석, 리스크 평가, 체계적 사고의 검증형',
};

export function CodeFramework() {
  return (
    <section className="max-w-5xl mx-auto px-4 pb-20">
      <h2 className="text-2xl font-bold text-center mb-3">CODE 프레임워크</h2>
      <p className="text-slate-400 text-center text-sm mb-10">
        모든 팀원은 네 가지 성향의 조합으로 이루어집니다
      </p>
      <div className="grid sm:grid-cols-4 gap-4">
        {Object.entries(codeInfo).map(([code, info]) => (
          <div
            key={code}
            className="card flex flex-col items-center text-center gap-3 hover:scale-105 transition-transform"
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-black"
              style={{ backgroundColor: `${info.color}20`, color: info.color, border: `2px solid ${info.color}40` }}
            >
              {code}
            </div>
            <div>
              <p className="font-semibold text-slate-100 text-sm">{info.label}</p>
              <p className="text-slate-400 text-xs mt-1 leading-relaxed">{descriptions[code]}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
