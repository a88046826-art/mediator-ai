'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useAppStore } from '@/store/useAppStore';
import type { Message } from '@/types';
import { MeetingSetup } from '@/components/ai/MeetingSetup';
import { ChatWindow } from '@/components/ai/ChatWindow';
import { LiveTranscript, type TranscriptEntry, COLOR_PALETTE } from '@/components/ai/LiveTranscript';
import { MeetingControls } from '@/components/ai/MeetingControls';
import { useVoiceRecognition } from '@/hooks/useVoiceRecognition';
import { useSession } from '@/hooks/useSession';
import { getDeviceId } from '@/lib/deviceId';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  createSession, joinSession, setTopic,
  startMeeting, endMeeting,
  addTranscript as fbAddTranscript,
  updateTranscriptText as fbUpdateTranscriptText,
  addAiMessage as fbAddAiMessage,
  addSetupEntry,
  type SessionTranscriptEntry, type SessionAiMessage,
} from '@/lib/session';

type Phase = 'createOrJoin' | 'lobby' | 'meeting' | 'summary';
type ActiveTab = 'transcript' | 'ai';
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

function buildSystemPrompt(context: string, teamSummary: string): string {
  return `당신은 스타트업 팀 전문 AI 중재자입니다.

팀 구성: ${teamSummary || '등록된 팀원 없음'}
오늘 회의 주제: ${context || '없음'}

중재 원칙:
- 발화자를 지목하지 않는다. 누가 말했는지 알 수 없기 때문이다.
- 구체적인 다음 행동 1가지를 반드시 제안한다.
- 2-4문장으로 간결하게. 한국어.`;
}

function buildAutoPrompt(teamSummary: string, context: string, transcriptText: string): string {
  return `당신은 실시간 회의를 조용히 모니터링하는 중재자입니다.

팀 구성: ${teamSummary || '없음'}
회의 주제: ${context || '없음'}

대화 내용:
${transcriptText}

개입 기준 — 아래 상황에서만 말하세요. 웬만하면 SKIP:
- 감정적 충돌이나 공격적 언어가 명확히 보일 때
- 대화가 완전히 다른 방향으로 흘러 회의가 무의미해질 때
- 중요한 결정이 내려지는데 반대 의견이 묻히고 있을 때
- 에너지가 눈에 띄게 떨어지거나 아무도 말을 안 할 때

위 상황이 아니면 반드시 "SKIP"만 반환.

개입할 때:
- 자연스럽고 따뜻한 말투로, 3문장 이내
- 구체적인 다음 행동 하나만 제안
한국어.`;
}

