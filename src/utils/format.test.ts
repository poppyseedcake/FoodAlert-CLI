import { describe, expect, it } from 'vitest';
import { formatPickup, formatPrice } from './format.js';

describe('formatPickup', () => {
  it('returns "?" for null', () => {
    expect(formatPickup(null)).toBe('?');
  });

  it('formats a Date in PL locale (dd.MM, HH:mm)', () => {
    const date = new Date('2025-03-15T14:30:00Z');
    const formatted = formatPickup(date);
    expect(formatted).toMatch(/^\d{2}\.\d{2}, \d{2}:\d{2}$/);
  });
});

describe('formatPrice', () => {
  it('returns "?" for null', () => {
    expect(formatPrice(null)).toBe('?');
  });

  it('appends " PLN" to a finite number', () => {
    expect(formatPrice(9.99)).toBe('9.99 PLN');
  });

  it('handles integer prices', () => {
    expect(formatPrice(20)).toBe('20 PLN');
  });
});
