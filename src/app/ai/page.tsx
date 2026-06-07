'use client';

import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { Message } from '@/types';
import { codeInfo, typeData } from '@/data/typeData';
import { detectConflict, type ConflictCategory } from '@/data/conflictPatterns';
import type { CodeType } from '@/types';
import { MeetingSetup } from '@/components/ai/MeetingSetup';
import { ChatWindow } from '@/components/ai/ChatWindow';
import { LiveTranscript, type TranscriptEntry, COLOR_PALETTE } from '@/components/ai/LiveTranscript';
import { MeetingControls } from '@/components/ai/MeetingControls';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';

type Phase = 'setup' | 'meeting';
type ActiveTab = 'transcript' | 'ai';

function buildSystemPrompt(context: string, teamSummary: string): string {
  return `당신은 스타트업 팀 전문 AI 중재자입니다.

팀 구성: ${teamSummary || '등록된 팀원 없음'}
오늘 회의 주제: ${context || '없음'}

CODE 프레임워크 (주 성향 기반):
- D (Disruptor): 빠른 실행, 결단력, 리스크 감수 → 직접적이고 단호한 언어로 소통
- O (Outreacher): 비전 제시, 동기부여, 외부 네트워킹 → 가능성과 비전을 연결하는 방식으로
- C (Coordinator): 팀 조율, 투명 소통, 갈등 중재 → 관계와 팀 분위기를 먼저 고려
- E (Evaluator): 데이터 분석, 리스크 평가, 체계적 사고 → 근거와 데이터 중심으로 설득
- 복합 유형(DC, OE 등)은 두 성향을 모두 가짐 — 주 성향을 우선, 부 성향도 고려

역할:
1. 각 팀원의 CODE 성향에 맞게 다른 언어와 접근법으로 중재한다.
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

아래 패턴이 감지되거나 중요 결정이 내려지면 개입하세요:
🔴공격·적대 | 🟠수동공격 | 🟡회의구조파괴 | 🟢발산혼란 | 🔵책임회피
🟣비교·경쟁 | ⚫에너지저하 | 🟤애매모호 | 🔶관계갈등 | 🟥자기중심
🟧분석마비 | 🟫소극적참여 | 🔷과도한낙관 | 🔸외부요인탓
📌팀 전체에 영향을 미치는 중요 결정

위 패턴이 없고 일반 대화면 반드시 "SKIP"만 반환.
개입 시 해당 패턴 이모지와 이름 먼저, 2-3문장 중재. 한국어.`;
}

