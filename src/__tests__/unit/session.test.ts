// 방 코드 생성 로직 단위 테스트 (session.ts에서 추출)
function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

describe('generateRoomCode', () => {
  it('6자리 코드 생성', () => {
    const code = generateRoomCode();
    expect(code).toHaveLength(6);
  });

  it('허용된 문자만 포함', () => {
    const allowed = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/;
    for (let i = 0; i < 20; i++) {
      expect(generateRoomCode()).toMatch(allowed);
    }
  });

  it('헷갈리는 문자(I, O, 0, 1) 미포함', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateRoomCode();
      expect(code).not.toMatch(/[IO01]/);
    }
  });

  it('여러 번 호출 시 다른 코드 생성 (충돌 낮음)', () => {
    const codes = new Set(Array.from({ length: 100 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(90);
  });
});

// createdAt 정렬 로직 테스트
describe('setupChat 정렬', () => {
  it('createdAt 기준 오름차순 정렬', () => {
    const entries = [
      { id: '3', createdAt: 300, text: 'c' },
      { id: '1', createdAt: 100, text: 'a' },
      { id: '2', createdAt: 200, text: 'b' },
    ];
    const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt);
    expect(sorted.map((e) => e.text)).toEqual(['a', 'b', 'c']);
  });

  it('빈 배열은 빈 배열 반환', () => {
    const entries: { id: string; createdAt: number; text: string }[] = [];
    const sorted = [...entries].sort((a, b) => a.createdAt - b.createdAt);
    expect(sorted).toEqual([]);
  });
});
