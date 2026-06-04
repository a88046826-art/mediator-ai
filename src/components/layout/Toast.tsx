'use client';

import { useAppStore } from '@/store/useAppStore';

export function Toast() {
  const toast = useAppStore((s) => s.toast);
  const hideToast = useAppStore((s) => s.hideToast);

  if (!toast) return null;

  const colors = {
    success: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300',
    error: 'bg-red-500/20 border-red-500/40 text-red-300',
    info: 'bg-accent/20 border-accent/40 text-purple-300',
  };

  return (
    <div
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-5 py-3 rounded-xl border backdrop-blur-sm animate-fadeIn ${colors[toast.type]}`}
      onClick={hideToast}
    >
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
}
