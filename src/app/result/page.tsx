'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppStore } from '@/store/useAppStore';
import { ResultHero } from '@/components/result/ResultHero';
import { ResultGrid } from '@/components/result/ResultGrid';

export default function ResultPage() {
  const router = useRouter();
  const result = useAppStore((s) => s.testResult);
  const addTeamMember = useAppStore((s) => s.addTeamMember);
  const showToast = useAppStore((s) => s.showToast);

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!result) router.replace('/test');
  }, [result, router]);

  useEffect(() => {
    if (modalOpen) {
      setName('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [modalOpen]);

  if (!result) return null;

  const handleConfirm = () => {
    if (!name.trim()) return;
    addTeamMember({ id: Date.now().toString(), name: name.trim(), code: result.typeKey });
    showToast(`${name.trim()} 팀에 추가됨!`, 'success');
    setModalOpen(false);
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
          onClick={() => setModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-80 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold mb-4">팀원 이름 입력</h2>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleConfirm()}
              placeholder="이름을 입력하세요"
              className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 mt-4">
              <button
                className="btn-secondary flex-1 text-sm"
                onClick={() => setModalOpen(false)}
              >
                취소
              </button>
              <button
                className="btn-primary flex-1 text-sm"
                onClick={handleConfirm}
                disabled={!name.trim()}
              >
                추가
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
