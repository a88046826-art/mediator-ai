'use client';

import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { Message } from '@/types';
import { codeInfo } from '@/data/typeData';
import { MeetingSetup } from '@/components/ai/MeetingSetup';
import { ChatWindow } from '@/components/ai/ChatWindow';
import { LiveTranscript, type TranscriptEntry } from '@/components/ai/LiveTranscript';
import { MeetingControls } from '@/components/ai/MeetingControls';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';

type Phase = 'setup' | 'meeting';
type ActiveTab = 'transcript' | 'ai';

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
4. 답변은 간결하고 실용적으로, 한국어로 작성한다.`;
}

function buildAutoPrompt(teamSummary: string, context: string, transcriptText: string): string {
  return `당신은 실시간 회의를 모니터링하는 AI 중재자입니다.
팀 구성: ${teamSummary || '등록된 팀원 없음'}
회의 주제: ${context || '없음'}

아래는 지금까지의 실시간 대화 내용입니다:
${transcriptText}

위 대화를 분석해서 다음 중 하나만 반환하세요:
- 갈등/긴장이 감지되면: "⚡ 갈등 감지\n[중재 메시지]"
- 중요 결정이나 핵심 발언이면: "📌 핵심 발언\n[요약]"
- 회의 흐름이 좋으면: "✅ 진행 소감\n[짧은 피드백]"
- 특이사항 없으면: "SKIP"

