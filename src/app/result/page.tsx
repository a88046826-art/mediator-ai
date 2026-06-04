'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    if (!result) router.replace('/test');
  }, [result, router]);

  if (!result) return null;

  const handleAddToTeam = () => {
    const name = prompt('팀원 이름을 입력하세요');
    if (!name?.trim()) return;
    addTeamMember({ id: Date.now().toString(), name: name.trim(), code: result.primary });
    showToast(`${name} 팀에 추가됨!`, 'success');
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-center mb-6">내 성향 결과</h1>

      <ResultHero result={result} />
      <ResultGrid result={result} />

      <div className="flex flex-col sm:flex-row gap-3 mt-8">
        <button className="btn-secondary flex-1 text-sm" onClick={handleAddToTeam}>
          팀에 추가하기
        </button>
        <Link href="/ai" className="btn-primary flex-1 text-sm text-center">
          AI 중재 받기
        </Link>
        <Link href="/test" className="btn-secondary flex-1 text-sm text-center">
          다시 하기
        </Link>
      </div>
    </div>
  );
}
