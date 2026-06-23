'use client';

import { useState } from 'react';

export type SurveyQuestion = {
  id: string;
  text: string;
  type: 'single' | 'multi' | 'rating' | 'text';
  options?: string[];
  optional?: boolean;
};

type Props = {
  title: string;
  subtitle: string;
  questions: SurveyQuestion[];
  onSubmit: (answers: Record<string, string | string[]>) => void;
  onSkip: () => void;
};

export function SurveyModal({ title, subtitle, questions, onSubmit, onSkip }: Props) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});

  const q = questions[step];
  const isLast = step === questions.length - 1;
  const current = answers[q.id];

  const canProceed = q.optional
    ? true
    : q.type === 'multi'
    ? Array.isArray(current) && current.length > 0
    : typeof current === 'string' && current.length > 0;

  function toggleMulti(option: string) {
    const prev = (answers[q.id] as string[] | undefined) ?? [];
    const next = prev.includes(option) ? prev.filter((o) => o !== option) : [...prev, option];
    setAnswers({ ...answers, [q.id]: next });
  }

  function selectSingle(option: string) {
    setAnswers({ ...answers, [q.id]: option });
  }

  function handleNext() {
    if (!canProceed) return;
    if (isLast) {
      onSubmit(answers);
    } else {
      setStep(step + 1);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border/40">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-widest text-slate-500 mb-1">{subtitle}</p>
              <h2 className="text-base font-bold text-slate-200">{title}</h2>
            </div>
            <button
              onClick={onSkip}
              className="text-xs text-slate-500 hover:text-slate-400 transition-colors mt-0.5"
            >
              건너뛰기
            </button>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / questions.length) * 100}%` }}
            />
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5">{step + 1} / {questions.length}</p>
        </div>

        {/* Question */}
        <div className="px-5 py-5 flex-1">
          <p className="text-sm font-semibold text-slate-200 mb-4 leading-snug">{q.text}</p>

          {/* Single choice */}
          {q.type === 'single' && q.options && (
            <div className="flex flex-col gap-2">
              {q.options.map((opt) => (
                <button
                  key={opt}
                  onClick={() => selectSingle(opt)}
                  className={`text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all ${
                    current === opt
                      ? 'border-accent bg-accent/10 text-slate-100'
                      : 'border-border text-slate-400 hover:border-accent/40 hover:text-slate-300'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {/* Multi choice */}
          {q.type === 'multi' && q.options && (
            <div className="flex flex-col gap-2">
              {q.options.map((opt) => {
                const selected = (current as string[] | undefined)?.includes(opt) ?? false;
                return (
                  <button
                    key={opt}
                    onClick={() => toggleMulti(opt)}
                    className={`text-left px-3.5 py-2.5 rounded-xl border text-sm transition-all flex items-center gap-2.5 ${
                      selected
                        ? 'border-accent bg-accent/10 text-slate-100'
                        : 'border-border text-slate-400 hover:border-accent/40 hover:text-slate-300'
                    }`}
                  >
                    <span className={`w-4 h-4 shrink-0 rounded border flex items-center justify-center transition-colors ${
                      selected ? 'border-accent bg-accent' : 'border-border'
                    }`}>
                      {selected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </span>
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {/* Rating 1–5 */}
          {q.type === 'rating' && (
            <div className="flex gap-2 justify-center mt-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => selectSingle(String(n))}
                  className={`w-11 h-11 rounded-xl border text-sm font-bold transition-all ${
                    current === String(n)
                      ? 'border-accent bg-accent text-white'
                      : 'border-border text-slate-400 hover:border-accent/40 hover:text-slate-300'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {/* Text input */}
          {q.type === 'text' && (
            <textarea
              className="w-full h-28 bg-bg border border-border rounded-xl px-3.5 py-2.5 text-sm text-slate-200 placeholder:text-slate-600 resize-none focus:outline-none focus:border-accent/60 transition-colors"
              placeholder={q.optional ? '선택 입력 (건너뛰어도 됩니다)' : '입력해 주세요'}
              value={(current as string) ?? ''}
              onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })}
            />
          )}
        </div>

        {/* Footer */}
        <div className="px-5 pb-5">
          <button
            onClick={handleNext}
            disabled={!canProceed}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all bg-accent text-white disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
          >
            {isLast ? '제출' : '다음'}
          </button>
        </div>
      </div>
    </div>
  );
}
