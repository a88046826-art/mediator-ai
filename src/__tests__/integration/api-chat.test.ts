/**
 * 통합 테스트: /api/chat 라우트
 * Anthropic SDK는 mock 처리, HTTP 요청/응답 로직만 검증
 * @jest-environment node
 */

// Anthropic SDK mock
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'AI 응답 테스트' }],
        }),
      },
    })),
  };
});

import { POST } from '@/app/api/chat/route';
import { NextRequest } from 'next/server';

function makeRequest(body: object, origin = 'http://localhost:3000'): NextRequest {
  return new NextRequest('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', origin },
    body: JSON.stringify(body),
  });
}

describe('POST /api/chat', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, ANTHROPIC_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.clearAllMocks();
  });

  it('정상 요청에 200 + content 반환', async () => {
    const req = makeRequest({
      system: '테스트 시스템',
      messages: [{ role: 'user', content: '안녕하세요' }],
      maxTokens: 100,
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.content).toBe('AI 응답 테스트');
  });

  it('허용되지 않은 origin → 403', async () => {
    const req = makeRequest(
      { system: '', messages: [], maxTokens: 100 },
      'http://evil.com',
    );
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('ANTHROPIC_API_KEY 없으면 500', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const req = makeRequest({
      system: '',
      messages: [{ role: 'user', content: '테스트' }],
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toContain('ANTHROPIC_API_KEY');
  });

  it('30KB 초과 페이로드 → 413', async () => {
    const bigContent = 'a'.repeat(31000);
    const req = makeRequest({
      system: '',
      messages: [{ role: 'user', content: bigContent }],
    });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it('role ai → assistant 변환 후 API 호출', async () => {
    const Anthropic = (await import('@anthropic-ai/sdk')).default as jest.Mock;
    const mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: '응답' }],
    });
    Anthropic.mockImplementation(() => ({ messages: { create: mockCreate } }));

    const req = makeRequest({
      system: '',
      messages: [
        { role: 'user', content: '질문' },
        { role: 'ai', content: '답변' },
        { role: 'user', content: '추가 질문' },
      ],
    });
    await POST(req);

    const callArgs = mockCreate.mock.calls[0][0];
    const roles = callArgs.messages.map((m: { role: string }) => m.role);
    expect(roles).toEqual(['user', 'assistant', 'user']);
  });
});
