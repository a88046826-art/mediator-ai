'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { MemberRow } from '@/components/team/MemberRow';

export default function TeamPage() {
  const teamMembers = useAppStore((s) => s.teamMembers);
  const addTeamMember = useAppStore((s) => s.addTeamMember);
  const removeTeamMember = useAppStore((s) => s.removeTeamMember);
  const clearTeamMembers = useAppStore((s) => s.clearTeamMembers);
  const showToast = useAppStore((s) => s.showToast);

  const [name, setName] = useState('');

  const handleAdd = () => {
    if (!name.trim()) {
      showToast('이름을 입력하세요', 'error');
      return;
    }
    addTeamMember({ id: Date.now().toString(), name: name.trim() });
    showToast(`${name.trim()} 추가됨!`, 'success');
    setName('');
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">팀 구성</h1>
      <p className="text-slate-400 text-sm mb-8">회의에 참여할 팀원을 추가하세요. 발화자 구분에 사용됩니다.</p>

      <div className="card space-y-3 mb-6">
        <h3 className="font-semibold text-slate-200">팀원 추가</h3>
        <div className="flex gap-2">
          <input
            className="input-base flex-1 text-sm"
            placeholder="팀원 이름"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <button className="btn-primary px-4 text-sm shrink-0" onClick={handleAdd}>
            + 추가
          </button>
        </div>
      </div>

      {teamMembers.length > 0 ? (
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
      ) : (
        <p className="text-center text-slate-600 text-sm py-8">아직 팀원이 없습니다</p>
      )}
    </div>
  );
}
