// typeKey → 알파벳 1자 매핑 (16가지 CODE 타입)
const TYPE_TO_LETTER: Record<string, string> = {
  D: 'A', O: 'B', C: 'C', E: 'D',
  DO: 'E', DC: 'F', DE: 'G',
  OD: 'H', OC: 'I', OE: 'J',
  CD: 'K', CO: 'L', CE: 'M',
  ED: 'N', EO: 'O', EC: 'P',
};

const LETTER_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(TYPE_TO_LETTER).map(([t, l]) => [l, t])
);

/** 표시용 짧은 코드: "483921F" 형태. typeKey만 인코딩 (이름 없음) */
export function generateShareCode(typeKey: string): string {
  const letter = TYPE_TO_LETTER[typeKey] ?? TYPE_TO_LETTER[typeKey[0]] ?? 'A';
  const digits = String(Math.floor(100000 + Math.random() * 900000));
  return `${digits}${letter}`;
}

/** URL 초대용 코드: base64. name + typeKey 모두 인코딩 */
export function generateInviteCode(name: string, typeKey: string): string {
  const data = JSON.stringify({ n: name, c: typeKey });
  return btoa(encodeURIComponent(data));
}

/**
 * 코드 디코딩.
 * - 짧은 코드 (6숫자+알파벳): { name: '', typeKey } → 팀 페이지에서 이름 따로 입력
 * - base64 (URL 초대용): { name, typeKey }
 */
export function decodeShareCode(code: string): { name: string; typeKey: string } | null {
  const trimmed = code.trim().toUpperCase();

  if (/^\d{6}[A-P]$/.test(trimmed)) {
    const typeKey = LETTER_TO_TYPE[trimmed[6]];
    if (!typeKey) return null;
    return { name: '', typeKey };
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(atob(code.trim())));
    if (typeof parsed.n !== 'string' || typeof parsed.c !== 'string') return null;
    return { name: parsed.n, typeKey: parsed.c };
  } catch {
    return null;
  }
}
