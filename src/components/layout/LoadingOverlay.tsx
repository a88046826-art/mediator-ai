'use client';

interface Props {
  show: boolean;
  label?: string;
}

export function LoadingOverlay({ show, label = '분석 중...' }: Props) {
  if (!show) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg/90 backdrop-blur-sm">
      <div className="flex gap-1 mb-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-1.5 h-8 bg-accent rounded-full animate-waveAnim"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <p className="text-slate-400 text-sm">{label}</p>
    </div>
  );
}
