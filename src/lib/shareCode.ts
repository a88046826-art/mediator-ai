export function generateShareCode(name: string, typeKey: string): string {
  const data = JSON.stringify({ n: name, c: typeKey });
  return btoa(encodeURIComponent(data));
}

export function decodeShareCode(code: string): { name: string; typeKey: string } | null {
  try {
    const parsed = JSON.parse(decodeURIComponent(atob(code.trim())));
    if (typeof parsed.n !== 'string' || typeof parsed.c !== 'string') return null;
    return { name: parsed.n, typeKey: parsed.c };
  } catch {
    return null;
  }
}
