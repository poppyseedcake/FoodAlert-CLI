const JITTER_MS = 30_000;
const MIN_DELAY_MS = 30_000;

export function calculateNextDelayMs(intervalMinutes: number, random = Math.random): number {
  const baseDelay = intervalMinutes * 60_000;
  const jitter = Math.floor((random() * 2 - 1) * JITTER_MS);
  return Math.max(MIN_DELAY_MS, baseDelay + jitter);
}
