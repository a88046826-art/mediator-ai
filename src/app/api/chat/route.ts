import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
    }

    const { system, messages, maxTokens } = await req.json();
    const userMessage = messages.find((m: { role: string }) => m.role === 'user')?.content ?? '';
    const fullPrompt = system ? `${system}\n\n${userMessage}` : userMessage;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: fullPrompt,
      config: { maxOutputTokens: maxTokens ?? 1024 },
    });

    const content = response.text ?? '';
    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[chat/route] Gemini API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
