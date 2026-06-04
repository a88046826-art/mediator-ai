'use client';

const scenarios = [
  '우선순위 결정에서 의견이 충돌하고 있어요',
  'D 성향이 팀 의견을 무시하고 독단적으로 결정해요',
  '회의가 계속 길어지고 결론이 안 나요',
  'O 성향이 너무 낙관적이어서 실현 가능성이 걱정돼요',
  '팀원 간 신뢰가 무너진 것 같아요',
  '의사결정이 너무 느려서 타이밍을 놓치고 있어요',
];

interface Props {
  onSelect: (scenario: string) => void;
}

export function ScenarioChips({ onSelect }: Props) {
  return (
    <div className="px-4 pb-3 flex flex-wrap gap-2">
      {scenarios.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className="px-3 py-1.5 rounded-full text-xs bg-surface2 border border-border text-slate-400 hover:border-accent/40 hover:text-accent transition-colors"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
