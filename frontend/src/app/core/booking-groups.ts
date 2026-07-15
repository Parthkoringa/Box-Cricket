import { dayLabel } from './booking-time';
import { Booking } from './models';

export interface DayGroup {
  date: string;
  label: string;
  bookings: Booking[];
  count: number;
  totalDue: number;
}

const NO_DUE: Booking['status'][] = ['cancelled', 'no_show'];

/** Groups bookings (already sorted by start_time) into per-day sections. */
export function groupByDay(bookings: Booking[], today: string): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const booking of bookings) {
    let group = groups[groups.length - 1];
    if (!group || group.date !== booking.booking_date) {
      group = { date: booking.booking_date, label: dayLabel(booking.booking_date, today), bookings: [], count: 0, totalDue: 0 };
      groups.push(group);
    }
    group.bookings.push(booking);
    group.count++;
    if (!NO_DUE.includes(booking.status)) group.totalDue += Number(booking.balance_due ?? 0);
  }
  return groups;
}
