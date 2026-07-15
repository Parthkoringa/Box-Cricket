import { Booking } from './models';
import { groupByDay } from './booking-groups';

function b(id: string, date: string, due: string | undefined, status: Booking['status'] = 'confirmed'): Booking {
  return {
    id, court_id: 'c', customer_name: id, customer_phone: '9', booking_date: date,
    start_time: `${date}T18:00:00.000Z`, end_time: `${date}T20:00:00.000Z`,
    total_amount: '1000', status, advance_forfeited: false, cancellation_reason: null,
    reminder_acknowledged: false, created_at: '', updated_at: '', balance_due: due,
  };
}

describe('groupByDay', () => {
  it('groups consecutive dates, labels them, counts and sums due', () => {
    const groups = groupByDay(
      [b('a', '2026-07-14', '500'), b('c', '2026-07-14', '200', 'cancelled'), b('d', '2026-07-15', '700')],
      '2026-07-14',
    );
    expect(groups.length).toBe(2);
    expect(groups[0].label).toBe('Today');
    expect(groups[0].count).toBe(2);
    expect(groups[0].totalDue).toBe(500); // cancelled excluded from due
    expect(groups[1].label).toBe('Tomorrow');
    expect(groups[1].bookings[0].id).toBe('d');
  });

  it('returns empty array for no bookings', () => {
    expect(groupByDay([], '2026-07-14')).toEqual([]);
  });
});
