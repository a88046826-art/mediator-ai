'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { questions } from '@/data/questions';
import type { CodeType } from '@/types';
import { calcResult } from '@/utils/calcResult';
import { useAppStore } from '@/store/useAppStore';
import { EscapeTheme } from '@/components/test/EscapeTheme';
import { ProgressBar } from '@/components/test/ProgressBar';
import { QuestionCard } from '@/components/test/QuestionCard';
import { LoadingOverlay } from '@/components/layout/LoadingOverlay';

type Phase = 'intro' | 'quiz' | 'loading';

export default function TestPage() {
  const router = useRouter();
  const setTestResult = useAppStore((s) => s.setTestResult);

  const [phase, setPhase] = useState<Phase>('intro');
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});

  const question = questions[current];

  const handleAnswer = (v: number) => {
    const next = { ...answers, [question.id]: v };
    setAnswers(next);

    if (current < questions.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      finishTest(next);
    }
  };

  const finishTest = (ans: Record<number, number>) => {
    setPhase('loading');
    const scores = questions.reduce(
      (acc, q) => {
        acc[q.code] = (acc[q.code] ?? 0) + (ans[q.id] ?? 0);
        return acc;
      },
      {} as Record<CodeType, number>
    );
    const result = calcResult(scores);
    setTestResult(result);
    setTimeout(() => router.push('/result'), 1200);
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <LoadingOverlay show={phase === 'loading'} label="결과 분석 중..." />

      {phase === 'intro' && <EscapeTheme onStart={() => setPhase('quiz')} />}

      {phase === 'quiz' && (
        <>
          <ProgressBar current={current + 1} total={questions.length} />
          <QuestionCard
            key={question.id}
            question={question}
            value={answers[question.id] ?? 0}
            onChange={handleAnswer}
          />
          <div className="flex justify-between mt-6 max-w-xl mx-auto">
            <button
              className="btn-secondary text-sm px-5 py-2.5"
              disabled={current === 0}
              onClick={() => setCurrent((c) => c - 1)}
            >
              ← 이전
            </button>
            <button
              className="btn-secondary text-sm px-5 py-2.5"
              disabled={!answers[question.id]}
              onClick={() => {
                if (current < questions.length - 1) {
                  setCurrent((c) => c + 1);
                } else {
                  finishTest(answers);
                }
              }}
            >
              {current === questions.length - 1 ? '완료' : '다음 →'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
