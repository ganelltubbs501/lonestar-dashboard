import { describe, it, expect } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatRelativeTime,
  isOverdue,
  parseTags,
  cn,
} from '../src/lib/utils';

describe('formatDate', () => {
  it('returns dash for null input', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('formats date correctly', () => {
    const date = new Date('2024-06-15');
    const result = formatDate(date);
    expect(result).toContain('Jun');
    expect(result).toContain('15');
  });

  it('handles string dates', () => {
    const result = formatDate('2024-06-15T00:00:00.000Z');
    expect(result).toContain('Jun');
  });
});

describe('formatDateTime', () => {
  it('returns dash for null input', () => {
    expect(formatDateTime(null)).toBe('-');
  });

  it('includes time in output', () => {
    const date = new Date('2024-06-15T14:30:00');
    const result = formatDateTime(date);
    expect(result).toContain('Jun');
  });
});

describe('formatRelativeTime', () => {
  it('returns "just now" for very recent dates', () => {
    const now = new Date();
    expect(formatRelativeTime(now)).toBe('just now');
  });

  it('returns minutes ago for recent dates', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    expect(formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
  });

  it('returns hours ago for dates within 24 hours', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    expect(formatRelativeTime(twoHoursAgo)).toBe('2h ago');
  });

  it('returns days ago for older dates', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    expect(formatRelativeTime(threeDaysAgo)).toBe('3d ago');
  });
});

describe('isOverdue', () => {
  it('returns false for null date', () => {
    expect(isOverdue(null)).toBe(false);
  });

  it('returns true for past dates', () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
    expect(isOverdue(yesterday)).toBe(true);
  });

  it('returns false for future dates', () => {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    expect(isOverdue(tomorrow)).toBe(false);
  });
});

describe('parseTags', () => {
  it('returns array as-is', () => {
    const tags = ['tag1', 'tag2'];
    expect(parseTags(tags)).toEqual(tags);
  });

  it('returns empty array for undefined/null', () => {
    expect(parseTags(undefined as unknown as string[])).toEqual([]);
    expect(parseTags(null as unknown as string[])).toEqual([]);
  });

  it('handles empty array', () => {
    expect(parseTags([])).toEqual([]);
  });
});

describe('cn', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
  });

  it('merges tailwind classes correctly', () => {
    expect(cn('p-4', 'p-2')).toBe('p-2');
  });
});
