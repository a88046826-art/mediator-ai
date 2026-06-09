'use client';

import { useEffect } from 'react';

export default function AiError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AI Page Error]', error);
  }, [error]);

  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-4">
      <p className="text-2xl">⚠️</p>
      <h2 className="text-lg font-semibold text-slate-200">페이지 오류</h2>
      <p className="text-sm text-slate-400">
        {error?.message || '알 수 없는 오류가 발생했어요.'}
      </p>
      {error?.stack && (
        <pre className="text-left text-[10px] text-slate-600 bg-surface2 border border-border rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap">
          {error.stack}
        </pre>
      )}
      <button
        onClick={reset}
        className="btn-primary text-sm px-6 py-2"
      >
        다시 시도
      </button>
    </div>
  );
}
