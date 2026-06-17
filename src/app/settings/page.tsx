'use client';

import { useAppStore } from '@/store/useAppStore';

export default function SettingsPage() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-200 mb-1">설정</h1>
      <p className="text-slate-500 text-sm mb-8">앱 환경을 설정합니다.</p>

      {/* 테마 */}
      <section className="card mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">테마</h2>
        <div className="grid grid-cols-2 gap-3">
          {/* 다크 테마 */}
          <button
            onClick={() => setTheme('dark')}
            className={`relative rounded-xl border-2 overflow-hidden transition-all ${
              theme === 'dark' ? 'border-accent' : 'border-border hover:border-accent/40'
            }`}
          >
            {/* 미리보기 */}
            <div className="h-24 bg-[#0a0a14] flex flex-col p-2 gap-1">
              <div className="h-3 w-16 rounded bg-[#1a1a2e]" />
              <div className="h-2 w-24 rounded bg-[#7c3aed]/40" />
              <div className="h-2 w-20 rounded bg-[#1a1a2e]" />
              <div className="mt-auto flex gap-1">
                <div className="h-4 w-10 rounded bg-[#7c3aed]" />
                <div className="h-4 w-10 rounded bg-[#1a1a2e]" />
              </div>
            </div>
            <div className="px-3 py-2 flex items-center justify-between bg-surface">
              <span className="text-sm font-medium text-slate-200">다크</span>
              {theme === 'dark' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-accent">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
          </button>

          {/* Meditor 라이트 테마 */}
          <button
            onClick={() => setTheme('meditor')}
            className={`relative rounded-xl border-2 overflow-hidden transition-all ${
              theme === 'meditor' ? 'border-accent' : 'border-border hover:border-accent/40'
            }`}
          >
            {/* 미리보기 */}
            <div className="h-24 bg-[#f5f7ff] flex flex-col p-2 gap-1">
              <div className="h-3 w-16 rounded bg-[#e0e8ff]" />
              <div className="h-2 w-24 rounded bg-[#4f8ef7]/30" />
              <div className="h-2 w-20 rounded bg-[#e0e8ff]" />
              <div className="mt-auto flex gap-1">
                <div className="h-4 w-10 rounded" style={{ background: 'linear-gradient(135deg,#4f8ef7,#06c2f5)' }} />
                <div className="h-4 w-10 rounded bg-[#e0e8ff]" />
              </div>
            </div>
            <div className="px-3 py-2 flex items-center justify-between bg-surface">
              <span className="text-sm font-medium text-slate-200">Meditor</span>
              {theme === 'meditor' && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-accent">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
          </button>
        </div>
      </section>
    </div>
  );
}
