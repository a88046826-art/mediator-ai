import { NextRequest, NextResponse } from 'next/server';

const MAX_BYTES = 10 * 1024 * 1024;

// Whisper가 오디오 없이 프롬프트 내용을 그대로 출력하는 할루시네이션 감지
// 패턴: 2글자 이하 단어가 콤마로 연속되거나, 전체 텍스트가 콤마+공백 구분 단어 나열
function isHallucination(text: string): boolean {
  if (!text) return false;
  const tokens = text.split(/[,，、]\s*/);
  if (tokens.length < 4) return false;
  const shortWords = tokens.filter((t) => t.trim().length <= 4);
  return shortWords.length / tokens.length >= 0.8;
}

export async function POST(req: NextRequest) {
  const openaiKey    = process.env.OPENAI_API_KEY;
  const speechSecret = process.env.CLOVA_SPEECH_SECRET;
  const csrId        = process.env.CLOVA_CLIENT_ID;
  const csrSecret    = process.env.CLOVA_CLIENT_SECRET;

  if (!openaiKey && !speechSecret && (!csrId || !csrSecret)) {
    return NextResponse.json({ error: 'STT not configured' }, { status: 500 });
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BYTES) {
    return NextResponse.json({ error: 'Audio too large' }, { status: 413 });
  }

  try {
    const audio = await req.arrayBuffer();
    if (audio.byteLength < 44) return NextResponse.json({ text: '' });

    // 1순위: OpenAI Whisper
    if (openaiKey) {
      const topic    = req.nextUrl.searchParams.get('topic') ?? '';
      const speakers = req.nextUrl.searchParams.get('speakers') ?? '';
      // 키워드 목록을 프롬프트에 넣으면 오디오 품질이 낮을 때 Whisper가 해당 단어를
      // 그대로 출력하는 할루시네이션이 발생하므로 주제/참가자만 전달한다.
      const promptParts: string[] = [];
      if (topic)    promptParts.push(`회의 주제: ${topic}.`);
      if (speakers) promptParts.push(`참가자: ${speakers}.`);
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
