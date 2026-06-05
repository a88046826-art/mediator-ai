import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
    }

    const { system, messages, maxTokens } = await req.json();
    const userMessage = messages.find((m: { role: string }) => m.role === 'user')?.content ?? '';
    const fullPrompt = system ? `${system}\n\n${userMessage}` : userMessage;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: fullPrompt }] }],
          generationConfig: { maxOutputTokens: maxTokens ?? 1024 },
        }),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      const errMsg = data?.error?.message ?? `Gemini error ${res.status}`;
      return NextResponse.json({ error: errMsg }, { status: 500 });
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
