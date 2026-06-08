'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/store/useAppStore';
import { ResultHero } from '@/components/result/ResultHero';
import { ResultGrid } from '@/components/result/ResultGrid';
import { generateShareCode } from '@/lib/shareCode';

export default function ResultPage() {
  const router = useRouter();
  const result = useAppStore((s) => s.testResult);
  const addTeamMember = useAppStore((s) => s.addTeamMember);
  const showToast = useAppStore((s) => s.showToast);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [shareCode, setShareCode] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!result) router.replace('/test');
  }, [result, router]);

  useEffect(() => {
    if (modalOpen) {
      setName('');
      setShareCode('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [modalOpen]);

  if (!result) return null;

  const handleConfirm = () => {
    if (!name.trim()) return;
    const trimmed = name.trim();
    addTeamMember({ id: Date.now().toString(), name: trimmed, code: result.typeKey });
    setShareCode(generateShareCode(trimmed, result.typeKey));
  };

  const inviteUrl = shareCode
    ? `${window.location.origin}/team?code=${shareCode}`
    : '';

  const handleCopyCode = async () => {
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

      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <button className="btn-secondary flex-1 text-sm" onClick={() => setModalOpen(true)}>
          팀에 추가하기
        </button>
        <Link href="/ai" className="btn-primary flex-1 text-sm text-center">
          AI 중재 받기
        </Link>
        <Link href="/test" className="btn-secondary flex-1 text-sm text-center">
          다시 하기
        </Link>
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
                <div className="text-center mb-4">
                  <div className="text-2xl mb-2">✅</div>
                  <h2 className="text-base font-semibold text-slate-200">팀에 추가됐어요!</h2>
                  <p className="text-xs text-slate-500 mt-1">링크를 팀원들에게 공유하세요</p>
                </div>
                <div className="bg-surface2 rounded-xl px-4 py-3 mb-3 border border-border">
                  <p className="text-[10px] text-slate-500 mb-1">초대 링크</p>
                  <p className="text-xs font-mono text-accent break-all">{inviteUrl}</p>
                </div>
                <button className="btn-primary w-full text-sm mb-2" onClick={handleCopyCode}>링크 복사</button>
                <button className="btn-secondary w-full text-sm" onClick={() => setModalOpen(false)}>닫기</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
