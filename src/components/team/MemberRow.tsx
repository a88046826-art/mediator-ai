'use client';

import type { TeamMember, CodeType } from '@/types';
import { codeInfo } from '@/data/typeData';

interface Props {
  member: TeamMember;
  onRemove: (id: string) => void;
}

export function MemberRow({ member, onRemove }: Props) {
  const info = codeInfo[member.code[0] as CodeType] ?? codeInfo['D'];
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-surface2 rounded-xl border border-border">
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
        style={{ backgroundColor: `${info.color}20`, color: info.color }}
      >
        {member.code}
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-200 truncate">{member.name}</p>
        <p className="text-xs text-slate-500">{member.code} · {info.label}</p>
      </div>
      <button
        onClick={() => onRemove(member.id)}
        className="text-slate-600 hover:text-red-400 transition-colors text-lg leading-none"
        aria-label="삭제"
      >
        ×
      </button>
    </div>
  );
}
