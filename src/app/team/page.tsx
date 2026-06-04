'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { CodeType } from '@/types';
import { codeInfo } from '@/data/typeData';
import { MemberRow } from '@/components/team/MemberRow';
import { TeamRadarChart } from '@/components/team/TeamRadarChart';
import { TeamInsight } from '@/components/team/TeamInsight';

const CODES: CodeType[] = ['D', 'O', 'C', 'E'];

export default function TeamPage() {
  const teamMembers = useAppStore((s) => s.teamMembers);
  const addTeamMember = useAppStore((s) => s.addTeamMember);
  const removeTeamMember = useAppStore((s) => s.removeTeamMember);
  const clearTeamMembers = useAppStore((s) => s.clearTeamMembers);
  const showToast = useAppStore((s) => s.showToast);

  const [name, setName] = useState('');
  const [code, setCode] = useState<CodeType>('D');

  const handleAdd = () => {
    if (!name.trim()) {
      showToast('이름을 입력하세요', 'error');
      return;
    }
    addTeamMember({ id: Date.now().toString(), name: name.trim(), code });
    showToast(`${name.trim()} 추가됨!`, 'success');
    setName('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">팀 구성 분석</h1>
      <p className="text-slate-400 text-sm mb-8">팀원을 추가하고 성향 균형을 확인하세요</p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: add & list */}
        <div className="space-y-4">
          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-200">팀원 추가</h3>
            <input
              className="input-base w-full text-sm"
              placeholder="팀원 이름"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <div className="flex gap-2">
              {CODES.map((c) => (
                <button
                  key={c}
                  onClick={() => setCode(c)}
                  className="flex-1 py-2 rounded-lg text-sm font-semibold border transition-all"
                  style={
                    code === c
                      ? { backgroundColor: `${codeInfo[c].color}25`, color: codeInfo[c].color, borderColor: `${codeInfo[c].color}50` }
                      : { backgroundColor: 'transparent', color: '#64748b', borderColor: 'rgba(167,139,250,0.12)' }
                  }
                >
                  {c}
                </button>
              ))}
            </div>
            <button className="btn-primary w-full text-sm" onClick={handleAdd}>
              + 추가
            </button>
          </div>

          {teamMembers.length > 0 && (
            <div className="space-y-2">
              {teamMembers.map((m) => (
                <MemberRow key={m.id} member={m} onRemove={removeTeamMember} />
              ))}
              <button
                className="text-xs text-slate-600 hover:text-red-400 transition-colors mt-1"
                onClick={() => clearTeamMembers()}
              >
                전체 삭제
              </button>
            </div>
          )}

          {teamMembers.length === 0 && (
            <p className="text-center text-slate-600 text-sm py-8">아직 팀원이 없습니다</p>
          )}
        </div>

        {/* Right: chart & insight */}
        <div className="space-y-4">
          {teamMembers.length >= 2 ? (
            <>
              <TeamRadarChart members={teamMembers} />
              <TeamInsight members={teamMembers} />
            </>
          ) : (
            <div className="card flex flex-col items-center justify-center h-48 text-slate-600">
              <p className="text-sm">팀원을 2명 이상 추가하면</p>
              <p className="text-sm">레이더 차트가 표시됩니다</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
