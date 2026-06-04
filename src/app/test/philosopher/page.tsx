import type { Metadata } from 'next';
import PhilosopherPage from '@/app/philosopher/PhilosopherPage';

export const metadata: Metadata = {
  title: 'CODE 철학자 성향 테스트',
  description: '나와 닮은 철학자는 누구? D/O/C/E 성향으로 찾는 나의 사상적 동반자',
};

export default function Page() {
  return <PhilosopherPage />;
}
