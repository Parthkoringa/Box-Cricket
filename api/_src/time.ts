const IST = 'Asia/Kolkata';

/** Today's date in Asia/Kolkata as YYYY-MM-DD ('en-CA' locale formats ISO-style). */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST });
}

/** The date `days` days before now, in Asia/Kolkata, as YYYY-MM-DD. */
export function istDateDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toLocaleDateString('en-CA', { timeZone: IST });
}
