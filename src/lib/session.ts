import { getDb } from './firebase';
import { ref, set, push, update, get, remove } from 'firebase/database';


export interface SessionMember {
  name: string;
  ready: boolean;
}

export interface SessionTranscriptEntry {
  id: string;
  text: string;
  time: string;
  speaker?: string;
  createdAt: number;
}

export interface SessionAiMessage {
  id: string;
  content: string;
  isAlert: boolean;
  role: 'user' | 'ai';
  createdAt: number;
}

export interface SetupChatEntry {
  id: string;
  role: 'user' | 'ai';
  text: string;
  createdAt: number;
}

export interface SessionData {
  status: 'lobby' | 'meeting' | 'ended';
  host: string;
  topic: string;
  agenda: string[];
  members: Record<string, SessionMember>;
  transcript: SessionTranscriptEntry[];
  aiMessages: SessionAiMessage[];
  setupChat: SetupChatEntry[];
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export async function createSession(deviceId: string, name: string): Promise<string> {
  const db = getDb();
  let code = generateRoomCode();
  for (let i = 0; i < 5; i++) {
    const snap = await get(ref(db, `sessions/${code}/status`));
    if (!snap.exists()) break;
    code = generateRoomCode();
  }
  await set(ref(db, `sessions/${code}`), {
    status: 'lobby',
    host: deviceId,
    topic: '',
    members: { [deviceId]: { name, ready: false } },
  });
  return code;
}

export async function joinSession(code: string, deviceId: string, name: string): Promise<boolean> {
  const db = getDb();
  const snap = await get(ref(db, `sessions/${code}/status`));
  if (!snap.exists()) return false;
  const status = snap.val() as string;
  if (status !== 'lobby') return false;
  await update(ref(db, `sessions/${code}/members/${deviceId}`), { name, ready: false });
  return true;
}

export async function setMemberReady(code: string, deviceId: string, ready: boolean): Promise<void> {
  await update(ref(getDb(), `sessions/${code}/members/${deviceId}`), { ready });
}

export async function setTopic(code: string, topic: string): Promise<void> {
  await update(ref(getDb(), `sessions/${code}`), { topic });
}

export async function startMeeting(code: string): Promise<void> {
  await update(ref(getDb(), `sessions/${code}`), { status: 'meeting' });
}

export async function endMeeting(code: string): Promise<void> {
  await update(ref(getDb(), `sessions/${code}`), { status: 'ended' });
}

export async function deleteSession(code: string): Promise<void> {
  await remove(ref(getDb(), `sessions/${code}`));
}

export async function addTranscript(
  code: string,
  entry: Omit<SessionTranscriptEntry, 'id'>,
): Promise<string> {
  const db = getDb();
  const newRef = push(ref(db, `sessions/${code}/transcript`));
  const data = Object.fromEntries(
    Object.entries({ ...entry, id: newRef.key! }).filter(([, v]) => v !== undefined),
  );
  await set(newRef, data);
  return newRef.key!;
}

export async function updateTranscriptText(
  code: string,
  entryId: string,
  text: string,
): Promise<void> {
  await update(ref(getDb(), `sessions/${code}/transcript/${entryId}`), { text });
}

export async function addSetupEntry(code: string, role: 'user' | 'ai', text: string): Promise<void> {
  const db = getDb();
  const newRef = push(ref(db, `sessions/${code}/setupChat`));
  await set(newRef, { id: newRef.key!, role, text, createdAt: Date.now() });
}

export async function removeTranscript(code: string, entryId: string): Promise<void> {
  await remove(ref(getDb(), `sessions/${code}/transcript/${entryId}`));
}

export async function addAgendaItem(code: string, item: string): Promise<void> {
  const db = getDb();
  const snap = await get(ref(db, `sessions/${code}/agenda`));
  const current: string[] = snap.exists() ? (snap.val() as string[]) : [];
  await set(ref(db, `sessions/${code}/agenda`), [...current, item]);
}

export async function addAiMessage(
  code: string,
  msg: Omit<SessionAiMessage, 'id'>,
): Promise<void> {
  const db = getDb();
  const newRef = push(ref(db, `sessions/${code}/aiMessages`));
  await set(newRef, { ...msg, id: newRef.key! });
}

export async function saveSurvey(data: {
  type: 'entry' | 'exit';
  sessionCode: string | null;
  deviceId: string;
  answers: Record<string, string | string[]>;
}): Promise<void> {
  // Firebase 저장
  try {
    const db = getDb();
    const newRef = push(ref(db, 'surveys'));
    await set(newRef, { ...data, timestamp: Date.now() });
  } catch { /* ignore */ }

  // Supabase 저장
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (supabaseUrl && supabaseKey) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/surveys`, {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          type: data.type,
          session_code: data.sessionCode,
          answers: data.answers,
        }),
      });
    } catch { /* ignore */ }
  }
}
