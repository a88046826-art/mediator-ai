import { useEffect, useState } from 'react';
import { ref, onValue, off } from 'firebase/database';
import { getDb, isFirebaseConfigured } from '@/lib/firebase';
import type { SessionData, SessionTranscriptEntry, SessionAiMessage } from '@/lib/session';

export function useSession(sessionCode: string | null): SessionData | null {
  const [state, setState] = useState<SessionData | null>(null);

  useEffect(() => {
    if (!sessionCode || !isFirebaseConfigured) {
      setState(null);
      return;
    }

    const db = getDb();
    const sessionRef = ref(db, `sessions/${sessionCode}`);

    onValue(sessionRef, (snap) => {
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

      setState({
        status: data.status as SessionData['status'],
        host: data.host as string,
        topic: (data.topic as string) || '',
        members: (data.members as SessionData['members']) || {},
        transcript,
        aiMessages,
      });
    });

    return () => off(sessionRef);
  }, [sessionCode]);

  return state;
}
