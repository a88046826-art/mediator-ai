'use client';

import { useEffect, useRef } from 'react';
import type { TeamMember, CodeType } from '@/types';
import { codeInfo } from '@/data/typeData';

interface Props {
  members: TeamMember[];
}

const CODES: CodeType[] = ['D', 'O', 'C', 'E'];

export function TeamRadarChart({ members }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Dynamically import Chart.js to avoid SSR issues
    import('chart.js').then(({ Chart, RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip }) => {
      Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip);

      const counts = CODES.reduce((acc, c) => {
        acc[c] = members.filter((m) => m.code[0] === c).length;
        return acc;
      }, {} as Record<CodeType, number>);

      const existing = Chart.getChart(canvas);
      if (existing) existing.destroy();

      new Chart(canvas, {
        type: 'radar',
        data: {
          labels: CODES.map((c) => `${c} (${codeInfo[c].label})`),
          datasets: [
            {
              label: '팀 성향 분포',
              data: CODES.map((c) => counts[c]),
              backgroundColor: 'rgba(124,58,237,0.15)',
              borderColor: 'rgba(124,58,237,0.8)',
              pointBackgroundColor: CODES.map((c) => codeInfo[c].color),
              pointRadius: 5,
              borderWidth: 2,
            },
          ],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              beginAtZero: true,
              ticks: { stepSize: 1, color: '#64748b', font: { size: 10 } },
              grid: { color: 'rgba(255,255,255,0.06)' },
              pointLabels: { color: '#94a3b8', font: { size: 12 } },
            },
          },
        },
      });
    });
  }, [members]);

  return (
    <div className="card flex flex-col items-center">
      <h3 className="font-semibold text-slate-200 mb-4">팀 성향 레이더</h3>
      <canvas ref={canvasRef} width={300} height={300} />
    </div>
  );
}