function buildUrgentCheckPrompt(recentLines: string): string {
  return `당신은 회의 중재자입니다. 아래 발언에 욕설·인신공격·심한 감정 폭발이 있는지 판단하세요.

${recentLines}

판단 기준: 명백한 욕설, 인신공격, 심한 감정 폭발만 해당입니다.
- 해당 없으면: SKIP
- 해당 있으면: ⚡로 시작하는 즉각 중재 1-2문장 (차분하고 따뜻하게 분위기 완화)
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
  try {
    const result = await callApi(
      '한국어 회의 발화를 교정하세요. "음", "어", "그러니까" 같은 필러는 제거하고 핵심 내용만 남기세요. 원문 의미를 유지하고 교정된 텍스트만 반환하세요. 추가 설명 없이.',
      text,
      150,
    );
    return result.trim() || text;
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
  const [currentSpeaker, setCurrentSpeaker] = useState('');
  const [summaryView, setSummaryView] = useState<SummaryView>(null);
  const [summaryContent, setSummaryContent] = useState('');
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [aiError, setAiError] = useState(false);
  const [micBlocked, setMicBlocked] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isChatting, setIsChatting] = useState(false);
  // snapshot saved when meeting ends (for summary)
  const summaryTranscriptRef = useRef<SessionTranscriptEntry[]>([]);
  const summaryAiMessagesRef = useRef<SessionAiMessage[]>([]);

  const deviceIdRef = useRef('');
  const sessionCodeRef = useRef<string | null>(null);
  sessionCodeRef.current = sessionCode;
  const currentSpeakerRef = useRef('');
  currentSpeakerRef.current = currentSpeaker;
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

  const MAX_SESSION_CALLS = 30;
  const MAX_URGENT_CALLS = 50;

  useEffect(() => {
    deviceIdRef.current = getDeviceId();
  }, []);

  // Firebase session state
  const sessionState = useSession(sessionCode);
  const isHost = sessionState?.host === deviceIdRef.current;

  // Sync refs from Firebase state
  meetingContextRef.current = sessionState?.topic ?? '';
  teamSummaryRef.current = sessionState
    ? Object.values(sessionState.members).map((m) => m.name).join(', ')
    : '';

  // Auto-transition: lobby → meeting when host starts
  useEffect(() => {
    if (!sessionState) return;
    if (sessionState.status === 'meeting' && phase === 'lobby') {
      setPhase('meeting');
      setActiveTab('transcript');
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

  // Host: trigger analysis when transcript grows
  useEffect(() => {
    if (phase !== 'meeting' || !isHost || !sessionState) return;
    const entries = sessionState.transcript;
    if (entries.length === 0) return;

    // Urgent check on new entry (host only)
    const latest = entries[entries.length - 1];
    if (latest && latest.id !== lastUrgentEntryIdRef.current && latest.text.length >= 8) {
      lastUrgentEntryIdRef.current = latest.id;
      runUrgentCheck(entries);
    }

    // Regular analysis every 3 entries
    const recentText = entries.slice(-3).map((e) => e.text).join(' ');
    if (entries.length - lastAnalyzedCountRef.current >= 3 && recentText.length >= 20) {
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
      const result = await callApi(
        buildAutoPrompt(teamSummaryRef.current, meetingContextRef.current, transcriptText),
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
      setActiveTab('ai');
      setAiError(false);
      analysisFailCountRef.current = 0;
    } catch {
      // silent
    } finally {
      isUrgentCheckingRef.current = false;
    }
  }, []);

  const handleVoiceResult = useCallback(async (text: string) => {
    if (!sessionCodeRef.current) {
      showToast('세션 없음 — 방 코드를 확인하세요', 'error');
      return;
    }
    const now = new Date();
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const speaker = currentSpeakerRef.current || undefined;
    try {
      // 원본 텍스트 즉시 저장 → 화면에 바로 표시
      const entryId = await fbAddTranscript(sessionCodeRef.current, {
        text,
        time,
        speaker,
        createdAt: now.getTime(),
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
  });

  // 디버그: 음성 인식 지원 여부 확인
  useEffect(() => {
    if (!isSupported) showToast('이 브라우저는 음성 인식을 지원하지 않아요. Chrome을 사용해 주세요.', 'error');
  }, [isSupported]);

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
  if (phase === 'createOrJoin') {
    const handleCreate = async () => {
      if (!myName.trim()) { showToast('이름을 입력하세요', 'error'); return; }
      if (!isFirebaseConfigured) { showToast('Firebase 설정이 필요해요', 'error'); return; }
      setIsCreating(true);
      try {
        const code = await createSession(deviceIdRef.current, myName.trim());
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
          <span className="ml-auto px-2.5 py-1 rounded-full text-[10px] font-mono bg-accent/10 text-accent border border-accent/20">
            {isHost ? '호스트' : '참가자'}
          </span>
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
              onMessage={(role, text) => {
                if (sessionCodeRef.current) addSetupEntry(sessionCodeRef.current, role, text);
              }}
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

    const handleNewMeeting = () => {
      stop();
      setSessionCode(null);
      setMyName('');
      setJoinCodeInput('');
      setShowJoinInput(false);
      setJoinError('');
      setInterimText('');
      setCurrentSpeaker('');
      setSummaryView(null);
      setSummaryContent('');
      setChatInput('');
      chatHistoryRef.current = [];
      lastAnalyzedCountRef.current = 0;
      sessionCallCountRef.current = 0;
      urgentCallCountRef.current = 0;
      setPhase('createOrJoin');
    };

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold text-slate-200">회의 종료</h1>
          <button
            onClick={handleNewMeeting}
            className="px-3 py-1.5 text-xs rounded-lg border border-border text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
          >
            새 회의 시작
          </button>
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
                onClick={handleNewMeeting}
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

  const speakerColors: Record<string, string> = {};
  sessionMembers.forEach((m, i) => {
    speakerColors[m.name] = COLOR_PALETTE[i % COLOR_PALETTE.length];
  });

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

  const handleEnd = async () => {
    stop();
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
    // Phase transition happens via useEffect watching sessionState.status
  };

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 4rem)' }}>

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
      {sessionMembers.length > 0 && (
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
          {sessionMembers.map((m, i) => (
            <button
              key={m.id}
              onClick={() => setCurrentSpeaker(m.name)}
              className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                currentSpeaker === m.name
                  ? `${COLOR_PALETTE[i % COLOR_PALETTE.length]} bg-white/10`
                  : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              {m.name}
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
            className={`flex-1 py-2 text-xs font-medium transition-colors relative ${activeTab === tab ? 'text-accent' : 'text-slate-500'}`}
          >
            {tab === 'transcript' ? '대화 기록' : `AI 중재${displayMessages.length > 1 ? ` (${displayMessages.length - 1})` : ''}`}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
          </button>
        ))}
      </div>

      {/* two-panel */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className={`flex-col overflow-hidden sm:flex sm:flex-1 sm:border-r sm:border-border ${activeTab === 'transcript' ? 'flex flex-1' : 'hidden'}`}>
          <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/40">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">대화 기록</p>
          </div>
          <LiveTranscript entries={displayTranscript} interimText={interimText} speakerColors={speakerColors} />
        </div>

        <div className={`flex-col overflow-hidden sm:flex sm:flex-1 ${activeTab === 'ai' ? 'flex flex-1' : 'hidden'}`}>
          <div className="shrink-0 px-4 pt-3 pb-2 border-b border-border/40">
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">AI 중재</p>
          </div>
          <ChatWindow messages={displayMessages} isLoading={isChatting} />
          <div className="shrink-0 border-t border-border/40 px-3 py-2.5 flex gap-2 items-center bg-surface">
            <input
              ref={chatInputRef}
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
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
      </div>

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
