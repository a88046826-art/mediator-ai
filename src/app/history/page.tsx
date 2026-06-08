'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { MeetingRecord } from '@/types';

function MeetingDetail({ record, onClose }: { record: MeetingRecord; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 overflow-y-auto py-8 px-4">
      <div className="bg-surface rounded-2xl w-full max-w-2xl shadow-xl border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <p className="text-xs text-slate-500">{record.date}</p>
            <h2 className="font-semibold text-slate-200 mt-0.5">{record.topic || '주제 없음'}</h2>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-5">
          {record.teamSummary && (
            <p className="text-xs text-slate-500">👥 {record.teamSummary}</p>
          )}

          {record.transcript.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">대화 기록</p>
              <div className="space-y-1.5 max-h-60 overflow-y-auto">
                {record.transcript.map((e) => (
                  <div key={e.id} className="text-sm text-slate-300">
                    <span className="text-slate-500 font-mono text-xs mr-2">{e.time}</span>
                    {e.speaker && <span className="text-accent text-xs mr-1">{e.speaker}</span>}
                    {e.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {record.aiMessages.length > 0 && (
            <div>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">AI 중재 내용</p>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {record.aiMessages.map((m, i) => (
                  <div key={m.id} className="bg-surface2 rounded-xl px-4 py-3 border border-border text-sm text-slate-300 leading-relaxed">
                    <span className="text-xs text-accent mr-2">[{i + 1}]</span>
                    {m.content}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const meetingHistory = useAppStore((s) => s.meetingHistory);
  const deleteMeeting = useAppStore((s) => s.deleteMeeting);
  const [selected, setSelected] = useState<MeetingRecord | null>(null);

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">회의 기록</h1>
      <p className="text-slate-400 text-sm mb-8">이 기기에 저장된 지난 회의 기록이에요</p>

      {meetingHistory.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-slate-600">
          <p className="text-sm">아직 저장된 회의가 없어요</p>
          <p className="text-xs mt-1">회의 종료 시 자동으로 저장됩니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetingHistory.map((record) => (
            <div
              key={record.id}
              className="card hover:border-accent/40 transition-colors cursor-pointer group"
              onClick={() => setSelected(record)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500 mb-1">{record.date}</p>
                  <p className="font-medium text-slate-200 group-hover:text-accent transition-colors truncate">
                    {record.topic || '주제 없음'}
                  </p>
                  {record.teamSummary && (
                    <p className="text-xs text-slate-500 mt-1 truncate">👥 {record.teamSummary}</p>
                  )}
                  <div className="flex gap-3 mt-2 text-xs text-slate-600">
                    <span>🎙 {record.transcript.length}개 발화</span>
                    <span>🤖 AI {record.aiMessages.length}회</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMeeting(record.id); }}
                  className="shrink-0 p-1.5 text-slate-600 hover:text-red-400 transition-colors"
                  aria-label="삭제"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && <MeetingDetail record={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
