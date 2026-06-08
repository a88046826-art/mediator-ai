'use client';

import { useState, useRef, useCallback } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { Message } from '@/types';
import { codeInfo, typeData } from '@/data/typeData';
import type { CodeType } from '@/types';
import { MeetingSetup } from '@/components/ai/MeetingSetup';
import { ChatWindow } from '@/components/ai/ChatWindow';
import { LiveTranscript, type TranscriptEntry, COLOR_PALETTE } from '@/components/ai/LiveTranscript';
import { MeetingControls } from '@/components/ai/MeetingControls';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';

type Phase = 'setup' | 'meeting' | 'summary';
type ActiveTab = 'transcript' | 'ai';

function buildSystemPrompt(context: string, teamSummary: string): string {
  return `당신은 스타트업 팀 전문 AI 중재자입니다.

팀 구성: ${teamSummary || '등록된 팀원 없음'}
오늘 회의 주제: ${context || '없음'}

CODE 프레임워크:
- D (Disruptor): 빠른 실행, 결단력 — 직접적이고 단호하게 소통
- O (Outreacher): 비전, 동기부여 — 가능성과 큰 그림으로 연결
- C (Coordinator): 조율, 관계 — 팀 분위기와 감정을 먼저 살핌
- E (Evaluator): 분석, 체계 — 데이터와 근거 중심으로 판단
- 복합 유형(DC 등)은 두 성향 모두 반영

중재 원칙:
- 발화자를 지목하지 않는다. 누가 말했는지 알 수 없기 때문이다.
- 대신 "이 팀에 있는 성향" 기준으로 각 타입에게 직접 말을 건다.
  예: "D 성향인 분은 ~, E 성향인 분은 ~"
- 각자 자신의 성향을 알고 있으므로 스스로 적용한다.
- 구체적인 다음 행동 1가지를 반드시 제안한다.
- 2-4문장으로 간결하게. 한국어.`;
}

function buildAutoPrompt(teamSummary: string, context: string, transcriptText: string): string {
  return `당신은 실시간 회의를 모니터링하는 AI 중재자입니다.

팀 구성: ${teamSummary || '등록된 팀원 없음'}
회의 주제: ${context || '없음'}

대화 내용:
${transcriptText}

CODE 프레임워크:
- D: 빠른 실행, 결단 / O: 비전, 동기 / C: 조율, 관계 / E: 분석, 체계

아래 패턴이 보이면 개입하세요:
🔴공격·적대 | 🟠수동공격 | 🟡회의구조파괴 | 🟢발산혼란 | 🔵책임회피
🟣비교·경쟁 | ⚫에너지저하 | 🟤애매모호 | 🔶관계갈등 | 🟥자기중심
🟧분석마비 | 🟫소극적참여 | 🔷과도한낙관 | 🔸외부요인탓
📌중요한 결정이 내려지는 순간

개입 시 형식:
[패턴 이모지 + 이름]
[상황 1문장]
[이 팀에 있는 성향별 제안 — "D 성향인 분은 ~, E 성향인 분은 ~" 형식]
[구체적 다음 행동 1가지]

패턴 없고 일반 대화면 반드시 "SKIP"만 반환. 한국어.`;
}

type SummaryView = null | 'analysis' | 'next-topic';

function buildAnalysisPrompt(teamSummary: string, context: string, transcriptText: string, aiInterventions: string): string {
  return `당신은 팀 회의 분석 전문가입니다.

팀 구성: ${teamSummary || '등록된 팀원 없음'}
회의 주제: ${context || '없음'}

CODE 프레임워크:
- D (Disruptor): 빠른 실행, 결단력
- O (Outreacher): 비전, 네트워킹
- C (Coordinator): 조율, 소통
- E (Evaluator): 분석, 체계
- 복합 유형(DC 등)은 두 성향 모두 반영

=== 전체 대화 기록 ===
${transcriptText || '(대화 내용 없음)'}

=== AI 중재 개입 내역 ===
${aiInterventions || '(AI 개입 없음)'}

아래 형식으로 회의 결과를 분석하세요:

## 📋 주요 논의 사항
핵심 논의 내용 불릿으로 (2-4개)

## ✅ 내려진 결정
확정된 결정사항 불릿. 없으면 "확정된 결정 없음"

## ❓ 미해결 항목
결론 못 낸 사항 불릿. 없으면 "미해결 항목 없음"

## 🧭 팀 역학 분석
갈등 패턴, 소통 방식, 분위기 등 한 문단 평가

## 🔥 즉시 할 일
구체적 다음 액션 2-3개

한국어. 대화가 부족해도 최대한 분석.`;
}

