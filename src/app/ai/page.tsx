'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { Message } from '@/types';
import { MeetingSetup } from '@/components/ai/MeetingSetup';
import { ChatWindow } from '@/components/ai/ChatWindow';
import { LiveTranscript, type TranscriptEntry } from '@/components/ai/LiveTranscript';
import { MeetingControls } from '@/components/ai/MeetingControls';
import { SurveyModal, type SurveyQuestion } from '@/components/ai/SurveyModal';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useSession } from '@/hooks/useSession';
import { getDeviceId } from '@/lib/deviceId';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  createSession, joinSession, setTopic,
  startMeeting, endMeeting, deleteSession,
  addTranscript as fbAddTranscript,
  updateTranscriptText as fbUpdateTranscriptText,
  removeTranscript as fbRemoveTranscript,
  addAiMessage as fbAddAiMessage,
  addSetupEntry, saveSurvey,
  type SessionTranscriptEntry, type SessionAiMessage,
} from '@/lib/session';

const ENTRY_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'pain',
    text: '평소 팀 회의에서 가장 힘든 점은? (복수 선택 가능)',
    type: 'multi',
    options: ['발언이 한쪽으로 쏠림', '결론 없이 끝남', '갈등/의견 충돌', '회의가 너무 오래 걸림', '기타'],
  },
  {
    id: 'expectation',
    text: 'AI 중재자에 대한 기대감은? (1: 낮음 · 5: 높음)',
    type: 'rating',
  },
  {
    id: 'source',
    text: 'Meditor를 어떻게 알게 됐나요?',
    type: 'single',
    options: ['팀 내부 공유', '지인 추천', 'SNS/온라인', '기타'],
  },
  {
    id: 'team_size',
    text: '오늘 회의 팀 규모는 어떻게 되나요?',
    type: 'single',
    options: ['2~3명', '4~6명', '7명 이상'],
  },
];

const EXIT_QUESTIONS: SurveyQuestion[] = [
  {
    id: 'satisfaction',
    text: '오늘 Meditor 사용 경험 전반적인 만족도는? (1: 별로 · 5: 매우 만족)',
    type: 'rating',
  },
  {
    id: 'real_impact',
    text: 'AI 중재가 실제로 회의 흐름을 바꿨나요?',
    type: 'single',
    options: ['예, 확실히 달라졌어요', '약간 영향이 있었어요', '잘 모르겠어요', '아니요'],
  },
  {
    id: 'reuse',
    text: '다음 회의에도 Meditor를 사용하겠나요?',
    type: 'single',
    options: ['예, 적극 사용할게요', '아마 사용할 것 같아요', '아직 모르겠어요', '아니요'],
  },
  {
    id: 'frequency',
    text: 'AI 개입 빈도는 적절했나요?',
    type: 'single',
    options: ['너무 많았어요', '적절했어요', '너무 적었어요'],
  },
  {
    id: 'best_feature',
    text: '가장 유용했던 기능은?',
    type: 'single',
    options: ['실시간 AI 중재', '회의 분석 요약', '액션 아이템 정리', '다음 주제 추천'],
  },
  {
    id: 'feedback',
    text: '개선점이나 불편한 점이 있다면 알려주세요',
    type: 'text',
    optional: true,
  },
];

type Phase = 'createOrJoin' | 'lobby' | 'meeting' | 'summary';
type ActiveTab = 'transcript' | 'ai' | 'overview';
type SummaryView = null | 'analysis' | 'next-topic' | 'action-items';
type ApiMessage = { role: 'user' | 'ai'; content: string };

const PROFANITY = [
  '씨발', '씨바', '시발', '시바', 'ㅅㅂ', '씨팔',
  '개새끼', 'ㄱㅅㄲ',
  '병신', 'ㅂㅅ',
  '지랄',
  '좆', '존나', 'ㅈㄴ',
  '창녀', '보지', '자지',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt',
];

function containsProfanity(text: string): boolean {
  const normalized = text.toLowerCase();
  return PROFANITY.some((w) => normalized.includes(w.toLowerCase()));
}

function playDing() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = window.AudioContext ?? (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx() as AudioContext;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
    osc.onended = () => ctx.close();
  } catch { /* ignore */ }
}

function buildSystemPrompt(context: string, teamSummary: string): string {
  return `당신은 스타트업 팀 전문 AI 중재자입니다.

팀 구성: ${teamSummary || '등록된 팀원 없음'}
오늘 회의 주제: ${context || '없음'}

중재 원칙:
- 발화자를 지목하지 않는다. 누가 말했는지 알 수 없기 때문이다.
- 구체적인 다음 행동 1가지를 반드시 제안한다.
- 2-4문장으로 간결하게. 한국어.`;
}

function buildAutoPrompt(teamSummary: string, context: string, transcriptText: string, recentAiContent: string): string {
  return `당신은 팀 회의를 조용히 지켜보는 AI 중재자입니다. 개입은 최소화하고 정말 필요할 때만 말하세요.

팀 구성: ${teamSummary || '없음'}
회의 주제: ${context || '없음'}
${recentAiContent ? `\n[이미 한 말 — 반복 금지]\n${recentAiContent}\n` : ''}
=== 대화 내용 ===
${transcriptText}

━━ 개입 기준 ━━
아래 상황이 아니면 반드시 "SKIP"만 반환.

즉시 개입:
• 공격적·모욕적 언어나 인신공격이 명확히 보일 때
• 한 사람이 반복적으로 무시당하거나 발언이 계속 끊길 때

부드럽게 개입:
• 주제와 무관한 대화가 길게 이어져 회의 목적이 흐려질 때
• 중요한 결정이 반대 의견 없이 너무 빠르게 넘어갈 때
• 에너지가 뚜렷하게 떨어지거나 대화가 막힐 때

━━ 개입 방식 ━━
• 2-3문장 이내, 따뜻하고 중립적인 어조
• 구체적인 다음 행동 하나만 제안
• 누가 말했는지 언급 금지, 이미 한 말 반복 금지
한국어.`;
}

function buildUrgentCheckPrompt(recentLines: string): string {
  return `아래 발언에서 즉각 개입이 필요한 상황인지 판단하세요.

${recentLines}

개입 필요 (이것만):
• 명백한 욕설 또는 인신공격
• 위협적이거나 심하게 모욕적인 발언
• 극도로 감정적인 폭발로 대화가 불가능한 수준

일반적인 의견 충돌, 강한 어조, 언성 높임 → SKIP

해당 없으면: SKIP
해당 있으면: ⚡로 시작하는 중재 1-2문장 (매우 차분하게, 양쪽 모두 존중)
한국어.`;
}

function buildAnalysisPrompt(teamSummary: string, context: string, transcriptText: string): string {
  const hasSpeakers = transcriptText.includes(': ');
  return `당신은 팀 회의 분석 전문가입니다.

팀 구성: ${teamSummary || '없음'}
회의 주제: ${context || '없음'}
${hasSpeakers ? '발화자 태깅 있음. 이름을 활용하세요.' : '발화자 태깅 없음. "발화자 정보 없음"으로 처리하세요.'}

=== 대화 기록 ===
${transcriptText || '(없음)'}

아래 3개 섹션으로 분석하세요.

---

## 1. 📌 회의 주제 확인
이 회의가 실제로 다룬 핵심 주제를 1-2문장으로 정리하세요.

---

## 2. ✅ 결정 수렴 여부
결론이 내려졌는지 판단하세요.
- **수렴된 경우**: 어떤 결론인지 서술
- **미수렴된 경우**: 결론이 나지 않은 이유 + 문제점 + 해결 방향

---

## 3. 🕐 시간대별 회의 흐름
[시간] 핵심 내용 형식으로 3-6개 항목.

---

한국어로 작성하세요.`;
}

