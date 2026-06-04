import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/layout/Nav';
import { Toast } from '@/components/layout/Toast';

export const metadata: Metadata = {
  title: 'CODETEST | 팀 성향 진단 & AI 중재자',
  description: '팀원 성향을 진단하고, AI 중재자가 회의 갈등을 해결합니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>
        <Nav />
        <main className="pt-16 min-h-screen">{children}</main>
        <Toast />
      </body>
    </html>
  );
}
