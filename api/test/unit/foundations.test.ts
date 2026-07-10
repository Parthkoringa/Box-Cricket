import { describe, expect, it } from 'vitest';
import { config } from '../../src/config';
import { AppError, forbidden, invalidTransition, notFound, unauthorized } from '../../src/errors';
import { istDateDaysAgo, todayIST } from '../../src/time';

describe('config', () => {
  it('exposes env-backed values', () => {
    expect(config.databaseUrl).toContain('postgres');
    expect(config.jwtSecret.length).toBeGreaterThan(0);
  });
});

describe('errors', () => {
  it('AppError carries status, code, message', () => {
    const e = new AppError(404, 'NOT_FOUND', 'nope');
    expect(e.status).toBe(404);
    expect(e.code).toBe('NOT_FOUND');
    expect(e.message).toBe('nope');
    expect(e).toBeInstanceOf(Error);
  });

  it('factories produce the right statuses', () => {
    expect(unauthorized().status).toBe(401);
    expect(forbidden().status).toBe(403);
    expect(notFound().status).toBe(404);
    const t = invalidTransition('completed', 'arrived');
    expect(t.status).toBe(422);
    expect(t.message).toContain('completed');
    expect(t.message).toContain('arrived');
  });
});

describe('IST time helpers', () => {
  it('todayIST returns YYYY-MM-DD', () => {
    expect(todayIST()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('istDateDaysAgo(0) equals todayIST', () => {
    expect(istDateDaysAgo(0)).toBe(todayIST());
  });

  it('istDateDaysAgo(7) is strictly before today', () => {
    expect(istDateDaysAgo(7) < todayIST()).toBe(true);
  });
});
