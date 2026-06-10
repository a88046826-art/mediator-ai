import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { getDb, isFirebaseConfigured } from '@/lib/firebase';
import type { SessionData, SessionTranscriptEntry, SessionAiMessage, SetupChatEntry } from '@/lib/session';

// undefined = 아직 Firebase 응답 대기 중, null = 세션 없음, SessionData = 세션 있음
export function useSession(sessionCode: string | null): SessionData | null | undefined {
  const [state, setState] = useState<SessionData | null | undefined>(undefined);

  useEffect(() => {
    if (!sessionCode || !isFirebaseConfigured) {
      setState(null);
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

        setState({
          status: data.status as SessionData['status'],
          host: data.host as string,
          topic: (data.topic as string) || '',
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
