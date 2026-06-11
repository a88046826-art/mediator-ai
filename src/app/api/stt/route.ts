import { NextRequest, NextResponse } from 'next/server';

const CLOVA_SPEECH_URL = 'https://clovaspeech-gw.ncloud.com/recog/v1/stt?lang=Kor&format=wav';
const CLOVA_CSR_URL    = 'https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=Kor';
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const speechSecret = process.env.CLOVA_SPEECH_SECRET;
  const csrId        = process.env.CLOVA_CLIENT_ID;
  const csrSecret    = process.env.CLOVA_CLIENT_SECRET;

  if (!speechSecret && (!csrId || !csrSecret)) {
    return NextResponse.json({ error: 'STT not configured' }, { status: 500 });
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_BYTES) {
    return NextResponse.json({ error: 'Audio too large' }, { status: 413 });
  }

  try {
    const audio = await req.arrayBuffer();
    if (audio.byteLength < 44) {
      return NextResponse.json({ text: '' });
    }

    // CLOVA Speech (장문/스트리밍 도메인) 우선, 없으면 CSR 폴백
    let res: Response;
    if (speechSecret) {
      res = await fetch(CLOVA_SPEECH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-CLOVASPEECH-API-KEY': speechSecret,
        },
        body: audio,
      });
    } else {
      res = await fetch(CLOVA_CSR_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/octet-stream',
          'X-NCP-APIGW-API-KEY-ID': csrId!,
          'X-NCP-APIGW-API-KEY': csrSecret!,
        },
        body: audio,
      });
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`STT ${res.status}: ${body}`);
    }

    const data = await res.json() as { text?: string };
    return NextResponse.json({ text: data.text ?? '' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'STT error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
