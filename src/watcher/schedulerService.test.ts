import { describe, expect, it } from 'vitest';
import { calculateNextDelayMs } from './schedulerTiming.js';

describe('calculateNextDelayMs', () => {
  it('returns base interval in ms when random returns 0.5 (zero jitter)', () => {
    expect(calculateNextDelayMs(5, () => 0.5)).toBe(5 * 60_000);
  });

  it('subtracts full jitter when random returns 0', () => {
    expect(calculateNextDelayMs(5, () => 0)).toBe(5 * 60_000 - 30_000);
  });

  it('adds full jitter when random returns 1', () => {
    expect(calculateNextDelayMs(5, () => 1)).toBe(5 * 60_000 + 30_000);
  });

  it('clamps to MIN_DELAY_MS (30s) when interval is very small', () => {
    expect(calculateNextDelayMs(0, () => 0)).toBe(30_000);
  });

  it('rounds jitter to whole ms (uses floor)', () => {
    const delay = calculateNextDelayMs(1, () => 0.3);
    expect(Number.isInteger(delay)).toBe(true);
  });
});
