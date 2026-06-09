'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import type { CodeType } from '@/types';
import { codeInfo } from '@/data/typeData';
import { MemberRow } from '@/components/team/MemberRow';
import { TeamRadarChart } from '@/components/team/TeamRadarChart';
import { TeamInsight } from '@/components/team/TeamInsight';
import { decodeShareCode } from '@/lib/shareCode';

const CODES: CodeType[] = ['D', 'O', 'C', 'E'];

function InviteCodeHandler() {
  const searchParams = useSearchParams();
  const addTeamMember = useAppStore((s) => s.addTeamMember);
  const teamMembers = useAppStore((s) => s.teamMembers);
  const showToast = useAppStore((s) => s.showToast);

  useEffect(() => {
    const urlCode = searchParams.get('code');
    if (!urlCode) return;
    const decoded = decodeShareCode(urlCode);
    if (!decoded) return;
    const alreadyIn = teamMembers.some((m) => m.name === decoded.name && m.code === decoded.typeKey);
    if (!alreadyIn) {
      addTeamMember({ id: Date.now().toString(), name: decoded.name, code: decoded.typeKey as CodeType });
      showToast(`${decoded.name} 팀에 추가됐어요!`, 'success');
    }
    window.history.replaceState({}, '', '/team');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function TeamPage() {
  const teamMembers = useAppStore((s) => s.teamMembers);
  const addTeamMember = useAppStore((s) => s.addTeamMember);
  const removeTeamMember = useAppStore((s) => s.removeTeamMember);
  const clearTeamMembers = useAppStore((s) => s.clearTeamMembers);
  const showToast = useAppStore((s) => s.showToast);

  const [name, setName] = useState('');
  const [code, setCode] = useState<CodeType>('D');
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [pendingType, setPendingType] = useState(''); // 짧은 코드 입력 시 typeKey 임시 저장
  const [pendingName, setPendingName] = useState('');

  const handleAdd = () => {
    if (!name.trim()) {
      showToast('이름을 입력하세요', 'error');
      return;
    }
    addTeamMember({ id: Date.now().toString(), name: name.trim(), code });
    showToast(`${name.trim()} 추가됨!`, 'success');
    setName('');
  };

  const handleCodeAdd = () => {
    setJoinError('');
    const decoded = decodeShareCode(joinCode);
    if (!decoded) {
      setJoinError('올바르지 않은 코드예요');
      return;
    }
    if (decoded.name) {
      // base64 URL 코드 — 이름 포함
      addTeamMember({ id: Date.now().toString(), name: decoded.name, code: decoded.typeKey });
      showToast(`${decoded.name} 추가됨!`, 'success');
      setJoinCode('');
    } else {
      // 짧은 코드 — 이름 없음, 별도 입력 필요
      setPendingType(decoded.typeKey);
      setPendingName('');
    }
  };

  const handlePendingAdd = () => {
    if (!pendingName.trim()) return;
    addTeamMember({ id: Date.now().toString(), name: pendingName.trim(), code: pendingType });
    showToast(`${pendingName.trim()} 추가됨!`, 'success');
    setPendingType('');
    setPendingName('');
    setJoinCode('');
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <Suspense>
        <InviteCodeHandler />
      </Suspense>

      <h1 className="text-2xl font-bold mb-2">팀 구성 분석</h1>
      <p className="text-slate-400 text-sm mb-8">팀원을 추가하고 성향 균형을 확인하세요</p>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Left: add & list */}
        <div className="space-y-4">
          {/* 코드로 추가 */}
          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-200">코드로 추가</h3>
            <p className="text-xs text-slate-500">팀원이 공유한 코드를 입력하세요</p>

            {!pendingType ? (
              <>
                <div className="flex gap-2">
                  <input
                    className="input-base flex-1 text-sm font-mono tracking-widest"
                    placeholder="예) 483921F"
                    value={joinCode}
                    onChange={(e) => { setJoinCode(e.target.value.toUpperCase()); setJoinError(''); }}
                    onKeyDown={(e) => e.key === 'Enter' && handleCodeAdd()}
                    maxLength={40}
                  />
                  <button className="btn-primary px-4 text-sm shrink-0" onClick={handleCodeAdd}>확인</button>
                </div>
                {joinError && <p className="text-xs text-red-400">{joinError}</p>}
              </>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2 bg-accent/10 rounded-lg px-3 py-2 border border-accent/30">
                  <span className="font-mono font-bold text-accent tracking-widest">{joinCode}</span>
                  <span className="text-xs text-slate-400">→ {pendingType} 타입 확인됨</span>
                </div>
                <input
                  className="input-base w-full text-sm"
                  placeholder="이 팀원의 이름을 입력하세요"
                  value={pendingName}
                  onChange={(e) => setPendingName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handlePendingAdd()}
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    className="btn-secondary flex-1 text-sm"
                    onClick={() => { setPendingType(''); setPendingName(''); }}
                  >
                    취소
                  </button>
                  <button
                    className="btn-primary flex-1 text-sm"
                    onClick={handlePendingAdd}
                    disabled={!pendingName.trim()}
                  >
                    추가
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="card space-y-3">
            <h3 className="font-semibold text-slate-200">직접 추가</h3>
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
