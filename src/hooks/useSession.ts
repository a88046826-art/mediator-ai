import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { getDb, isFirebaseConfigured } from '@/lib/firebase';
import type { SessionData, SessionTranscriptEntry, SessionAiMessage, SetupChatEntry, SessionMaterial } from '@/lib/session';

// undefined = 코드 없음 또는 Firebase 응답 대기 중, null = Firebase가 "없음" 응답, SessionData = 세션 있음
export function useSession(sessionCode: string | null): SessionData | null | undefined {
  const [state, setState] = useState<SessionData | null | undefined>(undefined);

  useEffect(() => {
    if (!sessionCode || !isFirebaseConfigured) {
      setState(undefined); // null이 아닌 undefined — "아직 쿼리 안 함"과 구분
      return;
    }

    setState(undefined); // 코드 바뀌면 로딩 상태로 리셋

    let sessionRef: ReturnType<typeof ref>;
    try {
      const db = getDb();
      sessionRef = ref(db, `sessions/${sessionCode}`);
    } catch {
      setState(null);
      return;
    }

    onValue(
      sessionRef,
      (snap) => {
        if (!snap.exists()) {
          setState(null);
          return;
        }
        const data = snap.val() as Record<string, unknown>;

        const transcript: SessionTranscriptEntry[] = data.transcript
          ? (Object.values(data.transcript as Record<string, SessionTranscriptEntry>))
              .sort((a, b) => a.createdAt - b.createdAt)
          : [];

        const aiMessages: SessionAiMessage[] = data.aiMessages
          ? (Object.values(data.aiMessages as Record<string, SessionAiMessage>))
              .sort((a, b) => a.createdAt - b.createdAt)
          : [];

        const setupChat: SetupChatEntry[] = data.setupChat
          ? (Object.values(data.setupChat as Record<string, SetupChatEntry>))
              .sort((a, b) => a.createdAt - b.createdAt)
          : [];

        const materials: SessionMaterial[] = data.materials
          ? (Object.values(data.materials as Record<string, SessionMaterial>))
              .sort((a, b) => a.createdAt - b.createdAt)
          : [];

        setState({
          status: data.status as SessionData['status'],
          host: data.host as string,
          topic: (data.topic as string) || '',
          agenda: Array.isArray(data.agenda) ? (data.agenda as string[]) : [],
          materials,
          members: (data.members as SessionData['members']) || {},
          transcript,
          aiMessages,
          setupChat,
        });
      },
      () => { setState(null); },
    );

    return () => off(sessionRef);
  }, [sessionCode]);

  return state;
}
