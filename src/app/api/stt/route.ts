import { NextRequest, NextResponse } from 'next/server';

const MAX_BYTES = 10 * 1024 * 1024;

// Whisper/Groq 할루시네이션 감지: 완전히 동일한 단어가 반복되는 경우만 필터
// (프롬프트 키워드 제거 후 실제 발화가 걸리는 오탐 방지)
function isHallucination(text: string): boolean {
  if (!text) return false;
  // "기획, 개발, 디자인" 처럼 동일 패턴이 2회 이상 반복될 때만 필터
  const half = text.slice(0, Math.floor(text.length / 2));
  return half.length > 10 && text.startsWith(half) && text.slice(half.length).trim().startsWith(half.trim()[0]);
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
      const context  = req.nextUrl.searchParams.get('context') ?? ''; // 직전 인식 문장
      const promptParts: string[] = [];
      if (topic)    promptParts.push(`회의 주제: ${topic}.`);
      if (speakers) promptParts.push(`참가자: ${speakers}.`);
      if (context)  promptParts.push(context); // 이전 문장을 프롬프트 끝에 → 연속 문맥 인식
      const prompt = promptParts.join(' ') || '한국어로 진행되는 회의입니다.';

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
      const context  = req.nextUrl.searchParams.get('context') ?? '';
      const promptParts: string[] = [];
      if (topic)    promptParts.push(`회의 주제: ${topic}.`);
      if (speakers) promptParts.push(`참가자: ${speakers}.`);
      if (context)  promptParts.push(context);
      const prompt = promptParts.join(' ') || '한국어로 진행되는 회의입니다.';

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