function buildNextTopicsPrompt(teamSummary: string, context: string, transcriptText: string): string {
  return `당신은 팀 회의 퍼실리테이터입니다.

팀 구성: ${teamSummary || '등록된 팀원 없음'}
이번 회의 주제: ${context || '없음'}

=== 대화 기록 ===
${transcriptText || '(대화 내용 없음)'}

이번 회의 내용을 바탕으로 다음 회의에서 다뤄야 할 주제를 추천하세요.

## 🎯 추천 주제 (우선순위 순)

각 주제마다 아래 형식으로:
**1. [주제명]**
- 이유: 이번 회의에서 연결되는 맥락
- 예상 소요: XX분
- 사전 준비: 필요한 준비사항

(3가지 추천)

## 💡 다음 회의 진행 팁
팀 성향을 고려한 회의 운영 제안 1-2가지

한국어.`;
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
  const saveMeeting = useAppStore((s) => s.saveMeeting);
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
  const [summaryView, setSummaryView] = useState<SummaryView>(null);
  const [summaryContent, setSummaryContent] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);

  const lastAnalyzedCountRef = useRef(0);
  const isAnalyzingRef = useRef(false);
  const sessionCallCountRef = useRef(0);
  const MAX_SESSION_CALLS = 30;
  const analysisFailCountRef = useRef(0);
  const meetingContextRef = useRef('');
  meetingContextRef.current = meetingContext;
  // transcriptRef stays in sync so handleVoiceResult never captures stale state
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  // tracks wall-clock time of last committed entry for merge logic
  const lastEntryTimeRef = useRef(0);

  const teamSummary = teamMembers
    .map((m) => {
      const typeName = typeData[m.code]?.name ?? codeInfo[m.code[0] as CodeType]?.label ?? m.code;
      return `${m.name}(${m.code}·${typeName})`;
    })
    .join(', ');
  const teamSummaryRef = useRef('');
  teamSummaryRef.current = teamSummary;

  const runAnalysis = useCallback(async (entries: TranscriptEntry[]) => {
    if (isAnalyzingRef.current || entries.length === 0) return;
    if (sessionCallCountRef.current >= MAX_SESSION_CALLS) return;
    sessionCallCountRef.current++;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    try {
      const transcriptText = entries
        .map((e) => `[${e.time}] ${e.speaker ? `${e.speaker}: ` : ''}${e.text}`)
        .join('\n');

      const systemPrompt = buildAutoPrompt(teamSummaryRef.current, meetingContextRef.current, transcriptText);

      const result = await callApi(systemPrompt, '위 대화를 분석해주세요.', 512);

      if (result.trim() === 'SKIP') return;

      addMessage({
        id: Date.now().toString(),
        role: 'ai',
        content: result,
        timestamp: new Date().toISOString(),
      });
      setActiveTab('ai');
      analysisFailCountRef.current = 0;
      setAiError(false);
    } catch {
      analysisFailCountRef.current++;
      if (analysisFailCountRef.current >= 2) setAiError(true);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, [addMessage]);

  const MERGE_WINDOW_MS = 1500;

  const handleVoiceResult = useCallback((text: string) => {
    const now = new Date();
    const nowMs = now.getTime();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const speaker = currentSpeakerRef.current || undefined;

    const prev = transcriptRef.current;
    const lastEntry = prev[prev.length - 1];
    const withinWindow = nowMs - lastEntryTimeRef.current < MERGE_WINDOW_MS;
    const sameSpeaker = lastEntry?.speaker === speaker;

    let next: TranscriptEntry[];
    if (lastEntry && withinWindow && sameSpeaker) {
      // Android Chrome continuous 모드: 새 final이 이전 텍스트를 포함하면 교체(누적 방지)
      const prevText = lastEntry.text.trim();
      const merged = text.startsWith(prevText)
        ? { ...lastEntry, text }
        : { ...lastEntry, text: prevText + ' ' + text };
      next = [...prev.slice(0, -1), merged];
    } else {
      next = [...prev, { id: Date.now().toString(), text, time, speaker }];
    }

    lastEntryTimeRef.current = nowMs;
    transcriptRef.current = next;
    setTranscript(next);

    // 최근 3개 발화 합산 텍스트가 20자 이상일 때만 분석 (짧은 추임새 제외)
    const recentText = next.slice(-3).map((e) => e.text).join(' ');
    if (next.length - lastAnalyzedCountRef.current >= 3 && recentText.length >= 20) {
      lastAnalyzedCountRef.current = next.length;
      runAnalysis(next);
    }
  }, [runAnalysis]);

  const { isListening, isSupported, toggle, stop } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onInterim: setInterimText,
    onError: (err) => {
      if (err.includes('권한')) {
        setMicBlocked(true);
      } else {
        showToast(`음성 오류: ${err}`, 'error');
      }
    },
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
    if (transcriptRef.current.length > 0) {
      saveMeeting({
        topic: meetingContextRef.current,
        teamSummary: teamSummaryRef.current,
        transcript: transcriptRef.current,
        aiMessages: messages.filter((m) => m.role === 'ai').slice(1),
      });
    }
    setSummaryView(null);
    setSummaryContent('');
    setPhase('summary');
  };

  const handleSummarySelect = async (view: Exclude<SummaryView, null>) => {
    if (isSummarizing) return;
    setSummaryView(view);
    setSummaryContent('');
    setIsSummarizing(true);
    const transcriptText = transcriptRef.current
      .map((e) => `[${e.time}] ${e.speaker ? `${e.speaker}: ` : ''}${e.text}`)
      .join('\n');
    const aiInterventions = messages
      .filter((m) => m.role === 'ai')
      .slice(1)
      .map((m, i) => `[개입 ${i + 1}] ${m.content}`)
      .join('\n\n');
    try {
      let prompt = '';
      if (view === 'analysis') prompt = buildAnalysisPrompt(teamSummaryRef.current, meetingContextRef.current, transcriptText, aiInterventions);
      else if (view === 'next-topic') prompt = buildNextTopicsPrompt(teamSummaryRef.current, meetingContextRef.current, transcriptText);
      const result = await callApi(prompt, '분석해주세요.', 1500);
      setSummaryContent(result);
    } catch {
      setSummaryContent('분석 중 오류가 발생했습니다. 다시 시도해 주세요.');
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleNewMeeting = () => {
    clearMessages();
    setTranscript([]);
    setInterimText('');
    setCurrentSpeaker('');
    setSummaryView(null);
    setSummaryContent('');
    transcriptRef.current = [];
    lastAnalyzedCountRef.current = 0;
    sessionCallCountRef.current = 0;
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

  // ── SUMMARY ──
  if (phase === 'summary') {
    const SUMMARY_ACTIONS = [
      {
        key: 'analysis' as const,
        emoji: '📊',
        title: '회의결과 분석',
        desc: '논의사항 · 결정 · 미해결 · 팀 역학',
        color: 'from-violet-500/20 to-violet-500/5 border-violet-500/30 hover:border-violet-400/60',
        textColor: 'text-violet-300',
      },
      {
        key: 'next-topic' as const,
        emoji: '🎯',
        title: '다음 회의 주제 추천',
        desc: '우선순위 · 예상 시간 · 준비사항',
        color: 'from-blue-500/20 to-blue-500/5 border-blue-500/30 hover:border-blue-400/60',
        textColor: 'text-blue-300',
      },
    ];

    const handleCopySummary = async () => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const viewLabel = SUMMARY_ACTIONS.find((a) => a.key === summaryView)?.title ?? '회의 분석';
      const lines = [
        `[ ${viewLabel} ]`,
        `날짜: ${dateStr}`,
        meetingContextRef.current ? `주제: ${meetingContextRef.current}` : '',
        teamSummaryRef.current ? `팀: ${teamSummaryRef.current}` : '',
        '',
        summaryContent,
        '',
        '━━━ 대화 기록 ━━━',
        ...transcriptRef.current.map((e) => `[${e.time}] ${e.speaker ? `${e.speaker}: ` : ''}${e.text}`),
      ].filter(Boolean);
      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        showToast('클립보드에 복사됐어요!', 'success');
      } catch {
        showToast('복사 실패. 내보내기를 사용해 주세요.', 'error');
      }
    };

    const handleExportSummary = () => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const viewLabel = SUMMARY_ACTIONS.find((a) => a.key === summaryView)?.title ?? '회의분석';
      const lines = [
        `[ ${viewLabel} ]`,
        `날짜: ${dateStr}`,
        meetingContextRef.current ? `주제: ${meetingContextRef.current}` : '',
        teamSummaryRef.current ? `팀: ${teamSummaryRef.current}` : '',
        '',
        summaryContent,
        '',
        '━━━ 대화 기록 ━━━',
        ...transcriptRef.current.map((e) => `[${e.time}] ${e.speaker ? `${e.speaker}: ` : ''}${e.text}`),
        '',
        '━━━ AI 중재 내용 ━━━',
        ...messages.filter((m) => m.role === 'ai').slice(1).map((m, i) => `[${i+1}] ${m.content}`),
      ].filter((l) => l !== undefined);
      const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${viewLabel.replace(/ /g, '_')}_${dateStr}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    };

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* header */}
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-slate-200">회의 종료</h1>
          <button
            onClick={handleNewMeeting}
            className="px-3 py-1.5 text-xs rounded-lg border border-border text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
          >
            새 회의 시작
          </button>
        </div>
        {meetingContextRef.current && (
          <p className="text-xs text-slate-500 mb-5">{meetingContextRef.current}</p>
        )}

        {/* stats */}
        <div className="flex flex-wrap gap-3 mb-6 text-xs text-slate-500">
          {teamSummaryRef.current && <span className="px-2.5 py-1 rounded-full bg-white/5">👥 {teamSummaryRef.current}</span>}
          <span className="px-2.5 py-1 rounded-full bg-white/5">🎙 발화 {transcriptRef.current.length}개</span>
          <span className="px-2.5 py-1 rounded-full bg-white/5">🤖 AI 개입 {Math.max(0, messages.filter((m) => m.role === 'ai').length - 1)}회</span>
        </div>

        {/* view: button selection */}
        {summaryView === null && (
          <>
            <p className="text-sm text-slate-400 mb-4">무엇을 확인할까요?</p>
            <div className="grid gap-3">
              {SUMMARY_ACTIONS.map((action) => (
                <button
                  key={action.key}
                  onClick={() => handleSummarySelect(action.key)}
                  className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl border bg-gradient-to-br transition-all text-left ${action.color}`}
                >
                  <span className="text-3xl shrink-0">{action.emoji}</span>
                  <div>
                    <p className={`font-semibold text-sm ${action.textColor}`}>{action.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{action.desc}</p>
                  </div>
                  <svg className="ml-auto w-4 h-4 text-slate-600 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              ))}
              <button
                onClick={handleNewMeeting}
                className="w-full py-3 rounded-2xl border border-border text-sm text-slate-500 hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                종료하기
              </button>
            </div>
          </>
        )}

        {/* view: loading or result */}
        {summaryView !== null && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => { setSummaryView(null); setSummaryContent(''); }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                aria-label="뒤로"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className={`font-semibold text-sm ${SUMMARY_ACTIONS.find((a) => a.key === summaryView)?.textColor}`}>
                {SUMMARY_ACTIONS.find((a) => a.key === summaryView)?.emoji}{' '}
                {SUMMARY_ACTIONS.find((a) => a.key === summaryView)?.title}
              </span>
            </div>

            {isSummarizing ? (
              <div className="card flex flex-col items-center gap-4 py-16 text-slate-500">
                <div className="flex gap-1.5">
                  {[0,1,2].map((i) => (
                    <div key={i} className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i*0.2}s` }} />
                  ))}
                </div>
                <p className="text-sm">분석 중입니다...</p>
              </div>
            ) : (
              <>
                <div className="card mb-4">
                  <div className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">
                    {summaryContent}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={handleCopySummary}
                    className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-border text-slate-400 hover:text-accent hover:border-accent/40 transition-colors"
                  >
                    복사
                  </button>
                  <button
                    onClick={handleExportSummary}
                    className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-border text-slate-400 hover:text-accent hover:border-accent/40 transition-colors"
                  >
                    파일 내보내기
                  </button>
                </div>
              </>
            )}
          </>
        )}
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

      {/* 마이크 권한 차단 배너 */}
      {micBlocked && (
        <div className="shrink-0 flex items-start gap-3 px-4 py-3 bg-red-500/10 border-b border-red-500/30 text-sm text-red-300">
          <span className="shrink-0 mt-0.5">🎙</span>
          <div className="flex-1">
            <p className="font-medium">마이크 권한이 차단되어 있어요</p>
            <p className="text-xs text-red-400/80 mt-0.5">
              브라우저 주소창 왼쪽 자물쇠 아이콘 → 마이크 → 허용 → 페이지 새로고침
            </p>
          </div>
          <button onClick={() => setMicBlocked(false)} className="shrink-0 text-red-400/60 hover:text-red-300">✕</button>
        </div>
      )}

      {/* AI 연결 오류 배너 */}
      {aiError && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-yellow-500/10 border-b border-yellow-500/30 text-xs text-yellow-300">
          <span>⚠️</span>
          <span className="flex-1">AI 분석 연결에 문제가 있어요. 회의는 계속 진행되지만 자동 중재가 일시 중단됐어요.</span>
          <button onClick={() => { setAiError(false); analysisFailCountRef.current = 0; }} className="shrink-0 text-yellow-400/60 hover:text-yellow-300">✕</button>
        </div>
      )}

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
