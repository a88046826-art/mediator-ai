import { NextRequest, NextResponse } from 'next/server';

const MAX_BYTES = 10 * 1024 * 1024;

// Whisper 할루시네이션 감지: 불명확한 오디오에서 같은 문장을 반복 출력하는 현상 필터
function isHallucination(text: string): boolean {
  if (!text || text.length < 10) return false;
  // 패턴1: 텍스트 전반부가 후반부에 그대로 반복 (단순 loop)
  const half = text.slice(0, Math.floor(text.length / 2));
  if (half.length > 10 && text.slice(half.length).trimStart().startsWith(half.trimStart().slice(0, 8))) return true;
  // 패턴2: 문장 단위 중복 — 같은 문장이 2번 이상 등장
  const sentences = text.split(/(?<=[.。!?])\s+|,\s*/).map((s) => s.trim()).filter((s) => s.length > 8);
  const seen = new Set<string>();
  for (const s of sentences) {
    if (seen.has(s)) return true;
    seen.add(s);
  }
  return false;
}

async function transcribeWithRetry(
  url: string,
  authHeader: string,
  form: FormData,
  maxRetries = 2,
): Promise<Response> {
  let last: Response | null = null;
  for (let i = 0; i <= maxRetries; i++) {
    const res = await fetch(url, { method: 'POST', headers: { Authorization: authHeader }, body: form });
    if (res.status !== 429) return res;
    last = res;
    // Retry-After 헤더 있으면 그만큼, 없으면 지수 백오프
    const retryAfter = Number(res.headers.get('retry-after') ?? 0);
    await new Promise((r) => setTimeout(r, (retryAfter || (i + 1) * 2) * 1000));
  }
  return last!;
}

export async function GET() {
  return NextResponse.json({
    groq:  !!process.env.GROQ_API_KEY,
    openai: !!process.env.OPENAI_API_KEY,
    clova: !!process.env.CLOVA_SPEECH_SECRET,
    csr:   !!(process.env.CLOVA_CLIENT_ID && process.env.CLOVA_CLIENT_SECRET),
  });
}

export async function POST(req: NextRequest) {
  const groqKey      = process.env.GROQ_API_KEY;
  const openaiKey    = process.env.OPENAI_API_KEY;
  const speechSecret = process.env.CLOVA_SPEECH_SECRET;
  const csrId        = process.env.CLOVA_CLIENT_ID;
  const csrSecret    = process.env.CLOVA_CLIENT_SECRET;

  if (!groqKey && !openaiKey && !speechSecret && (!csrId || !csrSecret)) {
    return NextResponse.json({ error: 'STT not configured' }, { status: 500 });
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BYTES) {
    return NextResponse.json({ error: 'Audio too large' }, { status: 413 });
  }

  try {
    const audio = await req.arrayBuffer();
    if (audio.byteLength < 44) return NextResponse.json({ text: '' });

    // 1순위: Groq Whisper (whisper-large-v3-turbo — 더 정확, 10배 빠름)
    if (groqKey) {
      const topic    = req.nextUrl.searchParams.get('topic') ?? '';
      const speakers = req.nextUrl.searchParams.get('speakers') ?? '';
      const promptParts: string[] = ['한국어 팀 회의입니다.'];
      if (topic)    promptParts.push(`주제: ${topic}.`);
      if (speakers) promptParts.push(`참가자: ${speakers}.`);
      const prompt = promptParts.join(' ');

      const form = new FormData();
      form.append('file', new Blob([audio], { type: 'audio/wav' }), 'audio.wav');
      form.append('model', 'whisper-large-v3-turbo');
      form.append('language', 'ko');
      form.append('prompt', prompt);

      const res = await transcribeWithRetry(
        'https://api.groq.com/openai/v1/audio/transcriptions',
        `Bearer ${groqKey}`,
        form,
      );
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Groq ${res.status}: ${body}`);
      }
      const data = await res.json() as { text?: string };
      const text = (data.text ?? '').trim();
      if (isHallucination(text)) return NextResponse.json({ text: '' });
      return NextResponse.json({ text });
    }

    // 2순위: OpenAI Whisper
    if (openaiKey) {
      const topic    = req.nextUrl.searchParams.get('topic') ?? '';
      const speakers = req.nextUrl.searchParams.get('speakers') ?? '';
      const promptParts: string[] = ['한국어 팀 회의입니다.'];
      if (topic)    promptParts.push(`주제: ${topic}.`);
      if (speakers) promptParts.push(`참가자: ${speakers}.`);
      const prompt = promptParts.join(' ');

      const form = new FormData();
      form.append('file', new Blob([audio], { type: 'audio/wav' }), 'audio.wav');
      form.append('model', 'whisper-1');
      form.append('language', 'ko');
      form.append('prompt', prompt);

      const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Whisper ${res.status}: ${body}`);
      }
      const data = await res.json() as { text?: string };
      const text = (data.text ?? '').trim();
      // Whisper 할루시네이션 필터: 콤마 구분 단어 나열만 있으면 빈 결과 반환
      if (isHallucination(text)) return NextResponse.json({ text: '' });
      return NextResponse.json({ text });
    }

    // 2순위: CLOVA Speech
    if (speechSecret) {
      const res = await fetch('https://clovaspeech-gw.ncloud.com/recog/v1/stt?lang=Kor&format=wav', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-CLOVASPEECH-API-KEY': speechSecret,
        },
        body: audio,
      });
      if (!res.ok) throw new Error(`CLOVA ${res.status}`);
      const data = await res.json() as { text?: string };
      return NextResponse.json({ text: data.text ?? '' });
    }

    // 3순위: CSR
    const res = await fetch('https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=Kor', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-NCP-APIGW-API-KEY-ID': csrId!,
        'X-NCP-APIGW-API-KEY': csrSecret!,
      },
      body: audio,
    });
    if (!res.ok) throw new Error(`CSR ${res.status}`);
    const data = await res.json() as { text?: string };
    return NextResponse.json({ text: data.text ?? '' });

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'STT error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
