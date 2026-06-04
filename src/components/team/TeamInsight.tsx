import type { TeamMember, CodeType } from '@/types';
import { codeInfo } from '@/data/typeData';

interface Props {
  members: TeamMember[];
}

const CODES: CodeType[] = ['D', 'O', 'C', 'E'];

export function TeamInsight({ members }: Props) {
  if (members.length === 0) return null;

  const counts = CODES.reduce((acc, c) => {
    acc[c] = members.filter((m) => m.code === c).length;
    return acc;
  }, {} as Record<CodeType, number>);

  const missing = CODES.filter((c) => counts[c] === 0);
  const dominant = CODES.reduce((a, b) => (counts[a] >= counts[b] ? a : b));

  return (
    <div className="card space-y-3">
      <h3 className="font-semibold text-slate-200">팀 인사이트</h3>

      <div className="flex flex-wrap gap-2">
        {CODES.map((c) => (
          <span
            key={c}
            className="px-3 py-1 rounded-full text-xs font-semibold"
            style={{ backgroundColor: `${codeInfo[c].color}20`, color: codeInfo[c].color, border: `1px solid ${codeInfo[c].color}30` }}
          >
            {c}: {counts[c]}명
          </span>
        ))}
      </div>

      {dominant && (
        <p className="text-sm text-slate-400">
          <span style={{ color: codeInfo[dominant].color }}>
            {dominant} ({codeInfo[dominant].label})
          </span>{' '}
          성향이 가장 많습니다.
        </p>
      )}

      {missing.length > 0 && (
        <p className="text-sm text-amber-400">
          ⚠️ {missing.map((c) => `${c} (${codeInfo[c].label})`).join(', ')} 성향이 없습니다. 팀 균형을 고려해보세요.
        </p>
      )}
    </div>
  );
}
