import { NextRequest, NextResponse } from 'next/server';

export async function GET(_req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'no key' }, { status: 500 });

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1/models?key=${apiKey}`
  );
  const data = await res.json();
  return NextResponse.json(data);
}
