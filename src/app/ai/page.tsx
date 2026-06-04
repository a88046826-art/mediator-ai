'use client';

import { useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { Message } from '@/types';
import { codeInfo } from '@/data/typeData';
import { MeetingSetup } from '@/components/ai/MeetingSetup';
import { ChatWindow } from '@/components/ai/ChatWindow';
import { ChatInput } from '@/components/ai/ChatInput';
import { ScenarioChips } from '@/components/ai/ScenarioChips';

type Phase = 'setup' | 'chat';

function buildSystemPrompt(context: string, teamSummary: string): string {
  return `당신은 스타트업 팀 전문 AI 중재자입니다.

팀 구성: ${teamSummary || '등록된 팀원 없음'}
오늘 회의 주제: ${context || '없음'}

CODE 프레임워크:
- D (Disruptor): 빠른 실행, 결단력 강함, 리스크 감수
- O (Outreacher): 비전 제시, 동기부여, 외부 네트워킹
- C (Coordinator): 팀 조율, 투명 소통, 갈등 중재
- E (Evaluator): 데이터 분석, 리스크 평가, 체계적 사고

역할:
1. 갈등 상황을 각 성향 관점에서 분석한다.
2. 구체적인 중재 스크립트(대화 예시)를 제안한다.
3. 팀이 결론에 도달하도록 다음 액션을 안내한다.
4. 답변은 간결하고 실용적으로, 한국어로 작성한다.
5. 성향 코드(D/O/C/E)를 언급할 때 특성을 간략히 설명한다.`;
}

export default function AiPage() {
  const teamMembers = useAppStore((s) => s.teamMembers);
  const messages = useAppStore((s) => s.messages);
  const addMessage = useAppStore((s) => s.addMessage);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const showToast = useAppStore((s) => s.showToast);

  const [phase, setPhase] = useState<Phase>('setup');
  const [meetingContext, setMeetingContext] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const teamSummary = teamMembers
    .map((m) => `${m.name}(${m.code}·${codeInfo[m.code].label})`)
    .join(', ');

  const handleStart = (context: string) => {
    setMeetingContext(context);
    clearMessages();
    const welcome: Message = {
      id: Date.now().toString(),
      role: 'ai',
      content: `안녕하세요! 저는 팀 AI 중재자입니다. 🤝\n\n${
        teamMembers.length > 0
          ? `팀 구성을 확인했어요: ${teamSummary}\n\n`
          : ''
      }${context ? `오늘 주제: **${context}**\n\n` : ''}갈등 상황이나 어려운 결정을 설명해주세요. 각 성향별 관점과 중재 방법을 제안해드립니다.`,
      timestamp: new Date().toISOString(),
    };
    addMessage(welcome);
    setPhase('chat');
  };

  const sendMessage = async (text: string) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(userMsg);
    setIsLoading(true);

    try {
      const history = messages
        .filter((m) => !m.isAlert)
        .slice(-10)
        .map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system: buildSystemPrompt(meetingContext, teamSummary),
          messages: [...history, { role: 'user', content: text }],
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: data.content,
        timestamp: new Date().toISOString(),
      };
      addMessage(aiMsg);
    } catch {
      showToast('AI 응답 실패. 잠시 후 다시 시도해주세요.', 'error');
      const errMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: '일시적인 오류가 발생했습니다. 다시 시도해주세요.',
        timestamp: new Date().toISOString(),
        isAlert: true,
      };
      addMessage(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  if (phase === 'setup') {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2 text-center">AI 팀 중재자</h1>
        <p className="text-slate-400 text-sm mb-8 text-center">성향을 고려한 맞춤형 갈등 중재</p>
        <MeetingSetup members={teamMembers} onStart={handleStart} />
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse2" />
          <span className="text-sm font-medium text-slate-200">AI 중재자 활성</span>
        </div>
        <button
          className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          onClick={() => { clearMessages(); setPhase('setup'); }}
        >
          새 회의
        </button>
      </div>

      <ChatWindow messages={messages} isLoading={isLoading} />
      <ScenarioChips onSelect={sendMessage} />
      <ChatInput onSend={sendMessage} disabled={isLoading} />
    </div>
  );
}
