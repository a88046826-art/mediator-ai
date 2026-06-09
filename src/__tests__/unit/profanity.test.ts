const PROFANITY = [
  '씨발', '씨바', '시발', '시바', 'ㅅㅂ', '씨팔',
  '개새끼', 'ㄱㅅㄲ',
  '병신', 'ㅂㅅ',
  '지랄',
  '좆', '존나', 'ㅈㄴ',
  '창녀', '보지', '자지',
  'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt',
];

function containsProfanity(text: string): boolean {
  const normalized = text.toLowerCase();
  return PROFANITY.some((w) => normalized.includes(w.toLowerCase()));
}

describe('containsProfanity', () => {
  it('정상 문장은 false 반환', () => {
    expect(containsProfanity('오늘 회의 잘 됐어요')).toBe(false);
    expect(containsProfanity('다음 주까지 완료할게요')).toBe(false);
    expect(containsProfanity('')).toBe(false);
  });

  it('한국어 비속어 감지', () => {
    expect(containsProfanity('씨발 뭐야')).toBe(true);
    expect(containsProfanity('병신같은 소리하지마')).toBe(true);
    expect(containsProfanity('ㅈㄴ 이상하다')).toBe(true);
  });

  it('영어 비속어 감지', () => {
    expect(containsProfanity('what the fuck')).toBe(true);
    expect(containsProfanity('SHIT happens')).toBe(true);
  });

  it('대소문자 무시하고 감지', () => {
    expect(containsProfanity('FUCK this')).toBe(true);
    expect(containsProfanity('Shit')).toBe(true);
  });

  it('비속어가 단어 중간에 포함돼도 감지', () => {
    expect(containsProfanity('개씨발놈')).toBe(true);
  });
});
