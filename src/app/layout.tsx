import type { Metadata } from 'next';
import './globals.css';
import { Nav } from '@/components/layout/Nav';
import { Toast } from '@/components/layout/Toast';
import { ThemeApplier } from '@/components/layout/ThemeApplier';
import { Analytics } from '@vercel/analytics/react';

export const metadata: Metadata = {
  title: 'MEDIATOR | AI 실시간 회의 중재자',
  description: '팀원들이 각자 기기에서 접속하고, AI가 대화를 실시간으로 분석해 갈등을 중재합니다.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* FOUC 방지: 페이지 렌더 전에 저장된 테마 적용 */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){try{var s=localStorage.getItem('mediator-ai-store');if(s){var d=JSON.parse(s);if(d.state&&d.state.theme==='meditor'){document.documentElement.setAttribute('data-theme','meditor');}}}catch(e){}})();
        ` }} />
      </head>
      <body>
        <Analytics />
        <ThemeApplier />
        <Nav />
        <main className="pt-16 min-h-screen">{children}</main>
        <Toast />
      </body>
    </html>
  );
}
