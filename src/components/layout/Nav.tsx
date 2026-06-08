'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/', label: '홈' },
  { href: '/test', label: '진단' },
  { href: '/team', label: '팀' },
  { href: '/ai', label: 'AI 중재' },
  { href: '/history', label: '기록' },
];

export function Nav() {
  const pathname = usePathname();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-16 bg-bg/80 backdrop-blur-md border-b border-border flex items-center px-4">
      <div className="max-w-5xl mx-auto w-full flex items-center justify-between">
        <Link href="/" className="font-bold text-lg tracking-tight">
          <span className="text-accent">CODE</span>
          <span className="text-slate-200">TEST</span>
        </Link>
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
      </div>
    </nav>
  );
}
