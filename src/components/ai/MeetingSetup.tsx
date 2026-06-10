'use client';

import { useState, useCallback, useRef } from 'react';
import type { TeamMember } from '@/types';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';

interface Props {
  members: TeamMember[];
  onStart: (context: string) => void;
}

const FIELDS = [
  {
    key: 'purpose' as const,
    icon: '🎯',
    label: '목적',
    sub: '이 회의로 뭘 결정/해결할 건지',
    placeholder: '예) 다음 분기 마케팅 예산 배분을 결정하기 위해',
  },
  {
    key: 'background' as const,
    icon: '📋',
    label: '배경/맥락',
    sub: '왜 이 회의가 필요한지',
    placeholder: '예) 팀 간 의견 차이가 생겨서 조율이 필요한 상황',
  },
  {
    key: 'outcome' as const,
    icon: '✅',
    label: '원하는 결과물',
    sub: '회의 끝나면 뭐가 나와야 하는지',
    placeholder: '예) 최종 결론 1개, 실행 계획 3가지',
  },
] as const;

type FieldKey = typeof FIELDS[number]['key'];
type Suggestion = Record<FieldKey, string>;

const SUGGEST_SYSTEM = `사용자가 회의 주제나 상황을 설명하면 아래 3가지 항목을 채워주세요.

반드시 아래 형식 그대로 3줄로만 반환하세요. 다른 말 금지.
목적: [한 문장 — 무엇을 결정/해결할 건지]
배경: [한 문장 — 왜 이 회의가 필요한지]
결과물: [한 문장 — 회의 끝나면 나와야 할 것]

짧고 구체적으로. 한국어.`;

async function fetchSuggestion(userText: string): Promise<Suggestion> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: SUGGEST_SYSTEM,
      messages: [{ role: 'user', content: userText }],
      maxTokens: 200,
    }),
  });
  const data = await res.json() as { content?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? 'API error');

  const text = data.content ?? '';
  const get = (prefix: string) => {
    const line = text.split('\n').find((l) => l.startsWith(prefix));
    return line ? line.slice(prefix.length).trim() : '';
  };
  return {
    purpose:    get('목적:'),
    background: get('배경:'),
    outcome:    get('결과물:'),
  };
}

