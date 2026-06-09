# MEDIATOR — Architecture Document

> 작성일: 2026-06-09  
> 기준: 현재 구현된 코드베이스

---

## 1. 기술 스택

| 레이어 | 기술 | 역할 |
|---|---|---|
| 프론트엔드 | Next.js 14 (App Router) | UI 프레임워크 |
| 언어 | TypeScript 5 | 타입 안전성 |
| 스타일 | Tailwind CSS 3 | 유틸리티 CSS |
| 상태 관리 | Zustand (persist) | 로컬 상태 + LocalStorage |
| 실시간 DB | Firebase Realtime Database | 멀티기기 동기화 |
| AI | Claude (Haiku) via Anthropic SDK | 중재 + 분석 |
| 음성 입력 | Web Speech API (SpeechRecognition) | STT |
| 배포 | Vercel | 호스팅 + Edge |

---

## 2. 디렉토리 구조

```
src/
├── app/
│   ├── layout.tsx              # Root layout (Nav + Toast)
│   ├── page.tsx                # 랜딩 페이지
│   ├── ai/
│   │   ├── page.tsx            # 메인 회의 페이지 (전체 흐름 관리)
│   │   └── error.tsx           # React 에러 바운더리
│   ├── history/
│   │   └── page.tsx            # 회의 기록 조회
│   └── api/
│       ├── chat/route.ts       # Claude API 프록시
│       └── models/route.ts     # Gemini 모델 목록 (미사용)
├── components/
│   ├── ai/
│   │   ├── MeetingSetup.tsx    # 회의 전 AI 역질문
│   │   ├── ChatWindow.tsx      # AI 메시지 표시
│   │   ├── ChatInput.tsx       # 음성 + 텍스트 입력
│   │   ├── LiveTranscript.tsx  # 실시간 발화 기록
│   │   ├── MeetingControls.tsx # 마이크/내보내기 컨트롤
│   │   └── ScenarioChips.tsx   # 빠른 시나리오 템플릿
│   ├── layout/
│   │   ├── Nav.tsx
│   │   ├── Toast.tsx
│   │   └── LoadingOverlay.tsx
│   ├── team/
│   │   └── MemberRow.tsx
│   └── home/
│       ├── HeroSection.tsx
│       └── FeaturesSection.tsx
├── hooks/
│   ├── useSession.ts           # Firebase 실시간 구독
│   ├── useVoiceRecognition.ts  # Web Speech API 래퍼
│   └── useToast.ts
├── lib/
│   ├── firebase.ts             # Firebase 초기화
│   ├── session.ts              # Firebase CRUD
│   └── deviceId.ts             # 기기 고유 ID
├── store/
│   └── useAppStore.ts          # Zustand 전역 상태
├── types/
│   └── index.ts                # TypeScript 인터페이스
└── data/
    └── conflictPatterns.ts     # 갈등 감지 키워드
```

---

## 3. 데이터 구조

### 3-1. Firebase Realtime Database

```
sessions/
└── {ROOM_CODE}           # 6자리 코드 (e.g. "A3BX7K")
    ├── status            # 'lobby' | 'meeting' | 'ended'
    ├── host              # deviceId (호스트 기기)
    ├── topic             # 회의 맥락 (pre-meeting 요약)
    ├── members/
    │   └── {deviceId}    # { name: string, ready: boolean }
    ├── setupChat/
    │   └── {autoId}      # { id, role: 'user'|'ai', text, createdAt }
    ├── transcript/
    │   └── {autoId}      # { id, text, time, speaker?, createdAt }
    └── aiMessages/
        └── {autoId}      # { id, content, isAlert, role, createdAt }
```

- 모든 autoId는 Firebase `push()`로 생성
- 읽기 시 `createdAt` 기준 정렬

### 3-2. LocalStorage (Zustand persist)

```
mediator-ai-store
├── teamMembers[]         # { id, name } — 자주 쓰는 팀원
└── meetingHistory[]      # MeetingRecord — 최근 20건
```

### 3-3. 핵심 TypeScript 타입

```typescript
// 기기 식별
deviceId: string  // localStorage 'mediator-device-id'

// 세션 멤버
SessionMember { name: string; ready: boolean }

// 발화 기록
SessionTranscriptEntry { id, text, time, speaker?, createdAt }

// AI 메시지
SessionAiMessage { id, content, isAlert, role, createdAt }

// 셋업 채팅
SetupChatEntry { id, role: 'user'|'ai', text, createdAt }

// 전체 세션 상태
SessionData {
  status: 'lobby' | 'meeting' | 'ended'
  host: string
  topic: string
  members: Record<string, SessionMember>
  transcript: SessionTranscriptEntry[]
  aiMessages: SessionAiMessage[]
  setupChat: SetupChatEntry[]
}
```

---

## 4. 시스템 흐름

### 4-1. 전체 Phase 흐름

```
createOrJoin
    ↓
  lobby  ←── Firebase 실시간 구독 시작
    ↓         (모든 기기 동기화)
 meeting
    ↓
 summary
```

### 4-2. createOrJoin

```
기기 접속
    ↓
deviceId 생성 or 조회 (localStorage)
    ↓
Firebase 설정 확인
    ↓
이름 입력
    ↓
[새 회의] → 6자리 코드 생성 → sessions/{code} 생성 → lobby
[참가]   → 코드 입력 → 세션 존재 + status=lobby 확인 → lobby
```

### 4-3. lobby

