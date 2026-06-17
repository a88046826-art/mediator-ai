'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';

const links = [
  { href: '/', label: '홈' },
  { href: '/ai', label: 'AI 중재' },
  { href: '/history', label: '기록' },
];

export function Nav() {
  const pathname = usePathname();
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-bg/80 backdrop-blur-md border-b border-border flex items-center px-4">
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">
          <span className="text-accent">MEDI</span>
          <span className="text-slate-200">ATOR</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  (l.href === '/' ? pathname === '/' : pathname.startsWith(l.href))
                    ? 'bg-accent/20 text-accent'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* 테마 토글 */}
          <div className="flex items-center gap-1 bg-surface2 rounded-lg p-1">
            <button
              onClick={() => setTheme('dark')}
              title="다크 테마"
              className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-all ${
                theme === 'dark'
                  ? 'bg-accent/30 text-accent'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span style={{ fontSize: 13 }}>🌙</span>
            </button>
            <button
              onClick={() => setTheme('meditor')}
              title="Meditor 테마"
              className={`w-6 h-6 rounded-md flex items-center justify-center text-xs transition-all ${
                theme === 'meditor'
                  ? 'bg-accent/30 text-accent'
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span style={{ fontSize: 13 }}>☀️</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
