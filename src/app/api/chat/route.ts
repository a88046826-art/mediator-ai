import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
    }

    const { system, messages, maxTokens } = await req.json();
    const userMessage = messages.find((m: { role: string }) => m.role === 'user')?.content ?? '';
    const fullPrompt = system ? `${system}\n\n${userMessage}` : userMessage;

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash-8b' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: { maxOutputTokens: maxTokens ?? 1024 },
    });

    const content = result.response.text();
    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[chat/route] Gemini API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