```
[호스트 기기]                    [참가자 기기]
     ↓                                ↓
MeetingSetup 컴포넌트             setupChat 실시간 구독
     ↓                                ↓
AI 역질문 (Claude)               호스트 AI 대화 실시간 표시
     ↓
4가지 맥락 파악 완료 (✅)
     ↓
buildFinalContext → topic 저장
     ↓
startMeeting() → status = 'meeting'
     ↓
모든 기기 자동 전환 (useSession 감지)
```

### 4-4. meeting

```
[모든 기기]                  [호스트만]
발화 → STT                      ↓
    ↓                    transcript 3개마다
addTranscript()          runAnalysis() 자동 실행
    ↓                           ↓
Firebase transcript         Claude API 호출
    ↓                           ↓
useSession 구독             addAiMessage()
    ↓                           ↓
모든 기기 표시          모든 기기 채팅 버블 표시

[모든 기기 - 긴급 감지]
새 발화마다 runUrgentCheck()
갈등/비속어 감지 시 즉시 alert
```

### 4-5. summary

```
endMeeting() → status = 'ended'
    ↓
모든 기기 summary 전환
    ↓
호스트: 분석 요청 (Claude)
    ↓
결과 표시 + 내보내기 (복사 / .txt 다운로드)
    ↓
meetingHistory 저장 (localStorage, 최대 20건)
```

---

## 5. 실시간 동기화 메커니즘

### useSession 훅

```typescript
// Firebase onValue로 세션 전체 실시간 구독
onValue(ref(db, `sessions/${code}`), (snap) => {
  // transcript, aiMessages, setupChat → createdAt 정렬
  setState(...)
})
```

- 컴포넌트 언마운트 시 `off()` 정리
- getDb() try/catch + onValue 에러 콜백으로 크래시 방지

### 멀티기기 패턴

| 역할 | 쓰기 권한 | 읽기 구독 |
|---|---|---|
| 호스트 | transcript, aiMessages, setupChat, status, topic | 전체 |
| 참가자 | transcript만 (자기 발화) | 전체 |
| 모든 기기 | members/{deviceId} (자기 것만) | 전체 |

---

## 6. AI 통합

### API 엔드포인트

```
POST /api/chat
Body: { system, messages, maxTokens }
→ Claude Haiku (claude-haiku-4-5-20251001)
→ max 3000 tokens
→ 30KB payload 제한
```

### AI 사용 시점

| 시점 | 트리거 | 시스템 프롬프트 |
|---|---|---|
| 회의 전 | 사용자 입력마다 | SETUP_SYSTEM (4가지 맥락 파악) |
| 회의 전 완료 | ✅ 감지 시 | buildFinalContext (구조화 요약) |
| 회의 중 자동 | transcript 3개마다 (호스트) | 중재 분석 |
| 회의 중 긴급 | 모든 새 발화 (호스트) | 긴급 체크 (갈등/비속어) |
| 회의 중 수동 | 사용자 질문 | 대화 응답 |
| 회의 후 | 요약 요청 | 결과 분석 / 다음 주제 추천 |

### 제한

- 자동 분석: 세션당 최대 30회
- 긴급 체크: 세션당 최대 50회
- 호스트 기기만 AI 분석 실행 → Firebase에 결과 저장 → 참가자 기기는 구독만

---

## 7. 음성 입력 (STT)

```typescript
// useVoiceRecognition.ts
SpeechRecognition / webkitSpeechRecognition
lang: 'ko-KR'
continuous: true
interimResults: true
minConfidence: 0.4

// 흐름
toggle() → 시작/종료
onresult → interim 텍스트 (미리보기)
onresult (final) → onResult 콜백 (확정 텍스트)
onerror → auto-restart (network), stop (not-allowed)
```

---

## 8. 환경 변수

```bash
# 서버 사이드 (비공개)
ANTHROPIC_API_KEY=sk-ant-...

# 클라이언트 사이드 (NEXT_PUBLIC_*)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_DATABASE_URL=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

---

## 9. 미구현 / 개선 필요 항목

### 핵심 (ideation에서 도출)

| 항목 | 설명 | 위치 |
|---|---|---|
| AI 신호 버튼 | 강제 표시 → 신호 버튼 opt-in으로 변경 | `ai/page.tsx`, `ChatWindow.tsx` |
| 카카오톡 공유 | 회의 요약 카카오톡 전송 | `summary` phase |
| 링크 공유 | 회의 결과 URL 생성 | `summary` phase |
| 노션 연동 | 회의 결과 노션 페이지 자동 생성 | `summary` phase |

### 기술적 개선

| 항목 | 현재 | 개선 방향 |
|---|---|---|
| AI 모델 | claude-haiku-4-5 | claude-haiku-4-5 유지 (속도 우선) |
| Firebase 보안 | Rules 미설정 | 세션별 읽기/쓰기 규칙 추가 |
| 세션 만료 | 없음 | 24시간 후 자동 삭제 |
| 에러 처리 | 기본 | 재연결 로직 강화 |

---

## 10. 배포 구조

```
Vercel (Edge Network)
├── Next.js App (SSR + CSR)
├── /api/chat → Anthropic API
└── /api/models → Google API

Firebase
└── Realtime Database (멀티기기 실시간 동기화)
```

- 클라이언트 ↔ Firebase: WebSocket (직접 연결)
- 클라이언트 ↔ Claude: `/api/chat` 프록시 경유 (API 키 보호)