답변은 2-3문장 이내로 간결하게. 한국어로.`;
}

async function callApi(system: string, userContent: string, maxTokens = 1024): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system,
      messages: [{ role: 'user', content: userContent }],
      maxTokens,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  return data.content as string;
}

export default function AiPage() {
  const teamMembers = useAppStore((s) => s.teamMembers);
  const messages = useAppStore((s) => s.messages);
  const addMessage = useAppStore((s) => s.addMessage);
  const clearMessages = useAppStore((s) => s.clearMessages);
  const showToast = useAppStore((s) => s.showToast);

  const [phase, setPhase] = useState<Phase>('setup');
  const [meetingContext, setMeetingContext] = useState('');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('transcript');

  const lastAnalyzedCountRef = useRef(0);
  const isAnalyzingRef = useRef(false);
  const meetingContextRef = useRef('');
  meetingContextRef.current = meetingContext;
  // transcriptRef stays in sync so handleVoiceResult never captures stale state
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  const teamSummary = teamMembers
    .map((m) => `${m.name}(${m.code}·${codeInfo[m.code].label})`)
    .join(', ');
  const teamSummaryRef = useRef('');
  teamSummaryRef.current = teamSummary;

  const runAnalysis = useCallback(async (entries: TranscriptEntry[]) => {
    if (isAnalyzingRef.current || entries.length === 0) return;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    try {
      const transcriptText = entries.map((e) => `[${e.time}] ${e.text}`).join('\n');
      const result = await callApi(
        buildAutoPrompt(teamSummaryRef.current, meetingContextRef.current, transcriptText),
        '위 대화를 분석해주세요.',
        512,
      );
      if (result.trim() !== 'SKIP') {
        addMessage({
          id: Date.now().toString(),
          role: 'ai',
          content: result,
          timestamp: new Date().toISOString(),
        });
        setActiveTab('ai');
      }
    } catch {
      // silent fail — auto-analysis is best-effort
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [addMessage]);

  const handleVoiceResult = useCallback((text: string) => {
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const entry: TranscriptEntry = { id: Date.now().toString(), text, time };

    // Update ref first, then state — avoids side-effects inside setState updater
    const next = [...transcriptRef.current, entry];
    transcriptRef.current = next;
    setTranscript(next);

    if (next.length - lastAnalyzedCountRef.current >= 3) {
      lastAnalyzedCountRef.current = next.length;
      runAnalysis(next);
    }
  }, [runAnalysis]);

  const { isListening, toggle, stop } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onError: (err) => showToast(`음성 오류: ${err}`, 'error'),
  });

  const handleStart = (context: string) => {
    setMeetingContext(context);
    clearMessages();
    setTranscript([]);
    lastAnalyzedCountRef.current = 0;
    addMessage({
      id: Date.now().toString(),
      role: 'ai',
      content: `회의를 시작합니다. 🎙\n\n${teamMembers.length > 0 ? `팀 구성: ${teamSummary}\n` : ''}${context ? `주제: ${context}\n` : ''}\n마이크를 켜고 대화를 시작하세요. 3문장마다 자동으로 분석하고, 갈등·핵심 발언·진행 소감을 알려드립니다.`,
      timestamp: new Date().toISOString(),
    });
    setPhase('meeting');
  };

  const handleManualAsk = async () => {
    if (isAnalyzingRef.current) return;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    try {
      const entries = transcriptRef.current;
      const transcriptText = entries.length > 0
        ? entries.map((e) => `[${e.time}] ${e.text}`).join('\n')
        : '(아직 대화 내용 없음)';

      const result = await callApi(
        buildSystemPrompt(meetingContext, teamSummary),
        `지금까지 대화 내용:\n${transcriptText}\n\n현재 상황을 분석하고 중재 의견을 주세요.`,
      );
      addMessage({
        id: Date.now().toString(),
        role: 'ai',
        content: result,
        timestamp: new Date().toISOString(),
      });
      setActiveTab('ai');
    } catch {
      showToast('AI 응답 실패. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const handleEnd = () => {
    stop();
    clearMessages();
    setTranscript([]);
    transcriptRef.current = [];
    lastAnalyzedCountRef.current = 0;
    setPhase('setup');
  };

  // ── SETUP ──
  if (phase === 'setup') {
    return (
      <div className="max-w-xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold mb-2 text-center">AI 팀 중재자</h1>
        <p className="text-slate-400 text-sm mb-8 text-center">실시간 회의 분석 · 성향 기반 중재</p>
        <MeetingSetup members={teamMembers} onStart={handleStart} />
      </div>
    );
  }

  // ── MEETING ROOM ──
  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>

      {/* header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full transition-colors ${isListening ? 'bg-red-400 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-sm font-medium text-slate-200">
            {isListening ? '녹음 중' : '대기 중'}
          </span>
          {teamMembers.length > 0 && (
            <span className="hidden sm:inline text-xs text-slate-500 ml-2">{teamSummary}</span>
          )}
        </div>
        {isAnalyzing && (
          <div className="flex items-center gap-1.5 text-xs text-accent">
            <div className="flex gap-0.5">
              {[0,1,2].map((i) => (
                <div key={i} className="w-1 h-1 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i*0.15}s` }} />
              ))}
            </div>
            AI 분석 중
          </div>
        )}
      </div>

      {/* mobile tab bar */}
      <div className="sm:hidden shrink-0 flex border-b border-border bg-surface">
        {(['transcript', 'ai'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
              activeTab === tab ? 'text-accent' : 'text-slate-500'
            }`}
          >
            {tab === 'transcript' ? '대화 기록' : `AI 중재${messages.length > 1 ? ` (${messages.length - 1})` : ''}`}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
          </button>
        ))}
      </div>

      {/* two-panel main */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* left: transcript */}
        <div className={`flex-col overflow-hidden sm:flex sm:flex-1 sm:border-r sm:border-border ${activeTab === 'transcript' ? 'flex flex-1' : 'hidden'}`}>
          <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/40">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">대화 기록</p>
          </div>
          <LiveTranscript entries={transcript} />
        </div>

        {/* right: AI interventions */}
        <div className={`flex-col overflow-hidden sm:flex sm:flex-1 ${activeTab === 'ai' ? 'flex flex-1' : 'hidden'}`}>
          <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/40">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">AI 중재</p>
          </div>
          <ChatWindow messages={messages} isLoading={false} />
        </div>
      </div>

      {/* controls bar */}
      <MeetingControls
        isRecording={isListening}
        isAnalyzing={isAnalyzing}
        onToggleMic={toggle}
        onManualAsk={handleManualAsk}
        onEnd={handleEnd}
      />
    </div>
  );
}