function buildNextTopicsPrompt(teamSummary: string, context: string, transcriptText: string): string {
  return `당신은 팀 회의 퍼실리테이터입니다.

팀 구성: ${teamSummary || '없음'}
이번 회의 주제: ${context || '없음'}

=== 대화 기록 ===
${transcriptText || '(없음)'}

이 팀의 이번 회의에 특화된 다음 회의 주제 3가지를 추천하세요.

---

## 🎯 다음 회의 주제 추천

**추천 1: [주제명]**
- **선택 근거**:
- **장점**:
- **예상 소요 시간**:
- **준비사항**:

---

**추천 2: [주제명]**
- **선택 근거**:
- **장점**:
- **예상 소요 시간**:
- **준비사항**:

---

**추천 3: [주제명]**
- **선택 근거**:
- **장점**:
- **예상 소요 시간**:
- **준비사항**:

---

## 💡 다음 회의 진행 팁
1-2가지 구체적 제안.

한국어로 작성하세요.`;
}

function buildActionItemsPrompt(teamSummary: string, context: string, transcriptText: string): string {
  return `당신은 회의 결과를 정리하는 전문가입니다.

팀 구성: ${teamSummary || '없음'}
회의 주제: ${context || '없음'}

=== 대화 기록 ===
${transcriptText || '(없음)'}

아래 형식으로 간결하게 정리하세요. 없는 항목은 "없음"으로 표시.

## 📋 결정 사항
각 결정을 "· [내용]" 형식으로 나열

---

## ✅ 액션 아이템
각 항목을 "· [담당자] — [할 일] ([기한])" 형식으로 나열
담당자나 기한이 불명확하면 "미정"으로 표시

---

## ⚠️ 미결 사항
다음 회의에서 다뤄야 할 것들을 "· [내용]" 형식으로 나열

---

한국어로 작성하세요.`;
}

function buildChatSystemPrompt(teamSummary: string, context: string, transcriptText: string): string {
  return `당신은 팀 회의 중재 보조자입니다. 회의 참가자가 채팅으로 질문하면 답합니다.

팀 구성: ${teamSummary || '없음'}
회의 주제: ${context || '없음'}

=== 현재 대화 기록 ===
${transcriptText || '(아직 없음)'}

규칙:
1. 회의를 직접 이끌거나 결론을 유도하지 마세요.
2. 2-3문장으로만 답하세요.
3. 욕설·비속어가 포함된 메시지에는 "적절한 언어로 다시 질문해 주세요."라고만 답하세요.
한국어.`;
}

async function correctTranscript(text: string): Promise<string> {
  // 너무 짧으면 교정 의미 없음
  if (text.length < 5) return text;
  try {
    const result = await callApi(
      `다음 한국어 발화의 맞춤법과 띄어쓰기만 수정해서 반환하세요. 단어·내용·의미는 절대 바꾸지 마세요. 수정된 텍스트 한 줄만 반환하세요.`,
      text,
      Math.min(text.length * 3, 200),
    );
    const trimmed = result.trim();
    // Claude가 엉뚱한 긴 응답을 하면 원문 유지
    if (!trimmed || trimmed.length > text.length * 2) return text;
    return trimmed;
  } catch {
    return text;
  }
}

async function callApi(
  system: string,
  userContent: string,
  maxTokens = 1024,
  history?: ApiMessage[],
): Promise<string> {
  const messages: ApiMessage[] = history ?? [{ role: 'user', content: userContent }];
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system, messages, maxTokens }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `API error ${res.status}`);
  return data.content as string;
}

