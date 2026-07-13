import { composeRange, plusTwoHours, toTimeInput, todayLocal } from './booking-time';

describe('booking-time helpers', () => {
  it('plusTwoHours adds two hours', () => {
    expect(plusTwoHours('18:00')).toBe('20:00');
    expect(plusTwoHours('21:30')).toBe('23:30');
  });

  it('plusTwoHours wraps past midnight', () => {
    expect(plusTwoHours('23:00')).toBe('01:00');
  });

  it('todayLocal returns YYYY-MM-DD', () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('composeRange produces ISO timestamps with end after start', () => {
    const { start_time, end_time } = composeRange('2026-07-15', '18:00', '20:00');
    expect(new Date(end_time).getTime() - new Date(start_time).getTime()).toBe(2 * 3_600_000);
  });

  it('composeRange rolls end to the next day when it is not after start', () => {
    const { start_time, end_time } = composeRange('2026-07-15', '23:00', '01:00');
    expect(new Date(end_time).getTime()).toBeGreaterThan(new Date(start_time).getTime());
    expect(new Date(end_time).getTime() - new Date(start_time).getTime()).toBe(2 * 3_600_000);
  });

  it('toTimeInput extracts local HH:mm from an ISO string', () => {
    const { start_time } = composeRange('2026-07-15', '09:05', '11:00');
    expect(toTimeInput(start_time)).toBe('09:05');
  });
});