function buildAlertPrompt(teamSummary: string, context: string, recentTranscript: string, category: ConflictCategory): string {
  return `당신은 실시간 회의 AI 중재자입니다.

팀 구성: ${teamSummary || '등록된 팀원 없음'}
회의 주제: ${context || '없음'}

${category.emoji} 감지된 패턴: "${category.name}" — ${category.desc}

최근 대화:
${recentTranscript}

"${category.name}" 패턴이 감지됐습니다. 팀 성향을 고려해 즉시 중재하세요.
- 직접적 공격(🔴)·관계갈등(🔶)·자기중심(🟥): 감정을 먼저 인정하고 대화 톤 전환
- 책임회피(🔵)·소극적참여(🟫): 구체적 역할과 의견을 부드럽게 요청
- 발산혼란(🟢)·분석마비(🟧): 현재 아젠다로 수렴하도록 안내
- 에너지저하(⚫)·비교·경쟁(🟣): 팀 강점과 가능성을 상기
- 수동공격(🟠)·애매모호(🟤): 숨겨진 불만을 직접 표현하도록 유도
- 기타 패턴: 패턴 특성에 맞게 건설적으로 전환

응답 형식: "${category.emoji} ${category.name}\n[2-3문장의 구체적 중재 메시지]"
맥락상 명백히 문제없는 경우에만 SKIP. 한국어.`;
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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
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
  const [interimText, setInterimText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('transcript');
  const [currentSpeaker, setCurrentSpeaker] = useState('');
  const currentSpeakerRef = useRef('');
  currentSpeakerRef.current = currentSpeaker;

  const lastAnalyzedCountRef = useRef(0);
  const isAnalyzingRef = useRef(false);
  const meetingContextRef = useRef('');
  meetingContextRef.current = meetingContext;
  // transcriptRef stays in sync so handleVoiceResult never captures stale state
  const transcriptRef = useRef<TranscriptEntry[]>([]);

  const teamSummary = teamMembers
    .map((m) => {
      const typeName = typeData[m.code]?.name ?? codeInfo[m.code[0] as CodeType]?.label ?? m.code;
      return `${m.name}(${m.code}·${typeName})`;
    })
    .join(', ');
  const teamSummaryRef = useRef('');
  teamSummaryRef.current = teamSummary;

  const runAnalysis = useCallback(async (entries: TranscriptEntry[], category?: ConflictCategory) => {
    if (isAnalyzingRef.current || entries.length === 0) return;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    try {
      // for category alerts use last 8 entries for focused context; periodic checks use all
      const contextEntries = category ? entries.slice(-8) : entries;
      const transcriptText = contextEntries
        .map((e) => `[${e.time}] ${e.speaker ? `${e.speaker}: ` : ''}${e.text}`)
        .join('\n');

      const systemPrompt = category
        ? buildAlertPrompt(teamSummaryRef.current, meetingContextRef.current, transcriptText, category)
        : buildAutoPrompt(teamSummaryRef.current, meetingContextRef.current, transcriptText);

      const result = await callApi(systemPrompt, '위 대화를 분석해주세요.', 512);

      if (result.trim() === 'SKIP') return;

      addMessage({
        id: Date.now().toString(),
        role: 'ai',
        content: result,
        timestamp: new Date().toISOString(),
      });
      setActiveTab('ai');
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
    const entry: TranscriptEntry = {
      id: Date.now().toString(),
      text,
      time,
      speaker: currentSpeakerRef.current || undefined,
    };

    const next = [...transcriptRef.current, entry];
    transcriptRef.current = next;
    setTranscript(next);

    const detectedCategory = detectConflict(text);

    // 패턴 감지 시 즉시 분석, 그 외엔 5문장마다 주기 분석
    const threshold = detectedCategory ? 0 : 5;
    if (detectedCategory || next.length - lastAnalyzedCountRef.current >= threshold) {
      lastAnalyzedCountRef.current = next.length;
      runAnalysis(next, detectedCategory ?? undefined);
    }
  }, [runAnalysis]);

  const { isListening, isSupported, toggle, stop } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onInterim: setInterimText,
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
      content: `회의를 시작합니다. 🎙\n\n${teamMembers.length > 0 ? `팀 구성: ${teamSummary}\n` : ''}${context ? `주제: ${context}\n` : ''}\n마이크를 켜고 대화를 시작하세요. 갈등이나 중요한 결정이 감지되면 자동으로 중재 의견을 드립니다.`,
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
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      showToast(`AI 오류: ${msg}`, 'error');
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const handleCopy = async () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const lines: string[] = [
      '[ 회의 기록 ]',
      `날짜: ${dateStr} ${timeStr}`,
      meetingContextRef.current ? `주제: ${meetingContextRef.current}` : '',
      teamSummaryRef.current ? `팀 구성: ${teamSummaryRef.current}` : '',
      '',
      '━━━ 대화 기록 ━━━',
      ...transcriptRef.current.map((e) => `[${e.time}] ${e.text}`),
      '',
      '━━━ AI 중재 내용 ━━━',
      ...messages.filter((m) => m.role === 'ai').map((m, i) => `[${i+1}] ${m.content}`),
    ].filter(Boolean);

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast('클립보드에 복사됐어요!', 'success');
    } catch {
      showToast('복사 실패. 내보내기를 사용해 주세요.', 'error');
    }
  };

  const handleExport = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

    const lines: string[] = [
      '[ 회의 기록 ]',
      `날짜: ${dateStr} ${timeStr}`,
      meetingContext ? `주제: ${meetingContext}` : '',
      teamSummary ? `팀 구성: ${teamSummary}` : '',
      '',
      '━━━ 대화 기록 ━━━',
      ...transcriptRef.current.map((e) => `[${e.time}] ${e.text}`),
      '',
      '━━━ AI 중재 내용 ━━━',
      ...messages.filter((m) => m.role === 'ai').map((m, i) => `[${i+1}] ${m.content}`),
    ].filter((l) => l !== undefined);

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `회의기록_${dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEnd = () => {
    stop();
    clearMessages();
    setTranscript([]);
    setInterimText('');
    setCurrentSpeaker('');
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
        {!isSupported && (
          <div className="mb-6 flex gap-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
            <span className="mt-0.5 shrink-0">⚠️</span>
            <span>
              이 브라우저는 음성 인식을 지원하지 않아요.{' '}
              <strong>Chrome</strong> 또는 <strong>Edge</strong>에서 접속해 주세요.
              (Safari·Firefox는 미지원)
            </span>
          </div>
        )}
        <MeetingSetup members={teamMembers} onStart={handleStart} />
      </div>
    );
  }

  // ── MEETING ROOM ──
  const speakerColors: Record<string, string> = {};
  teamMembers.forEach((m, i) => {
    speakerColors[m.name] = COLOR_PALETTE[i % COLOR_PALETTE.length];
  });

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

      {/* speaker selector */}
      {teamMembers.length > 0 && (
        <div className="shrink-0 flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-surface overflow-x-auto">
          <span className="text-[10px] text-slate-600 shrink-0">발화자</span>
          <button
            onClick={() => setCurrentSpeaker('')}
            className={`shrink-0 px-2.5 py-1 rounded-full text-xs transition-colors ${
              currentSpeaker === '' ? 'bg-slate-600 text-slate-200' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            없음
          </button>
          {teamMembers.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setCurrentSpeaker(m.name)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                currentSpeaker === m.name
                  ? `${COLOR_PALETTE[i % COLOR_PALETTE.length]} bg-white/10`
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m.name}<span className="opacity-60 ml-1">{m.code}</span>
            </button>
          ))}
        </div>
      )}

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
          <LiveTranscript entries={transcript} interimText={interimText} speakerColors={speakerColors} />
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
        onCopy={handleCopy}
        onExport={handleExport}
        onEnd={handleEnd}
      />
    </div>
  );
}
