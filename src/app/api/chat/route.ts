import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { checkRateLimit } from '@/lib/rateLimit';

const ALLOWED_ORIGINS = [
  'https://mediator-ai-eight.vercel.app',
  'https://www.meditor.cc',
  'https://meditor.cc',
  'http://localhost:3000',
  'http://localhost:3001',
];

const MAX_TOKENS_CAP = 3000;
const MAX_PAYLOAD_BYTES = 100_000;

export async function POST(req: NextRequest) {
  // Origin 검사 — 외부 호출 차단
  const origin = req.headers.get('origin') ?? '';
  const isAllowed =
    ALLOWED_ORIGINS.some((o) => origin === o) ||
    origin.endsWith('.vercel.app');
  if (!isAllowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Rate limit: 20 AI requests/min per IP (frontend triggers ~5–10/min max in normal use)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  const rl = checkRateLimit(ip, 'chat', 20);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } },
    );
  }

  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'ANTHROPIC_API_KEY가 설정되지 않았습니다.' }, { status: 500 });
    }

    const raw = await req.text();
    if (raw.length > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: '요청이 너무 큽니다.' }, { status: 413 });
    }

    const { system, messages, maxTokens } = JSON.parse(raw);

    // Support multi-turn: convert internal 'ai' role → Anthropic 'assistant'
    const anthropicMessages = (messages as { role: string; content: string }[]).map((m) => ({
      role: (m.role === 'ai' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: m.content,
    }));

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: Math.min(maxTokens ?? 1024, MAX_TOKENS_CAP),
      system,
      messages: anthropicMessages,
    });

    const content = response.content[0].type === 'text' ? response.content[0].text : '';
    return NextResponse.json({ content });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