export function MeetingSetup({ members, onStart }: Props) {
  const [values, setValues] = useState<Record<FieldKey, string>>({ purpose: '', background: '', outcome: '' });
  const [hint, setHint] = useState('');
  const [interimText, setInterimText] = useState('');
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [appliedAll, setAppliedAll] = useState(false);
  const hintRef = useRef<HTMLTextAreaElement>(null);

  const set = (key: FieldKey, val: string) => setValues((prev) => ({ ...prev, [key]: val }));

  const handleVoiceResult = useCallback((text: string) => {
    setHint((prev) => prev ? `${prev} ${text}` : text);
    setInterimText('');
  }, []);

  const { isListening, isSupported, toggle } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onInterim: setInterimText,
    onError: () => {},
  });

  const handleSuggest = async () => {
    const text = hint.trim();
    if (!text || isFetching) return;
    if (isListening) toggle();
    setIsFetching(true);
    setSuggestion(null);
    setAppliedAll(false);
    try {
      const s = await fetchSuggestion(text);
      setSuggestion(s);
    } catch {
      /* silent */
    } finally {
      setIsFetching(false);
    }
  };

  const applyOne = (key: FieldKey) => {
    if (!suggestion?.[key]) return;
    set(key, suggestion[key]);
  };

  const applyAll = () => {
    if (!suggestion) return;
    setValues({ purpose: suggestion.purpose, background: suggestion.background, outcome: suggestion.outcome });
    setAppliedAll(true);
  };

  const handleStart = () => {
    const parts: string[] = [];
    if (values.purpose.trim())    parts.push(`목적: ${values.purpose.trim()}`);
    if (values.background.trim()) parts.push(`배경: ${values.background.trim()}`);
    if (values.outcome.trim())    parts.push(`결과물: ${values.outcome.trim()}`);
    setIsStarting(true);
    onStart(parts.join('\n'));
  };

  const hasAny = Object.values(values).some((v) => v.trim());

  return (
    <div className="card max-w-xl mx-auto space-y-5">
      <div>
        <h3 className="font-semibold text-slate-200 mb-0.5">회의 설정</h3>
        <p className="text-xs text-slate-500">아는 것만 채워도 괜찮아요. 3가지 모두 채울수록 AI가 더 잘 중재합니다.</p>
      </div>

      {members.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {members.map((m) => (
            <span key={m.id} className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
              {m.name}
            </span>
          ))}
        </div>
      )}

      {/* ── AI 추천 구역 ── */}
      <div className="rounded-xl border border-accent/25 bg-accent/5 p-4 space-y-3">
        <p className="text-xs font-medium text-accent">✨ AI가 채워줄게요</p>
        <p className="text-xs text-slate-400 -mt-1">관심 분야나 원하는 방향을 자유롭게 말하면 3가지 항목을 추천해드려요.</p>

        <div className="relative">
          <textarea
            ref={hintRef}
            className="input-base w-full text-sm resize-none pr-10"
            rows={2}
            placeholder={isListening ? '말씀하세요...' : '예) 런칭 전 기능 범위 조율이 필요해. 개발팀이랑 기획팀 의견이 달라.'}
            value={hint + (interimText ? (hint ? ' ' : '') + interimText : '')}
            onChange={(e) => {
              // interimText가 합쳐져 표시될 뿐이므로 hint만 업데이트
              if (!isListening) setHint(e.target.value);
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSuggest(); } }}
            disabled={isStarting}
          />
          {isSupported && (
            <button
              type="button"
              onClick={toggle}
              disabled={isStarting}
              className={`absolute right-2 bottom-2 w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                isListening
                  ? 'bg-red-500/20 text-red-400 border border-red-500/40 animate-pulse'
                  : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
              title={isListening ? '녹음 중지' : '음성 입력'}
            >
              <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm-1 14.93V19h-2v2h6v-2h-2v-1.07A7.003 7.003 0 0 0 19 11h-2a5 5 0 0 1-10 0H5a7.003 7.003 0 0 0 6 6.93z"/>
              </svg>
            </button>
          )}
        </div>

        <button
          className="btn-secondary w-full text-xs py-1.5 disabled:opacity-40"
          onClick={handleSuggest}
          disabled={!hint.trim() || isFetching || isStarting}
        >
          {isFetching ? (
            <span className="flex items-center justify-center gap-1.5">
              {[0,1,2].map((i) => (
                <span key={i} className="w-1 h-1 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          ) : '추천 받기'}
        </button>

        {/* 추천 결과 */}
        {suggestion && (
          <div className="space-y-2 pt-1">
            <div className="h-px bg-border" />
            {FIELDS.map((f) => (
              suggestion[f.key] ? (
                <div key={f.key} className="flex items-start gap-2">
                  <span className="text-xs mt-0.5 shrink-0">{f.icon}</span>
                  <p className="text-xs text-slate-300 leading-relaxed flex-1">{suggestion[f.key]}</p>
                  <button
                    type="button"
                    onClick={() => applyOne(f.key)}
                    className="shrink-0 text-[10px] px-2 py-0.5 rounded bg-accent/15 text-accent hover:bg-accent/25 transition-colors border border-accent/20"
                  >
                    쓰기
                  </button>
                </div>
              ) : null
            ))}
            {!appliedAll && (
              <button
                type="button"
                onClick={applyAll}
                className="w-full text-xs py-1.5 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors border border-accent/20 mt-1"
              >
                3개 모두 적용
              </button>
            )}
            {appliedAll && (
              <p className="text-xs text-center text-slate-500">아래 칸에 적용됐어요. 수정해도 됩니다.</p>
            )}
          </div>
        )}
      </div>

      {/* ── 3가지 직접 입력 ── */}
      <div className="space-y-4">
        {FIELDS.map((f) => (
          <div key={f.key} className="space-y-1.5">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base leading-none">{f.icon}</span>
              <span className="text-sm font-medium text-slate-200">{f.label}</span>
              <span className="text-xs text-slate-500">{f.sub}</span>
            </div>
            <textarea
              className="input-base w-full text-sm resize-none"
              rows={2}
              placeholder={f.placeholder}
              value={values[f.key]}
              onChange={(e) => set(f.key, e.target.value)}
              disabled={isStarting}
            />
          </div>
        ))}
      </div>

      <button
        className="btn-primary w-full py-3 text-sm disabled:opacity-40"
        onClick={handleStart}
        disabled={isStarting}
      >
        {isStarting ? '준비 중...' : hasAny ? '회의 시작하기 →' : '주제 없이 시작하기 →'}
      </button>
    </div>
  );
}
