'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/store/useAppStore';
import { ResultHero } from '@/components/result/ResultHero';
import { ResultGrid } from '@/components/result/ResultGrid';
import { generateShareCode, generateInviteCode } from '@/lib/shareCode';

export default function ResultPage() {
  const router = useRouter();
  const result = useAppStore((s) => s.testResult);
  const addTeamMember = useAppStore((s) => s.addTeamMember);
  const showToast = useAppStore((s) => s.showToast);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [shareCode, setShareCode] = useState('');   // 짧은 코드: "483921F"
  const [inviteCode, setInviteCode] = useState(''); // base64 (URL용)
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!result) router.replace('/test');
  }, [result, router]);

  useEffect(() => {
    if (modalOpen) {
      setName('');
      setShareCode('');
      setInviteCode('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [modalOpen]);

  if (!result) return null;

  const handleConfirm = () => {
    if (!name.trim()) return;
    const trimmed = name.trim();
    addTeamMember({ id: Date.now().toString(), name: trimmed, code: result.typeKey });
    setShareCode(generateShareCode(result.typeKey));
    setInviteCode(generateInviteCode(trimmed, result.typeKey));
  };

  const inviteUrl = inviteCode ? `${window.location.origin}/team?code=${inviteCode}` : '';

  const handleCopyShortCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      showToast('코드 복사됨!', 'success');
    } catch {
      showToast('복사 실패', 'error');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      showToast('초대 링크 복사됨!', 'success');
    } catch {
      showToast('복사 실패', 'error');
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-center mb-6">내 성향 결과</h1>

      <ResultHero result={result} />
      <ResultGrid result={result} />

      <div className="flex flex-col gap-3 mt-8">
        <button className="btn-primary w-full py-4 text-sm" onClick={() => setModalOpen(true)}>
          팀에 추가하고 초대 코드 받기 →
        </button>
        <div className="flex gap-3">
          <Link href="/ai" className="btn-secondary flex-1 text-sm text-center py-2.5">
            AI 중재 시작하기
          </Link>
          <Link href="/test/code" className="btn-secondary flex-1 text-sm text-center py-2.5">
            다시 하기
          </Link>
        </div>
      </div>

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => !shareCode && setModalOpen(false)}
        >
          <div
            className="bg-surface rounded-2xl p-6 w-80 shadow-xl border border-border"
            onClick={(e) => e.stopPropagation()}
          >
            {!shareCode ? (
              <>
                <h2 className="text-lg font-semibold mb-1 text-slate-200">내 이름 입력</h2>
                <p className="text-xs text-slate-500 mb-4">팀에서 표시될 이름을 입력하세요</p>
                <input
                  ref={inputRef}
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
                  placeholder="이름을 입력하세요"
                  className="input-base w-full text-sm"
                />
                <div className="flex gap-2 mt-4">
                  <button className="btn-secondary flex-1 text-sm" onClick={() => setModalOpen(false)}>취소</button>
                  <button className="btn-primary flex-1 text-sm" onClick={handleConfirm} disabled={!name.trim()}>확인</button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-5">
                  <div className="text-2xl mb-2">✅</div>
                  <h2 className="text-base font-semibold text-slate-200">팀에 추가됐어요!</h2>
                </div>

                {/* 짧은 코드 */}
                <div className="mb-3">
                  <p className="text-[10px] text-slate-500 mb-1.5">내 코드 — 같은 자리라면 불러주세요</p>
                  <div className="flex items-center gap-2 bg-surface2 rounded-xl px-4 py-3 border border-border">
                    <span className="font-mono text-xl font-bold text-accent tracking-widest flex-1">
                      {shareCode}
                    </span>
                    <button
                      onClick={handleCopyShortCode}
                      className="text-xs text-slate-400 hover:text-accent transition-colors shrink-0"
                    >
                      복사
                    </button>
                  </div>
                </div>

                {/* 초대 링크 */}
                <div className="mb-4">
                  <p className="text-[10px] text-slate-500 mb-1.5">초대 링크 — 카카오톡 등으로 보내세요</p>
                  <div className="bg-surface2 rounded-xl px-4 py-3 border border-border">
                    <p className="text-[10px] font-mono text-slate-500 break-all leading-relaxed">{inviteUrl}</p>
                  </div>
                </div>

                <button className="btn-primary w-full text-sm mb-2" onClick={handleCopyLink}>
                  초대 링크 복사
                </button>
                <button className="btn-secondary w-full text-sm" onClick={() => setModalOpen(false)}>닫기</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
