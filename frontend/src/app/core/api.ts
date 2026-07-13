import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import {
  Booking, BookingDetail, BookingItem, Court, NewBooking, Payment,
  PaymentMethod, PaymentType, ReportSummary, TrendPoint, WorkerAccount,
} from './models';

function params(obj: Record<string, string | undefined>): HttpParams {
  let p = new HttpParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value) p = p.set(key, value);
  }
  return p;
}

@Injectable({ providedIn: 'root' })
export class CourtsApi {
  private http = inject(HttpClient);
  list() { return this.http.get<Court[]>('/api/courts'); }
}

@Injectable({ providedIn: 'root' })
export class BookingsApi {
  private http = inject(HttpClient);

  list(filters: { date?: string; from?: string; to?: string; status?: string; q?: string } = {}) {
    return this.http.get<Booking[]>('/api/bookings', { params: params(filters) });
  }
  get(id: string) { return this.http.get<BookingDetail>(`/api/bookings/${id}`); }
  create(booking: NewBooking) { return this.http.post<Booking>('/api/bookings', booking); }
  update(id: string, patch: Partial<NewBooking>) { return this.http.patch<Booking>(`/api/bookings/${id}`, patch); }
  arrive(id: string) { return this.http.post<Booking>(`/api/bookings/${id}/arrive`, {}); }
  complete(id: string) { return this.http.post<Booking>(`/api/bookings/${id}/complete`, {}); }
  cancel(id: string, reason?: string) { return this.http.post<Booking>(`/api/bookings/${id}/cancel`, reason ? { reason } : {}); }
  noShow(id: string) { return this.http.post<Booking>(`/api/bookings/${id}/no-show`, {}); }
  addPayment(id: string, p: { amount: number; type: PaymentType; method: PaymentMethod }) {
    return this.http.post<Payment>(`/api/bookings/${id}/payments`, p);
  }
  deletePayment(paymentId: string) { return this.http.delete<{ deleted: string }>(`/api/payments/${paymentId}`); }
  addItem(id: string, item: { item_name: string; quantity: number; unit_price: number }) {
    return this.http.post<BookingItem>(`/api/bookings/${id}/items`, item);
  }
  deleteItem(itemId: string) { return this.http.delete<{ deleted: string }>(`/api/items/${itemId}`); }
}

@Injectable({ providedIn: 'root' })
export class RemindersApi {
  private http = inject(HttpClient);
  list() { return this.http.get<Booking[]>('/api/reminders'); }
  ack(bookingId: string) { return this.http.post<{ ok: boolean }>(`/api/reminders/${bookingId}/ack`, {}); }
}

@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private http = inject(HttpClient);
  summary(from: string, to: string) {
    return this.http.get<ReportSummary>('/api/reports/summary', { params: params({ from, to }) });
  }
  pending() { return this.http.get<Booking[]>('/api/reports/pending'); }
  trends(from: string, to: string) {
    return this.http.get<TrendPoint[]>('/api/reports/trends', { params: params({ from, to }) });
  }
}

@Injectable({ providedIn: 'root' })
export class UsersApi {
  private http = inject(HttpClient);
  worker() { return this.http.get<WorkerAccount>('/api/users/worker'); }
  update(id: string, patch: Partial<{ name: string; phone: string; email: string | null; password: string; is_active: boolean }>) {
    return this.http.patch<WorkerAccount>(`/api/users/${id}`, patch);
  }
}
