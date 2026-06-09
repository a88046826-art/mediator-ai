'use client';

import { useState, useRef, useCallback } from 'react';
import type { TeamMember } from '@/types';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';

interface Props {
  members: TeamMember[];
  onStart: (context: string) => void;
}

type SetupMessage = { role: 'user' | 'ai'; text: string };

const SETUP_SYSTEM = `당신은 회의 준비를 돕는 AI입니다. 회의를 효과적으로 중재하기 위해 맥락을 충분히 파악해야 합니다.

파악해야 할 핵심 4가지:
1. 회의 목적 — 무엇을 결정/해결하려는지
2. 현재 상황/배경 — 왜 이 회의가 필요한지
3. 원하는 결과물 — 회의 후 무엇이 나와야 하는지
4. 잠재적 어려움 — 갈등이 예상되거나 의견이 갈릴 부분

규칙:
- 4가지가 모두 파악됐을 때만 "✅"로 시작하는 1-2문장 요약으로 끝내세요. ✅를 쓸 때는 추가 질문 절대 금지. 예: "✅ 다음 분기 마케팅 예산 배분을 결정하는 회의군요. 준비됐어요!"
- 4가지 중 하나라도 부족하면 "✅" 없이 질문만 하세요. 한 번에 최대 2가지. 간결하게.
- 이미 답변된 내용은 다시 묻지 마세요.
- 한국어로만 답하세요.`;

async function askAi(messages: SetupMessage[]): Promise<string> {
  const apiMessages = messages.map((m) => ({
    role: m.role === 'ai' ? 'ai' : 'user',
    content: m.text,
  }));
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: SETUP_SYSTEM, messages: apiMessages, maxTokens: 300 }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'API error');
  return data.content as string;
}

async function buildFinalContext(messages: SetupMessage[]): Promise<string> {
  const conversation = messages.map((m) => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.text}`).join('\n');
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system: `아래 대화에서 회의 맥락을 구조화된 형태로 요약하세요.

형식:
목적: [한 문장]
배경: [한 문장]
결과물: [기대 산출물]
주요 쟁점: [갈등 예상 지점 또는 핵심 결정 사항]
추가 맥락: [기타 중요 정보]

없는 항목은 생략. 한국어.`,
      messages: [{ role: 'user', content: conversation }],
      maxTokens: 400,
    }),
  });
  const data = await res.json();
  if (!res.ok) return messages.map((m) => m.text).join('\n');
  return data.content as string;
}

export function MeetingSetup({ members, onStart }: Props) {
  const [messages, setMessages] = useState<SetupMessage[]>([]);
  const [input, setInput] = useState('');
  const [interimText, setInterimText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const isFirstMessage = messages.length === 0;

  const handleVoiceResult = useCallback((text: string) => {
    setInput((prev) => prev ? `${prev} ${text}` : text);
    setInterimText('');
  }, []);

  const { isListening, isSupported, toggle } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onInterim: setInterimText,
    onError: () => {},
  });

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    if (isListening) toggle();

    const userMsg: SetupMessage = { role: 'user', text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setInterimText('');
    setIsLoading(true);

    try {
      const reply = await askAi(next);
      const aiMsg: SetupMessage = { role: 'ai', text: reply };
      setMessages([...next, aiMsg]);
      if (reply.startsWith('✅')) setIsReady(true);
      setTimeout(() => chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch {
      setMessages([...next, { role: 'ai', text: '오류가 발생했어요. 다시 시도해 주세요.' }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleStart = async () => {
    if (isListening) toggle();
    setIsStarting(true);
    try {
      const context = await buildFinalContext(messages);
      onStart(context);
    } catch {
      const fallback = messages.filter((m) => m.role === 'user').map((m) => m.text).join('\n');
      onStart(fallback);
    }
  };

  const handleSkip = async () => {
    if (!input.trim() && messages.length === 0) return;
    if (isListening) toggle();
    setIsStarting(true);
    try {
      const allMsgs = input.trim()
        ? [...messages, { role: 'user' as const, text: input.trim() }]
        : messages;
      const context = allMsgs.length > 0 ? await buildFinalContext(allMsgs) : input.trim();
      onStart(context);
    } catch {
      onStart(input.trim() || messages.filter((m) => m.role === 'user').map((m) => m.text).join('\n'));
    }
  };

  return (
    <div className="card max-w-xl mx-auto space-y-4">
      <div>
        <h3 className="font-semibold text-slate-200 mb-0.5">회의 설정</h3>
        <p className="text-xs text-slate-500">
          {isFirstMessage
            ? '이번 회의에 대해 자유롭게 설명해 주세요. AI가 파악하고 역질문할게요.'
            : 'AI가 맥락을 파악 중이에요.'}
        </p>
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

      {/* 대화 내역 */}
      {messages.length > 0 && (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-accent/20 text-slate-200 rounded-tr-sm'
                    : 'bg-surface2 border border-border text-slate-300 rounded-tl-sm'
                }`}
              >
                {m.text}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-surface2 border border-border px-3 py-2 rounded-2xl rounded-tl-sm flex gap-1 items-center">
                {[0,1,2].map((i) => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />
                ))}
              </div>
            </div>
          )}
          <div ref={chatBottomRef} />
        </div>
      )}

      {/* 입력창 */}
      {!isReady && (
        <div className="space-y-2">
          <div className="relative">
            <textarea
              ref={textareaRef}
              className="input-base w-full text-sm resize-none pr-10"
              rows={isFirstMessage ? 4 : 2}
              placeholder={
                isListening
                  ? '말씀하세요...'
                  : isFirstMessage
                  ? '예) 내일 런칭을 앞두고 마지막 기능 범위를 결정해야 해요. 개발팀이랑 기획팀이 의견이 달라서...'
                  : 'AI 질문에 답해주세요...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
              }}
              disabled={isLoading}
              autoFocus={isFirstMessage}
            />
            {isSupported && (
              <button
                type="button"
                onClick={toggle}
                disabled={isLoading}
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

          {/* 인식 중 미리보기 */}
          {interimText && (
            <p className="text-xs text-slate-500 italic px-1">{interimText}...</p>
          )}

          <div className="flex gap-2">
            {messages.length >= 2 && (
              <button
                className="btn-secondary flex-1 text-sm py-2"
                onClick={handleSkip}
                disabled={isStarting}
              >
                이 정도면 충분해요
              </button>
            )}
            <button
              className="btn-primary flex-1 text-sm py-2 disabled:opacity-40"
              onClick={handleSend}
              disabled={!input.trim() || isLoading}
            >
              {isFirstMessage ? '설명 전송' : '답변 전송'}
            </button>
          </div>
        </div>
      )}

      {/* 준비 완료 */}
      {isReady && (
        <button
          className="btn-primary w-full py-3 text-sm"
          onClick={handleStart}
          disabled={isStarting}
        >
          {isStarting ? '준비 중...' : '회의 시작하기 →'}
        </button>
      )}
    </div>
  );
}
