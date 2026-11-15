/**
 * Pembatas percobaan login (in-memory, per proses).
 * Catatan: untuk deployment multi-instance gunakan penyimpanan bersama (mis. Redis/DB).
 */
interface Bucket { count: number; resetAt: number }
const buckets = new Map<string, Bucket>();

export function rateLimitCheck(key: string, max: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) return { allowed: true, retryAfterSec: 0 };
  if (b.count >= max) return { allowed: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  return { allowed: true, retryAfterSec: 0 };
}

export function rateLimitHit(key: string, windowMs: number) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) buckets.set(key, { count: 1, resetAt: now + windowMs });
  else b.count += 1;
  if (buckets.size > 5000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
}

export function rateLimitReset(key: string) {
  buckets.delete(key);
}
