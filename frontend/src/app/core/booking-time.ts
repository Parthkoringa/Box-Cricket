/** Browser-local date as YYYY-MM-DD ('en-CA' formats ISO-style). */
export function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}

export function daysAgoLocal(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toLocaleDateString('en-CA');
}

export function plusTwoHours(time: string): string {
  const [h, m] = time.split(':').map(Number);
  return `${String((h + 2) % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function toTimeInput(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Build ISO start/end from a local date + HH:mm inputs. If end ≤ start it is
 *  taken to be on the next day (late-night games crossing midnight). */
export function composeRange(date: string, start: string, end: string): { start_time: string; end_time: string } {
  const startDate = new Date(`${date}T${start}`);
  let endDate = new Date(`${date}T${end}`);
  if (endDate <= startDate) endDate = new Date(endDate.getTime() + 86_400_000);
  return { start_time: startDate.toISOString(), end_time: endDate.toISOString() };
}

/** 'Today' / 'Tomorrow' / 'Sat 18 Jul' — labels for day-group headers. */
export function dayLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  const next = new Date(`${today}T12:00:00`);
  next.setDate(next.getDate() + 1);
  if (date === next.toLocaleDateString('en-CA')) return 'Tomorrow';
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}