export default function AiPage() {
  const saveMeeting = useAppStore((s) => s.saveMeeting);
  const showToast = useAppStore((s) => s.showToast);

  const [phase, setPhase] = useState<Phase>('createOrJoin');
  const [sessionCode, setSessionCode] = useState<string | null>(null);

  // createOrJoin state
  const [myName, setMyName] = useState('');
  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);

  // meeting state
  const [interimText, setInterimText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('transcript');
  const [summaryView, setSummaryView] = useState<SummaryView>(null);
  const [summaryContent, setSummaryContent] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  const [unreadAiCount, setUnreadAiCount] = useState(0);
  const [flashAiPanel, setFlashAiPanel] = useState(false);
  const [isSoundMuted, setIsSoundMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [isChatInput, setIsChatInput] = useState(false);
  const [aiNotification, setAiNotification] = useState<{ content: string; isAlert: boolean } | null>(null);
  const aiNotificationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [overlayMode, setOverlayMode] = useState(false);
  const overlayModeRef = useRef(false);
  overlayModeRef.current = overlayMode;
  const [overlayCard, setOverlayCard] = useState<{ content: string; isAlert: boolean } | null>(null);
  const overlayCardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meetingStartTimeRef = useRef(0);
  // snapshot saved when meeting ends (for summary)
  const summaryTranscriptRef = useRef<SessionTranscriptEntry[]>([]);
  const summaryAiMessagesRef = useRef<SessionAiMessage[]>([]);

  // surveys
  const [activeSurvey, setActiveSurvey] = useState<'entry' | 'exit' | null>(null);
  const entrySurveyShownRef = useRef(false);
  const pendingEndRef = useRef(false);

  const deviceIdRef = useRef('');
  const sessionCodeRef = useRef<string | null>(null);
  sessionCodeRef.current = sessionCode;
  const isAnalyzingRef = useRef(false);
  const sessionCallCountRef = useRef(0);
  const analysisFailCountRef = useRef(0);
  const isUrgentCheckingRef = useRef(false);
  const urgentCallCountRef = useRef(0);
  const lastAnalyzedCountRef = useRef(0);
  const lastUrgentEntryIdRef = useRef('');
  const meetingContextRef = useRef('');
  const teamSummaryRef = useRef('');
  const chatHistoryRef = useRef<ApiMessage[]>([]);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const prevAiLengthRef = useRef(0);
  const activeTabRef = useRef<ActiveTab>('transcript');
  activeTabRef.current = activeTab;

  const MAX_SESSION_CALLS = 60;
  const MAX_URGENT_CALLS = 80;

  // localStorage 헬퍼
  const saveSession = (code: string, name: string) => {
    localStorage.setItem('mediator-session-code', code);
    localStorage.setItem('mediator-my-name', name);
  };
  const clearSavedSession = () => {
    localStorage.removeItem('mediator-session-code');
    localStorage.removeItem('mediator-my-name');
  };

  // 마운트: deviceId 초기화 + localStorage에서 이전 세션 복원 시도
  useEffect(() => {
    deviceIdRef.current = getDeviceId();
    const savedCode = localStorage.getItem('mediator-session-code');
    const savedName = localStorage.getItem('mediator-my-name');
    if (savedCode) {
      setMyName(savedName ?? '');
      setSessionCode(savedCode); // useSession이 Firebase 구독 시작
    }
  }, []);

  const stopRef = useRef<() => void>(() => {});
  const recentlySentRef = useRef<Map<string, number>>(new Map());

  // 세션 완전 초기화 (로비/요약 화면 공용)
  const handleNewMeeting = useCallback(() => {
    stopRef.current();
    clearSavedSession();
    setSessionCode(null);
    setMyName('');
    setJoinCodeInput('');
    setShowJoinInput(false);
    setJoinError('');
    setInterimText('');
    setSummaryView(null);
    setSummaryContent('');
    setChatInput('');
    chatHistoryRef.current = [];
    lastAnalyzedCountRef.current = 0;
    sessionCallCountRef.current = 0;
    urgentCallCountRef.current = 0;
    setUnreadAiCount(0);
    prevAiLengthRef.current = 0;
    setPhase('createOrJoin');
  }, []);

  // Firebase session state
  const sessionState = useSession(sessionCode);
  const isHost = sessionState?.host === deviceIdRef.current;

  // Sync refs from Firebase state
  meetingContextRef.current = sessionState?.topic ?? '';
  teamSummaryRef.current = sessionState
    ? Object.values(sessionState.members).map((m) => m.name).join(', ')
    : '';

  // 페이지 복귀 시 세션 복원: phase='createOrJoin' + sessionCode 있음 + Firebase 응답 받으면 phase 결정
  useEffect(() => {
    if (phase !== 'createOrJoin' || !sessionCode) return;
    if (sessionState === undefined) return; // Firebase 아직 응답 전
    if (sessionState === null) {
      // 세션이 Firebase에 없음 (만료 등)
      clearSavedSession();
      setSessionCode(null);
      return;
    }
    if (sessionState.status === 'lobby') {
      setPhase('lobby');
    } else if (sessionState.status === 'meeting') {
      meetingStartTimeRef.current = Date.now();
      // 이미 진행된 항목들 재분석 방지
      lastAnalyzedCountRef.current = sessionState.transcript.length;
      lastUrgentEntryIdRef.current = sessionState.transcript[sessionState.transcript.length - 1]?.id ?? '';
      prevAiLengthRef.current = sessionState.aiMessages.filter((m) => m.role === 'ai').length;
      setPhase('meeting');
    } else if (sessionState.status === 'ended') {
      summaryTranscriptRef.current = sessionState.transcript;
      summaryAiMessagesRef.current = sessionState.aiMessages;
      setPhase('summary');
    }
  // phase가 'createOrJoin'일 때만 실행, 이후 전환은 아래 auto-transition이 담당
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState, sessionCode]);

  // Auto-transition: lobby → meeting when host starts
  useEffect(() => {
    if (!sessionState) return;
    if (sessionState.status === 'meeting' && phase === 'lobby') {
      meetingStartTimeRef.current = Date.now();
      setPhase('meeting');
      setActiveTab('transcript');
      setUnreadAiCount(0);
      prevAiLengthRef.current = 0;
      lastAnalyzedCountRef.current = 0;
      sessionCallCountRef.current = 0;
      urgentCallCountRef.current = 0;
      lastUrgentEntryIdRef.current = '';
    }
    if (sessionState.status === 'ended' && phase === 'meeting') {
      summaryTranscriptRef.current = sessionState.transcript;
      summaryAiMessagesRef.current = sessionState.aiMessages;
      setSummaryView(null);
      setSummaryContent('');
      setPhase('summary');
    }
  }, [sessionState?.status, phase]);

  // Entry survey: show once when meeting phase starts
  useEffect(() => {
    if (phase === 'meeting' && !entrySurveyShownRef.current) {
      entrySurveyShownRef.current = true;
      setTimeout(() => setActiveSurvey('entry'), 800);
    }
  }, [phase]);

  // Host: trigger analysis when transcript grows
  useEffect(() => {
    if (phase !== 'meeting' || !isHost || !sessionState) return;
    const entries = sessionState.transcript;
    if (entries.length === 0) return;

    // 긴급 체크: 2개마다 (매 발화 → 절반으로 줄여 API 절약)
    const latest = entries[entries.length - 1];
    if (latest && latest.id !== lastUrgentEntryIdRef.current && latest.text.length >= 8) {
      lastUrgentEntryIdRef.current = latest.id;
      if (entries.length % 3 === 0) runUrgentCheck(entries);
    }

    const newEntries = entries.slice(lastAnalyzedCountRef.current);
    const newCharCount = newEntries.reduce((sum, e) => sum + e.text.length, 0);
    const shouldAnalyze =
      (newEntries.length >= 3 && newCharCount >= 60) ||
      newEntries.length >= 7;
    if (shouldAnalyze) {
      lastAnalyzedCountRef.current = entries.length;
      runAnalysis(entries);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState?.transcript.length, phase, isHost]);

  const runAnalysis = useCallback(async (entries: SessionTranscriptEntry[]) => {
    if (isAnalyzingRef.current || !sessionCodeRef.current) return;
    if (sessionCallCountRef.current >= MAX_SESSION_CALLS) return;
    sessionCallCountRef.current++;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    try {
      const transcriptText = entries
        .map((e) => `[${e.time}] ${e.speaker ? `${e.speaker}: ` : ''}${e.text}`)
        .join('\n');
      // 직전 AI 개입 3개 전달 — 같은 말 반복 방지
      const recentAiContent = (sessionState?.aiMessages ?? [])
        .filter((m) => m.role === 'ai')
        .slice(-3)
        .map((m) => `• ${m.content.slice(0, 80)}${m.content.length > 80 ? '…' : ''}`)
        .join('\n');
      const result = await callApi(
        buildAutoPrompt(teamSummaryRef.current, meetingContextRef.current, transcriptText, recentAiContent),
        '위 대화를 분석해주세요.',
        512,
      );
      if (result.trim() === 'SKIP') return;
      await fbAddAiMessage(sessionCodeRef.current, {
        content: result,
        isAlert: false,
        role: 'ai',
        createdAt: Date.now(),
      });
      analysisFailCountRef.current = 0;
      setAiError(false);
    } catch {
      analysisFailCountRef.current++;
      if (analysisFailCountRef.current >= 2) setAiError(true);
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  }, []);

  const runUrgentCheck = useCallback(async (entries: SessionTranscriptEntry[]) => {
    if (isUrgentCheckingRef.current || !sessionCodeRef.current) return;
    if (urgentCallCountRef.current >= MAX_URGENT_CALLS) return;
    urgentCallCountRef.current++;
    isUrgentCheckingRef.current = true;
    try {
      const recentLines = entries
        .slice(-2)
        .map((e) => `${e.speaker ? `${e.speaker}: ` : ''}${e.text}`)
        .join('\n');
      const result = await callApi(buildUrgentCheckPrompt(recentLines), '판단해주세요.', 100);
      if (result.trim() === 'SKIP' || !result.startsWith('⚡')) return;
      await fbAddAiMessage(sessionCodeRef.current, {
        content: result,
        isAlert: true,
        role: 'ai',
        createdAt: Date.now(),
      });
      setAiError(false);
      analysisFailCountRef.current = 0;
    } catch {
      // silent
    } finally {
      isUrgentCheckingRef.current = false;
    }
  }, []);

  const handleDeleteTranscript = useCallback(async (entryId: string) => {
    if (!sessionCodeRef.current) return;
    try { await fbRemoveTranscript(sessionCodeRef.current, entryId); } catch { /* ignore */ }
  }, []);

  const handleEditTranscript = useCallback(async (entryId: string, newText: string) => {
    if (!sessionCodeRef.current) return;
    try { await fbUpdateTranscriptText(sessionCodeRef.current, entryId, newText); } catch { /* ignore */ }
  }, []);

  const handleVoiceResult = useCallback(async (text: string) => {
    if (!sessionCodeRef.current) {
      showToast('세션 없음 — 방 코드를 확인하세요', 'error');
      return;
    }
    const now = Date.now();
    // 8초 이내 동일 텍스트 중복 전송 방지 (Whisper hallucination 루프 방어)
    recentlySentRef.current.forEach((t, k) => {
      if (now - t > 8000) recentlySentRef.current.delete(k);
    });
    if (recentlySentRef.current.has(text)) return;
    recentlySentRef.current.set(text, now);
    const nowDate = new Date(now);
    const time = `${String(nowDate.getHours()).padStart(2, '0')}:${String(nowDate.getMinutes()).padStart(2, '0')}`;
    try {
      // 원본 텍스트 즉시 저장 → 화면에 바로 표시
      const entryId = await fbAddTranscript(sessionCodeRef.current, {
        text,
        time,
        createdAt: now,
      });
      // 백그라운드에서 Claude 교정 후 업데이트
      const code = sessionCodeRef.current;
      correctTranscript(text).then((corrected) => {
        if (corrected !== text && code) {
          fbUpdateTranscriptText(code, entryId, corrected);
        }
      });
    } catch (err) {
      showToast(`저장 오류: ${err instanceof Error ? err.message : String(err)}`, 'error');
    }
  }, []);

  const { isListening, isSupported, toggle, stop } = useVoiceRecognition({
    onResult: handleVoiceResult,
    onInterim: setInterimText,
    onError: (err) => {
      if (err.includes('권한')) setMicBlocked(true);
      else showToast(`음성 오류: ${err}`, 'error');
    },
    meetingTopic: sessionState?.topic,
    meetingSpeakers: sessionState
      ? Object.values(sessionState.members).map((m) => m.name).join(', ')
      : undefined,
  });
  stopRef.current = stop;

  // 디버그: 음성 인식 지원 여부 확인
  useEffect(() => {
    if (!isSupported) showToast('마이크가 지원되지 않는 브라우저예요. Chrome 또는 Safari를 사용해 주세요.', 'error');
  }, [isSupported]);

  // AI 신호: 새 AI 메시지 → 딩 + 진동 + 뱃지 + 모바일 알림 배너
  useEffect(() => {
    if (phase !== 'meeting') { prevAiLengthRef.current = 0; return; }
    const aiMessages = (sessionState?.aiMessages ?? []).filter((m) => m.role === 'ai');
    const aiOnlyCount = aiMessages.length;
    if (prevAiLengthRef.current > 0 && aiOnlyCount > prevAiLengthRef.current) {
      const newMsgs = aiOnlyCount - prevAiLengthRef.current;
      const latest = aiMessages[aiMessages.length - 1];
      const isSkip = latest?.content?.trim().startsWith('SKIP');

      // SKIP 메시지는 소리·진동·팝업 없이 조용히 기록만
      if (!isSkip) {
        if (!isSoundMuted) playDing();
        try { navigator.vibrate?.(200); } catch { /* ignore */ }
      }
      setFlashAiPanel(true);
      setTimeout(() => setFlashAiPanel(false), 1200);

      if (!isSkip) {
        if (overlayModeRef.current) {
          // 오버레이 카드 모드: 전체 화면에 카드로 표시
          if (latest) {
            if (overlayCardTimerRef.current) clearTimeout(overlayCardTimerRef.current);
            const showCard = () => {
              setOverlayCard({ content: latest.content, isAlert: latest.isAlert });
              overlayCardTimerRef.current = setTimeout(() => {
                setOverlayCard(null);
                overlayCardTimerRef.current = null;
              }, 12000);
            };
            if (latest.isAlert) {
              showCard();
            } else {
              overlayCardTimerRef.current = setTimeout(showCard, 2000);
            }
          }
          if (activeTabRef.current !== 'ai') setUnreadAiCount((prev) => prev + newMsgs);
        } else {
          // 탭 모드 (기본): 모바일 배너 표시
          const isDesktop = typeof window !== 'undefined' && window.matchMedia('(min-width: 640px)').matches;
          if (!isDesktop && activeTabRef.current !== 'ai') {
            setUnreadAiCount((prev) => prev + newMsgs);
            if (latest) {
              if (aiNotificationTimerRef.current) clearTimeout(aiNotificationTimerRef.current);
              setAiNotification({ content: latest.content, isAlert: latest.isAlert });
              aiNotificationTimerRef.current = setTimeout(() => {
                setAiNotification(null);
                aiNotificationTimerRef.current = null;
              }, 8000);
            }
          }
        }
      }
    }
    prevAiLengthRef.current = aiOnlyCount;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionState?.aiMessages?.length, phase]);

  // 진행 시간 타이머
  useEffect(() => {
    if (phase !== 'meeting') { setElapsed(0); return; }
    if (!meetingStartTimeRef.current) meetingStartTimeRef.current = Date.now();
    const id = setInterval(() => {
      setElapsed(Math.floor((Date.now() - meetingStartTimeRef.current) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [phase]);

  const handleChatSend = useCallback(async () => {
    const text = chatInput.trim();
    if (!text || isChatting || !sessionCodeRef.current) return;
    if (containsProfanity(text)) { showToast('비속어가 포함된 메시지는 전송할 수 없어요.', 'error'); return; }

    setChatInput('');
    setIsChatting(true);
    setActiveTab('ai');

    const userMsg: ApiMessage = { role: 'user', content: text };
    await fbAddAiMessage(sessionCodeRef.current, {
      content: text,
      isAlert: false,
      role: 'user',
      createdAt: Date.now(),
    });

    const transcriptText = (sessionState?.transcript ?? [])
      .map((e) => `[${e.time}] ${e.speaker ? `${e.speaker}: ` : ''}${e.text}`)
      .join('\n');

    const history: ApiMessage[] = [...chatHistoryRef.current, userMsg];
    try {
      const result = await callApi(
        buildChatSystemPrompt(teamSummaryRef.current, meetingContextRef.current, transcriptText),
        text,
        512,
        history,
      );
      chatHistoryRef.current = [...history, { role: 'ai', content: result }];
      await fbAddAiMessage(sessionCodeRef.current, {
        content: result,
        isAlert: false,
        role: 'ai',
        createdAt: Date.now() + 1,
      });
    } catch {
      showToast('AI 응답 오류가 발생했어요.', 'error');
      chatHistoryRef.current = history;
    } finally {
      setIsChatting(false);
      setTimeout(() => chatInputRef.current?.focus(), 50);
    }
  }, [chatInput, isChatting, showToast, sessionState?.transcript]);

  // ── CREATE OR JOIN ──────────────────────────────────────────────────────────
  // 복원 중 로딩 스피너 (localStorage에 코드 있지만 Firebase 아직 응답 전)
  if (phase === 'createOrJoin' && sessionCode !== null && sessionState === undefined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <div key={i} className="w-2 h-2 rounded-full bg-accent animate-pulse" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
        <p className="text-slate-500 text-sm">이전 회의방 복원 중...</p>
      </div>
    );
  }

  if (phase === 'createOrJoin') {
    const handleCreate = async () => {
      if (!myName.trim()) { showToast('이름을 입력하세요', 'error'); return; }
      if (!isFirebaseConfigured) { showToast('Firebase 설정이 필요해요', 'error'); return; }
      setIsCreating(true);
      try {
        const code = await createSession(deviceIdRef.current, myName.trim());
        saveSession(code, myName.trim());
        setSessionCode(code);
        setPhase('lobby');
      } catch {
        showToast('방 생성 실패. 다시 시도해 주세요.', 'error');
      } finally {
        setIsCreating(false);
      }
    };

    const handleJoin = async () => {
      const code = joinCodeInput.trim().toUpperCase();
      if (!myName.trim()) { showToast('이름을 입력하세요', 'error'); return; }
      if (!code) { setJoinError('방 코드를 입력하세요'); return; }
      if (!isFirebaseConfigured) { showToast('Firebase 설정이 필요해요', 'error'); return; }
      setIsJoining(true);
      setJoinError('');
      try {
        const ok = await joinSession(code, deviceIdRef.current, myName.trim());
        if (!ok) { setJoinError('존재하지 않거나 이미 시작된 방이에요'); return; }
        saveSession(code, myName.trim());
        setSessionCode(code);
        setPhase('lobby');
      } catch {
        setJoinError('참가 실패. 다시 시도해 주세요.');
      } finally {
        setIsJoining(false);
      }
    };

    return (
      <div className="max-w-sm mx-auto px-4 py-16">
        <h1 className="text-2xl font-bold text-center mb-2">AI 팀 중재자</h1>
        <p className="text-slate-400 text-sm text-center mb-10">실시간 멀티기기 회의 중재</p>

        {!isFirebaseConfigured && (
          <div className="mb-6 card border-yellow-500/40 bg-yellow-500/10">
            <p className="text-yellow-300 text-sm font-medium mb-1">Firebase 미설정</p>
            <p className="text-slate-400 text-xs leading-relaxed">
              멀티기기 실시간 기능을 사용하려면 Firebase Realtime Database를 연결해야 해요.
              <br /><code className="text-yellow-300 text-[11px]">NEXT_PUBLIC_FIREBASE_*</code> 환경변수를 설정하세요.
            </p>
          </div>
        )}

        <div className="card space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">내 이름</label>
            <input
              className="input-base w-full text-sm"
              placeholder="회의에서 표시될 이름"
              value={myName}
              onChange={(e) => setMyName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !showJoinInput && handleCreate()}
            />
          </div>

          {!showJoinInput ? (
            <div className="space-y-2 pt-1">
              <button
                className="btn-primary w-full"
                onClick={handleCreate}
                disabled={isCreating || !myName.trim()}
              >
                {isCreating ? '생성 중...' : '새 회의 만들기'}
              </button>
              <button
                className="btn-secondary w-full text-sm"
                onClick={() => setShowJoinInput(true)}
              >
                회의 참가하기
              </button>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              <input
                className="input-base w-full text-sm font-mono tracking-widest"
                placeholder="방 코드 (예: A3BX7K)"
                value={joinCodeInput}
                onChange={(e) => { setJoinCodeInput(e.target.value.toUpperCase()); setJoinError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                autoFocus
              />
              {joinError && <p className="text-xs text-red-400">{joinError}</p>}
              <button
                className="btn-primary w-full"
                onClick={handleJoin}
                disabled={isJoining || !joinCodeInput.trim()}
              >
                {isJoining ? '참가 중...' : '참가하기'}
              </button>
              <button
                className="btn-secondary w-full text-sm"
                onClick={() => { setShowJoinInput(false); setJoinError(''); setJoinCodeInput(''); }}
              >
                취소
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-slate-600 leading-relaxed mt-2">
          회의 내용은 멀티기기 동기화 목적으로 임시 저장되며<br />
          회의 종료 후 자동으로 삭제됩니다.
        </p>
      </div>
    );
  }

  // ── LOBBY ──────────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    const members = sessionState ? Object.entries(sessionState.members) : [];
    const memberList = members.map(([dId, m]) => ({ id: dId, name: m.name }));
    const setupChat = sessionState?.setupChat ?? [];

    const handleHostStart = async (context: string) => {
      if (!sessionCodeRef.current) return;
      try {
        const names = Object.values(sessionState?.members ?? {}).map((m) => m.name).join(', ');
        await setTopic(sessionCodeRef.current, context);
        await fbAddAiMessage(sessionCodeRef.current, {
          content: `회의를 시작합니다. 🎙\n\n${names ? `참가자: ${names}\n` : ''}${context ? `\n${context}` : ''}\n\n마이크를 켜고 대화를 시작하세요. AI가 갈등이나 중요한 상황을 감지하면 자동으로 중재합니다.`,
          isAlert: false,
          role: 'ai',
          createdAt: Date.now(),
        });
        await startMeeting(sessionCodeRef.current);
      } catch {
        showToast('회의 시작 실패. 다시 시도해 주세요.', 'error');
      }
    };

    return (
      <div className="max-w-lg mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold">로비</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              방 코드:{' '}
              <span className="font-mono font-bold text-accent tracking-widest">{sessionCode}</span>
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-mono bg-accent/10 text-accent border border-accent/20">
            {isHost ? '호스트' : '참가자'}
          </span>
          <button
            onClick={handleNewMeeting}
            className="ml-auto px-3 py-1.5 text-xs rounded-lg border border-border text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
          >
            새 회의방 만들기
          </button>
        </div>

        {/* Member list */}
        <div className="card mb-4">
          <p className="text-xs text-slate-500 mb-3">참가 중인 멤버</p>
          {sessionState ? (
            <div className="space-y-2">
              {memberList.map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0">
                    {m.name[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-200 flex-1">{m.name}</span>
                  {m.id === sessionState.host && (
                    <span className="text-[10px] text-accent/60 font-mono">호스트</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">로딩 중...</p>
          )}
        </div>

        {isHost ? (
          <div>
            <p className="text-xs text-slate-500 mb-3">회의 정보를 입력하고 시작하세요</p>
            <MeetingSetup
              members={memberList}
              onStart={handleHostStart}
            />
          </div>
        ) : (
          <div className="card space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
              <p className="text-sm text-slate-400">호스트가 회의를 설정 중이에요</p>
            </div>
            {setupChat.length > 0 ? (
              <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                {setupChat.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] px-3 py-1.5 rounded-2xl text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-accent/20 text-slate-200 rounded-tr-sm'
                        : 'bg-surface2 border border-border text-slate-300 rounded-tl-sm'
                    }`}>
                      {msg.text}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-600">회의가 시작되면 자동으로 연결됩니다</p>
            )}
          </div>
        )}
      </div>
    );
  }

  const handleSurveySubmit = async (answers: Record<string, string | string[]>) => {
    const type = activeSurvey!;
    setActiveSurvey(null);
    try {
      await saveSurvey({ type, sessionCode: sessionCodeRef.current, deviceId: deviceIdRef.current, answers });
    } catch { /* ignore */ }
    if (type === 'exit' && pendingEndRef.current) {
      pendingEndRef.current = false;
      handleNewMeeting();
    }
  };

  const handleSurveySkip = () => {
    const type = activeSurvey!;
    setActiveSurvey(null);
    if (type === 'exit' && pendingEndRef.current) {
      pendingEndRef.current = false;
      handleNewMeeting();
    }
  };

  // ── SUMMARY ──────────────────────────────────────────────────────────────────
  if (phase === 'summary') {
    const transcript = summaryTranscriptRef.current;
    const aiMsgs = summaryAiMessagesRef.current;

    const teamSummaryForSummary = Object.values(sessionState?.members ?? {}).map((m) => m.name).join(', ');
    const topicForSummary = sessionState?.topic ?? meetingContextRef.current;

    const SUMMARY_ACTIONS = [
      {
        key: 'action-items' as const,
        emoji: '📋',
        title: '액션 아이템',
        desc: '결정 사항 · 담당자별 할 일 · 미결 사항',
        color: 'from-green-500/20 to-green-500/5 border-green-500/30 hover:border-green-400/60',
        textColor: 'text-green-300',
      },
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

    const handleSummarySelect = async (view: Exclude<SummaryView, null>) => {
      if (isSummarizing) return;
      setSummaryView(view);
      setSummaryContent('');
      setIsSummarizing(true);
      const transcriptText = transcript
        .map((e) => `[${e.time}] ${e.speaker ? `${e.speaker}: ` : ''}${e.text}`)
        .join('\n');
      const aiInterventions = aiMsgs
        .filter((m) => m.role === 'ai')
        .slice(1)
        .map((m, i) => `[개입 ${i + 1}] ${m.content}`)
        .join('\n\n');
      try {
        let prompt = '';
        if (view === 'action-items') prompt = buildActionItemsPrompt(teamSummaryForSummary, topicForSummary, transcriptText);
        else if (view === 'analysis') prompt = buildAnalysisPrompt(teamSummaryForSummary, topicForSummary, transcriptText);
        else prompt = buildNextTopicsPrompt(teamSummaryForSummary, topicForSummary, transcriptText);
        const result = await callApi(prompt, '분석해주세요.', 3000);
        setSummaryContent(result);
      } catch {
        setSummaryContent('분석 중 오류가 발생했습니다. 다시 시도해 주세요.');
      } finally {
        setIsSummarizing(false);
      }
    };

    const handleCopySummary = async () => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const viewLabel = SUMMARY_ACTIONS.find((a) => a.key === summaryView)?.title ?? '회의 분석';
      const lines = [
        `[ ${viewLabel} ]`,
        `날짜: ${dateStr}`,
        topicForSummary ? `주제: ${topicForSummary}` : '',
        teamSummaryForSummary ? `팀: ${teamSummaryForSummary}` : '',
        '',
        summaryContent,
        '',
        '━━━ 대화 기록 ━━━',
        ...transcript.map((e) => `[${e.time}] ${e.speaker ? `${e.speaker}: ` : ''}${e.text}`),
      ].filter(Boolean);
      try {
        await navigator.clipboard.writeText(lines.join('\n'));
        showToast('클립보드에 복사됐어요!', 'success');
      } catch { showToast('복사 실패.', 'error'); }
    };

    const handleExportSummary = () => {
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      const viewLabel = SUMMARY_ACTIONS.find((a) => a.key === summaryView)?.title ?? '회의분석';
      const lines = [
        `[ ${viewLabel} ]`,
        `날짜: ${dateStr}`,
        topicForSummary ? `주제: ${topicForSummary}` : '',
        teamSummaryForSummary ? `팀: ${teamSummaryForSummary}` : '',
        '',
        summaryContent,
        '',
        '━━━ 대화 기록 ━━━',
        ...transcript.map((e) => `[${e.time}] ${e.speaker ? `${e.speaker}: ` : ''}${e.text}`),
        '',
        '━━━ AI 중재 내용 ━━━',
        ...aiMsgs.filter((m) => m.role === 'ai').slice(1).map((m, i) => `[${i+1}] ${m.content}`),
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
      <>
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-slate-200">회의 종료</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={async () => {
                try { if (sessionCodeRef.current) await startMeeting(sessionCodeRef.current); } catch { /* ignore */ }
                setPhase('meeting');
              }}
              className="px-3 py-1.5 text-xs rounded-lg border border-border text-slate-500 hover:text-slate-300 hover:border-slate-500 transition-colors"
            >
              ← 회의로 돌아가기
            </button>
            <button
              onClick={handleNewMeeting}
              className="px-3 py-1.5 text-xs rounded-lg border border-border text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
            >
              새 회의 시작
            </button>
          </div>
        </div>
        {topicForSummary && <p className="text-xs text-slate-500 mb-5">{topicForSummary}</p>}

        <div className="flex flex-wrap gap-3 mb-6 text-xs text-slate-500">
          {teamSummaryForSummary && <span className="px-2.5 py-1 rounded-full bg-white/5">👥 {teamSummaryForSummary}</span>}
          <span className="px-2.5 py-1 rounded-full bg-white/5">🎙 발화 {transcript.length}개</span>
          <span className="px-2.5 py-1 rounded-full bg-white/5">🤖 AI 개입 {Math.max(0, aiMsgs.filter((m) => m.role === 'ai').length - 1)}회</span>
        </div>

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
                onClick={() => { pendingEndRef.current = true; setActiveSurvey('exit'); }}
                className="w-full py-3 rounded-2xl border border-border text-sm text-slate-500 hover:text-red-400 hover:border-red-500/30 transition-all"
              >
                종료하기
              </button>
            </div>
          </>
        )}

        {summaryView !== null && (
          <>
            <div className="flex items-center gap-3 mb-4">
              <button
                onClick={() => { setSummaryView(null); setSummaryContent(''); }}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
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
                  <div className="whitespace-pre-wrap text-sm text-slate-300 leading-relaxed">{summaryContent}</div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleCopySummary} className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-border text-slate-400 hover:text-accent hover:border-accent/40 transition-colors">복사</button>
                  <button onClick={handleExportSummary} className="flex-1 py-2.5 text-sm font-medium rounded-xl border border-border text-slate-400 hover:text-accent hover:border-accent/40 transition-colors">파일 내보내기</button>
                </div>
              </>
            )}
          </>
        )}
      </div>

      {activeSurvey === 'exit' && (
        <SurveyModal
          title="회의 후기를 남겨주세요"
          subtitle="4문항 · 1분"
          questions={EXIT_QUESTIONS}
          onSubmit={handleSurveySubmit}
          onSkip={handleSurveySkip}
        />
      )}
      </>
    );
  }

  // ── MEETING ROOM ──────────────────────────────────────────────────────────────
  const sessionMembers = sessionState
    ? Object.entries(sessionState.members).map(([dId, m]) => ({ id: dId, name: m.name }))
    : [];
  const teamSummary = sessionMembers.map((m) => m.name).join(', ');
  const firebaseTranscript = sessionState?.transcript ?? [];
  const firebaseAiMessages = sessionState?.aiMessages ?? [];

  // Convert Firebase aiMessages to Message[] for ChatWindow
  const displayMessages: Message[] = firebaseAiMessages.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: String(m.createdAt),
    isAlert: m.isAlert,
  }));

  // Convert Firebase transcript to TranscriptEntry[] for LiveTranscript
  const displayTranscript: TranscriptEntry[] = firebaseTranscript.map((e) => ({
    id: e.id,
    text: e.text,
    time: e.time,
    speaker: e.speaker,
  }));

  const handleManualAsk = async () => {
    if (isAnalyzingRef.current || !sessionCodeRef.current) return;
    isAnalyzingRef.current = true;
    setIsAnalyzing(true);
    try {
      const transcriptText = firebaseTranscript.length > 0
        ? firebaseTranscript.map((e) => `[${e.time}] ${e.text}`).join('\n')
        : '(아직 대화 내용 없음)';
      const result = await callApi(
        buildSystemPrompt(meetingContextRef.current, teamSummaryRef.current),
        `지금까지 대화 내용:\n${transcriptText}\n\n현재 상황을 분석하고 중재 의견을 주세요.`,
      );
      await fbAddAiMessage(sessionCodeRef.current, {
        content: result,
        isAlert: false,
        role: 'ai',
        createdAt: Date.now(),
      });
      setActiveTab('ai');
    } catch (err) {
      showToast(`AI 오류: ${err instanceof Error ? err.message : '오류'}`, 'error');
    } finally {
      isAnalyzingRef.current = false;
      setIsAnalyzing(false);
    }
  };

  const handleCopy = async () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const lines = [
      '[ 회의 기록 ]',
      `날짜: ${dateStr}`,
      meetingContextRef.current ? `주제: ${meetingContextRef.current}` : '',
      teamSummaryRef.current ? `팀 구성: ${teamSummaryRef.current}` : '',
      '',
      '━━━ 대화 기록 ━━━',
      ...firebaseTranscript.map((e) => `[${e.time}] ${e.text}`),
      '',
      '━━━ AI 중재 내용 ━━━',
      ...firebaseAiMessages.filter((m) => m.role === 'ai').map((m, i) => `[${i+1}] ${m.content}`),
    ].filter(Boolean);
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      showToast('클립보드에 복사됐어요!', 'success');
    } catch { showToast('복사 실패.', 'error'); }
  };

  const handleExport = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const lines = [
      '[ 회의 기록 ]',
      `날짜: ${dateStr}`,
      meetingContextRef.current ? `주제: ${meetingContextRef.current}` : '',
      teamSummaryRef.current ? `팀 구성: ${teamSummaryRef.current}` : '',
      '',
      '━━━ 대화 기록 ━━━',
      ...firebaseTranscript.map((e) => `[${e.time}] ${e.text}`),
      '',
      '━━━ AI 중재 내용 ━━━',
      ...firebaseAiMessages.filter((m) => m.role === 'ai').slice(1).map((m, i) => `[${i+1}] ${m.content}`),
    ].filter((l) => l !== undefined);
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `회의기록_${dateStr}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const doEndMeeting = async () => {
    if (!sessionCodeRef.current) return;
    // Save to local Zustand history
    if (firebaseTranscript.length > 0) {
      saveMeeting({
        topic: meetingContextRef.current,
        teamSummary: teamSummaryRef.current,
        transcript: firebaseTranscript.map((e) => ({
          id: e.id,
          text: e.text,
          time: e.time,
          speaker: e.speaker,
        })),
        aiMessages: firebaseAiMessages
          .filter((m) => m.role === 'ai')
          .slice(1)
          .map((m) => ({
            id: m.id,
            role: 'ai' as const,
            content: m.content,
            timestamp: String(m.createdAt),
            isAlert: m.isAlert,
          })),
      });
    }
    summaryTranscriptRef.current = firebaseTranscript;
    summaryAiMessagesRef.current = firebaseAiMessages;
    await endMeeting(sessionCodeRef.current);
    // 60초 후 Firebase에서 세션 데이터 삭제 (회의 내용 자동 파기)
    const codeToDelete = sessionCodeRef.current;
    setTimeout(() => { deleteSession(codeToDelete).catch(() => {}); }, 60_000);
    // Phase transition happens via useEffect watching sessionState.status
  };

  const handleEnd = async () => {
    stop();
    setUnreadAiCount(0);
    await doEndMeeting();
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 4rem)' }}>

      {micBlocked && (
        <div className="shrink-0 flex items-start gap-3 px-4 py-3 bg-red-500/10 border-b border-red-500/30 text-sm text-red-300">
          <span className="shrink-0 mt-0.5">🎙</span>
          <div className="flex-1">
            <p className="font-medium">마이크 권한이 차단되어 있어요</p>
            <p className="text-xs text-red-400/80 mt-0.5">브라우저 자물쇠 아이콘 → 마이크 → 허용 → 새로고침</p>
          </div>
          <button onClick={() => setMicBlocked(false)} className="shrink-0 text-red-400/60 hover:text-red-300">✕</button>
        </div>
      )}

      {aiError && (
        <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-yellow-500/10 border-b border-yellow-500/30 text-xs text-yellow-300">
          <span>⚠️</span>
          <span className="flex-1">AI 분석 연결에 문제가 있어요. 자동 중재가 일시 중단됐어요.</span>
          <button onClick={() => { setAiError(false); analysisFailCountRef.current = 0; }} className="shrink-0 text-yellow-400/60 hover:text-yellow-300">✕</button>
        </div>
      )}

      {/* 모바일 AI 알림 배너: AI탭이 아닐 때도 중재 내용을 즉시 표시 */}
      {aiNotification && (
        <div className={`sm:hidden shrink-0 flex items-start gap-3 px-4 py-3 border-b text-sm animate-fadeIn ${
          aiNotification.isAlert
            ? 'bg-orange-500/15 border-orange-500/40 text-orange-100'
            : 'bg-violet-500/15 border-violet-500/40 text-slate-200'
        }`}>
          <span className="shrink-0 mt-0.5 text-base">{aiNotification.isAlert ? '⚡' : '🤖'}</span>
          <p className="flex-1 text-xs leading-relaxed line-clamp-3">{aiNotification.content}</p>
          <button
            onClick={() => {
              setAiNotification(null);
              if (aiNotificationTimerRef.current) { clearTimeout(aiNotificationTimerRef.current); aiNotificationTimerRef.current = null; }
              setActiveTab('ai');
              setUnreadAiCount(0);
            }}
            className="shrink-0 text-xs opacity-60 hover:opacity-100 px-2 py-1 rounded bg-white/10"
          >
            자세히
          </button>
          <button
            onClick={() => {
              setAiNotification(null);
              if (aiNotificationTimerRef.current) { clearTimeout(aiNotificationTimerRef.current); aiNotificationTimerRef.current = null; }
            }}
            className="shrink-0 opacity-40 hover:opacity-80 text-base leading-none"
          >
            ✕
          </button>
        </div>
      )}

      {/* header */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full transition-colors ${isListening ? 'bg-red-400 animate-pulse' : 'bg-slate-600'}`} />
          <span className="text-sm font-medium text-slate-200">{isListening ? '녹음 중' : '대기 중'}</span>
          {sessionCode && (
            <span className="hidden sm:inline text-xs text-slate-600 ml-1 font-mono">{sessionCode}</span>
          )}
          {teamSummary && (
            <span className="hidden sm:inline text-xs text-slate-500 ml-2">{teamSummary}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
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
          <button
            onClick={() => setActiveTab((t) => t === 'overview' ? 'transcript' : 'overview')}
            className={`hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'overview' ? 'bg-accent/20 text-accent' : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
            }`}
          >
            오버뷰
          </button>
          <button
            onClick={() => setIsSoundMuted((v) => !v)}
            title={isSoundMuted ? '소리 켜기' : '소리 끄기'}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            {isSoundMuted ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.536 8.464a5 5 0 010 7.072M12 6v12m0 0l-4.243-4.243M12 18l4.243-4.243M12 6L7.757 10.243M12 6l4.243 4.243" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707A1 1 0 0112 5v14a1 1 0 01-1.707.707L5.586 15z" />
              </svg>
            )}
          </button>
          <div className="flex items-center gap-1.5">
            <span className={`text-[10px] font-medium transition-colors ${!overlayMode ? 'text-slate-300' : 'text-slate-600'}`}>탭 알림</span>
            <button
              onClick={() => setOverlayMode((v) => !v)}
              title={overlayMode ? '탭 알림 모드로 전환' : '팝업 모드로 전환'}
              className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${overlayMode ? 'bg-accent/50' : 'bg-slate-600/60'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${overlayMode ? 'left-[18px]' : 'left-0.5'}`} />
            </button>
            <span className={`text-[10px] font-medium transition-colors ${overlayMode ? 'text-accent' : 'text-slate-600'}`}>팝업</span>
          </div>
        </div>
      </div>

      {/* mobile tab bar */}
      <div className="sm:hidden shrink-0 flex border-b border-border bg-surface">
        <button
          onClick={() => setActiveTab('transcript')}
          className={`flex-1 py-2 text-xs font-medium transition-colors relative ${activeTab === 'transcript' ? 'text-accent' : 'text-slate-500'}`}
        >
          대화 기록
          {activeTab === 'transcript' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
        </button>
        <button
          onClick={() => { setActiveTab('ai'); setUnreadAiCount(0); setAiNotification(null); if (aiNotificationTimerRef.current) { clearTimeout(aiNotificationTimerRef.current); aiNotificationTimerRef.current = null; } }}
          className={`flex-1 py-2 text-xs font-medium transition-colors relative ${
            unreadAiCount > 0 ? 'text-violet-400' : activeTab === 'ai' ? 'text-accent' : 'text-slate-500'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            AI 중재
            {unreadAiCount > 0 && (
              <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-violet-500 text-white text-[9px] font-bold shrink-0 animate-bounce">
                {unreadAiCount > 9 ? '9+' : unreadAiCount}
              </span>
            )}
          </span>
          {activeTab === 'ai' && unreadAiCount === 0 && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
          {unreadAiCount > 0 && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-500 animate-pulse" />}
        </button>
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex-1 py-2 text-xs font-medium transition-colors relative ${activeTab === 'overview' ? 'text-accent' : 'text-slate-500'}`}
        >
          오버뷰
          {activeTab === 'overview' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
        </button>
      </div>

      {/* two-panel */}
      <div className="flex-1 min-h-0 flex overflow-hidden">

        {/* Overview panel */}
        {activeTab === 'overview' && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {/* Duration */}
            <div className="card text-center py-5">
              <p className="text-4xl font-mono font-bold text-slate-100 tabular-nums">
                {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
              </p>
              <p className="text-xs text-slate-500 mt-1">진행 시간</p>
            </div>

            {/* Topic */}
            {meetingContextRef.current && (
              <div className="card">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">회의 주제</p>
                <p className="text-sm text-slate-200 leading-relaxed">{meetingContextRef.current}</p>
              </div>
            )}

            {/* Room + members */}
            <div className="card space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">방 코드</p>
                <button
                  onClick={() => { navigator.clipboard.writeText(sessionCode ?? ''); showToast('방 코드 복사됨', 'success'); }}
                  className="flex items-center gap-2 group"
                >
                  <span className="font-mono font-bold text-accent tracking-widest text-sm">{sessionCode}</span>
                  <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-accent transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </button>
              </div>
              {/* Share URL */}
              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">초대 링크</p>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/ai`;
                    const text = `방 코드: ${sessionCode}\n${url}`;
                    navigator.clipboard.writeText(text);
                    showToast('초대 링크 복사됨', 'success');
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-white/4 border border-border hover:border-accent/30 hover:bg-accent/5 transition-colors group text-left"
                >
                  <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-accent shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                  </svg>
                  <span className="text-[11px] text-slate-400 group-hover:text-slate-300 truncate flex-1 transition-colors font-mono">
                    {typeof window !== 'undefined' ? window.location.host : ''}/ai
                  </span>
                  <svg className="w-3.5 h-3.5 text-slate-600 group-hover:text-accent shrink-0 transition-colors" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                  </svg>
                </button>
              </div>
              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">참가자 {sessionMembers.length}명</p>
                <div className="space-y-2">
                  {sessionMembers.map((m) => (
                    <div key={m.id} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-accent/10 text-accent flex items-center justify-center text-xs font-bold shrink-0">
                        {m.name[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm text-slate-200 flex-1">{m.name}</span>
                      {sessionState?.host === m.id && (
                        <span className="text-[10px] text-accent/60 font-mono">호스트</span>
                      )}
                      {m.id === deviceIdRef.current && (
                        <span className="text-[10px] text-slate-600 font-mono">나</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-3">
              <div className="card text-center py-4">
                <p className="text-3xl font-bold text-slate-100 tabular-nums">{firebaseTranscript.length}</p>
                <p className="text-xs text-slate-500 mt-1">발화 수</p>
              </div>
              <div className="card text-center py-4">
                <p className="text-3xl font-bold text-slate-100 tabular-nums">{Math.max(0, firebaseAiMessages.filter((m) => m.role === 'ai').length - 1)}</p>
                <p className="text-xs text-slate-500 mt-1">AI 개입</p>
              </div>
            </div>
          </div>
        )}

        {activeTab !== 'overview' && (
          <div className={`flex-col overflow-hidden min-h-0 sm:flex sm:flex-1 sm:border-r sm:border-border ${activeTab === 'transcript' ? 'flex flex-1' : 'hidden'}`}>
            <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/40">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">대화 기록</p>
            </div>
            <LiveTranscript entries={displayTranscript} interimText={interimText} onDelete={handleDeleteTranscript} onEdit={handleEditTranscript} />
          </div>
        )}

        {activeTab !== 'overview' && (
          <div className={`flex-col overflow-hidden min-h-0 sm:flex sm:flex-1 ${activeTab === 'ai' ? 'flex flex-1' : 'hidden'}`}>
            <div className={`shrink-0 px-4 pt-3 pb-2 border-b border-border/40 transition-colors duration-500 ${flashAiPanel ? 'bg-violet-500/8' : ''}`}>
              <p className={`text-[10px] font-mono uppercase tracking-widest transition-colors duration-300 ${flashAiPanel ? 'text-violet-400' : 'text-slate-500'}`}>
                AI 중재{flashAiPanel ? ' ●' : ''}
              </p>
            </div>
            <ChatWindow messages={displayMessages} isLoading={isChatting} suppressScroll={isChatInput} />
            <div className="shrink-0 border-t border-border/40 px-3 py-2.5 flex gap-2 items-center bg-surface">
              <input
                ref={chatInputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                onFocus={() => setIsChatInput(true)}
                onBlur={() => setIsChatInput(false)}
                placeholder="중재자에게 질문 또는 맥락 전달..."
                className="input-base flex-1 text-sm py-2"
                disabled={isChatting}
              />
              <button
                onClick={handleChatSend}
                disabled={isChatting || !chatInput.trim()}
                className="shrink-0 px-3 py-2 rounded-lg bg-accent/20 text-accent text-sm font-medium hover:bg-accent/30 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                전송
              </button>
            </div>
          </div>
        )}
      </div>

      <MeetingControls
        isRecording={isListening}
        isAnalyzing={isAnalyzing}
        onToggleMic={() => { setMicBlocked(false); toggle(); }}
        onManualAsk={handleManualAsk}
        onCopy={handleCopy}
        onExport={handleExport}
        onEnd={handleEnd}
      />

      {/* 오버레이 카드 모드: 새 AI 중재 메시지를 전체화면 팝업으로 표시 */}
      {overlayCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => {
              if (overlayCardTimerRef.current) { clearTimeout(overlayCardTimerRef.current); overlayCardTimerRef.current = null; }
              setOverlayCard(null);
            }}
          />
          <div className={`relative w-full max-w-xl rounded-2xl border p-5 shadow-2xl animate-fadeIn overflow-y-auto max-h-[80vh] ${
            overlayCard.isAlert
              ? 'bg-orange-950/95 border-orange-500/50'
              : 'bg-[#1a1a2e]/95 border-border'
          }`}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center text-sm shrink-0 mt-0.5">
                🤖
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-[10px] font-mono uppercase tracking-widest mb-2 ${overlayCard.isAlert ? 'text-orange-400' : 'text-accent'}`}>
                  {overlayCard.isAlert ? '⚡ 긴급 중재' : 'AI 중재자'}
                </p>
                <p className="text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">{overlayCard.content}</p>
              </div>
            </div>
            <button
              onClick={() => {
                if (overlayCardTimerRef.current) { clearTimeout(overlayCardTimerRef.current); overlayCardTimerRef.current = null; }
                setOverlayCard(null);
              }}
              className={`w-full py-2.5 rounded-xl text-sm font-medium transition-colors ${
                overlayCard.isAlert
                  ? 'bg-orange-500/20 text-orange-300 hover:bg-orange-500/30'
                  : 'bg-accent/15 text-accent hover:bg-accent/25'
              }`}
            >
              확인
            </button>
          </div>
        </div>
      )}

      {/* Survey modals */}
      {activeSurvey === 'entry' && (
        <SurveyModal
          title="빠른 사전 설문"
          subtitle="3문항 · 1분"
          questions={ENTRY_QUESTIONS}
          onSubmit={handleSurveySubmit}
          onSkip={handleSurveySkip}
        />
      )}
      {activeSurvey === 'exit' && (
        <SurveyModal
          title="회의 후기를 남겨주세요"
          subtitle="4문항 · 1분"
          questions={EXIT_QUESTIONS}
          onSubmit={handleSurveySubmit}
          onSkip={handleSurveySkip}
        />
      )}
    </div>
  );
}
