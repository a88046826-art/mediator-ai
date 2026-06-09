import { NextRequest, NextResponse } from 'next/server';

const CLOVA_URL = 'https://naveropenapi.apigw.ntruss.com/recog/v1/stt?lang=Kor';
const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest) {
  const clientId = process.env.CLOVA_CLIENT_ID;
  const clientSecret = process.env.CLOVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
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

    const res = await fetch(CLOVA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'X-NCP-APIGW-API-KEY-ID': clientId,
        'X-NCP-APIGW-API-KEY': clientSecret,
      },
      body: audio,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Clova ${res.status}: ${body}`);
    }

    const data = await res.json() as { text?: string };
    return NextResponse.json({ text: data.text ?? '' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'STT error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
