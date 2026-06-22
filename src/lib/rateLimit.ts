// Fixed-window rate limiter (in-memory, per serverless instance)
// Resets on cold start — sufficient for basic abuse prevention on beta scale

interface Window {
  count: number;
  resetAt: number;
}

const store = new Map<string, Window>();

export function checkRateLimit(
  ip: string,
  key: string,
  maxPerMinute: number,
): { allowed: boolean; retryAfter: number } {
  const now = Date.now();
  const storeKey = `${key}:${ip}`;
  const win = store.get(storeKey);

  if (!win || now >= win.resetAt) {
    store.set(storeKey, { count: 1, resetAt: now + 60_000 });
    return { allowed: true, retryAfter: 0 };
  }

  if (win.count >= maxPerMinute) {
    const retryAfter = Math.ceil((win.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  win.count += 1;
  return { allowed: true, retryAfter: 0 };
}
