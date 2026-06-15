'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import type { TranscriptEntry } from '@/types';

export type { TranscriptEntry };

interface Props {
  entries: TranscriptEntry[];
  interimText?: string;
  onDelete?: (id: string) => void;
  onEdit?: (id: string, newText: string) => void;
}

export function LiveTranscript({ entries, interimText, onDelete, onEdit }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);

  // 수정 상태를 ref + state 동시에 관리:
  // ref는 scroll effect 내부에서 동기적으로 읽어 타이밍 어긋남 방지
  const editingIdRef = useRef<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  // ref로 체크하므로 editingId를 deps에 넣지 않아도 항상 최신값 반영
  useEffect(() => {
    if (editingIdRef.current) return; // 수정 중엔 절대 스크롤 안 함
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, interimText]);

  const startEdit = useCallback((id: string, text: string) => {
    editingIdRef.current = id; // ref 먼저 → 이 시점 이후 scroll effect는 모두 차단
    setEditingId(id);
    setEditText(text);
  }, []);

  const commitEdit = useCallback((id: string) => {
    const trimmed = editText.trim();
    if (trimmed && onEdit) onEdit(id, trimmed);
    editingIdRef.current = null;
    setEditingId(null);
  }, [editText, onEdit]);

  const cancelEdit = useCallback(() => {
    editingIdRef.current = null;
    setEditingId(null);
  }, []);

  if (entries.length === 0 && !interimText) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 gap-3">
        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-2xl">
          🎙
        </div>
        <p className="text-slate-400 text-sm">마이크를 켜고 말씀하세요</p>
        <p className="text-slate-600 text-xs">인식된 내용이 여기에 실시간으로 쌓입니다</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex flex-col gap-1.5 p-4 overflow-y-auto h-full"
      style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
    >
      {entries.map((e) => (
        <div key={e.id} className="flex gap-2.5 items-start animate-fadeIn group">
          <span className="shrink-0 w-12 mt-1 text-right text-[10px] font-mono text-slate-600 group-hover:text-slate-500 transition-colors">
            {e.time}
          </span>
          <div className="flex-1 min-w-0">
            {e.speaker && (
              <span className="text-[10px] font-medium text-accent/70 mb-0.5 block">{e.speaker}</span>
            )}
            {editingId === e.id ? (
              <div className="flex gap-1.5 items-center">
                <input
                  // ref callback으로 마운트 즉시 focus — preventScroll로 컨테이너 스크롤 방지
                  ref={(el) => {
                    if (el) {
                      try { el.focus({ preventScroll: true }); } catch { el.focus(); }
                    }
                  }}
                  value={editText}
                  onChange={(ev) => setEditText(ev.target.value)}
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter') commitEdit(e.id);
                    if (ev.key === 'Escape') cancelEdit();
                  }}
                  className="flex-1 bg-white/8 border border-accent/40 rounded px-2 py-0.5 text-sm text-slate-200 outline-none focus:border-accent"
                />
                <button
                  onClick={() => commitEdit(e.id)}
                  className="text-[11px] px-2 py-0.5 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors shrink-0"
                >
                  저장
                </button>
                <button
                  onClick={cancelEdit}
                  className="text-[11px] px-2 py-0.5 rounded text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors shrink-0"
                >
                  취소
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-300 leading-relaxed break-words">{e.text}</p>
            )}
          </div>
          {!editingId && (onEdit || onDelete) && (
            <div className="shrink-0 opacity-0 group-hover:opacity-100 active:opacity-100 flex gap-1 mt-1 transition-all">
              {onEdit && (
                <button
                  onClick={() => startEdit(e.id, e.text)}
                  className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-accent hover:bg-accent/10 transition-colors text-[11px]"
                  title="수정"
                  aria-label="발화 수정"
                >
                  ✎
                </button>
              )}
              {onDelete && (
                <button
                  onClick={() => onDelete(e.id)}
                  className="w-5 h-5 flex items-center justify-center rounded text-slate-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="삭제"
                  aria-label="발화 삭제"
                >
                  ×
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {interimText && (
        <div className="flex gap-2.5 items-start">
          <span className="text-[10px] font-mono text-slate-700 mt-1 shrink-0 w-12 text-right">…</span>
          <div className="flex-1 flex items-center gap-2">
            {interimText === '🎙 말하는 중...' || interimText === '인식 중...' ? (
              <span className="text-xs text-slate-500 flex items-center gap-1.5">
                <span className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1 h-1 rounded-full bg-accent/50 animate-pulse inline-block"
                      style={{ animationDelay: `${i * 0.2}s` }}
                    />
                  ))}
                </span>
                {interimText}
              </span>
            ) : (
              <p className="text-sm text-slate-500 leading-relaxed italic break-words flex-1">{interimText}</p>
            )}
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
