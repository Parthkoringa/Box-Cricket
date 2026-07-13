import { BookingStatus, Role } from './models';

export type BookingAction =
  | 'edit' | 'arrive' | 'complete' | 'cancel' | 'no_show'
  | 'add_payment' | 'add_item' | 'delete_entries';

/** Mirrors the server's rules for UI purposes only — the API re-enforces all of it.
 *  `actionable` = booking_date is today or later (worker mutation window). */
export function allowedActions(role: Role, status: BookingStatus, actionable: boolean): BookingAction[] {
  if (role === 'worker' && !actionable) return [];
  const actions: BookingAction[] = [];
  if (status === 'confirmed') {
    actions.push('arrive', 'no_show');
    if (role === 'owner') actions.push('edit', 'cancel');
  }
  if (status === 'arrived') actions.push('complete');
  if (status !== 'cancelled' && status !== 'no_show') actions.push('add_payment', 'add_item');
  if (role === 'owner') actions.push('delete_entries');
  return actions;
}
