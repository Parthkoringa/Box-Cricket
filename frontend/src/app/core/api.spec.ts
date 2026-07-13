import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BookingsApi, ReportsApi, RemindersApi } from './api';

describe('API services', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('BookingsApi.list sends only the provided filters as params', () => {
    const api = TestBed.inject(BookingsApi);
    api.list({ status: 'confirmed', q: 'ravi' }).subscribe();
    const req = ctrl.expectOne((r) => r.url === '/api/bookings');
    expect(req.request.params.get('status')).toBe('confirmed');
    expect(req.request.params.get('q')).toBe('ravi');
    expect(req.request.params.has('date')).toBe(false);
    req.flush([]);
  });

  it('BookingsApi actions hit the right endpoints', () => {
    const api = TestBed.inject(BookingsApi);
    api.cancel('b1', 'rain').subscribe();
    const cancel = ctrl.expectOne('/api/bookings/b1/cancel');
    expect(cancel.request.method).toBe('POST');
    expect(cancel.request.body).toEqual({ reason: 'rain' });
    cancel.flush({});

    api.addPayment('b1', { amount: 500, type: 'advance', method: 'upi' }).subscribe();
    const pay = ctrl.expectOne('/api/bookings/b1/payments');
    expect(pay.request.body.amount).toBe(500);
    pay.flush({});

    api.deletePayment('p1').subscribe();
    const del = ctrl.expectOne('/api/payments/p1');
    expect(del.request.method).toBe('DELETE');
    del.flush({});

    api.cancel('b2').subscribe();
    const cancelNoReason = ctrl.expectOne('/api/bookings/b2/cancel');
    expect(cancelNoReason.request.body).toEqual({});
    cancelNoReason.flush({});
  });

  it('BookingsApi.deleteItem targets /api/items/:id with DELETE', () => {
    const api = TestBed.inject(BookingsApi);
    api.deleteItem('i1').subscribe();
    const req = ctrl.expectOne('/api/items/i1');
    expect(req.request.method).toBe('DELETE');
    req.flush({ deleted: 'i1' });
  });

  it('BookingsApi.list omits empty-string filters entirely', () => {
    const api = TestBed.inject(BookingsApi);
    api.list({ date: '', status: '', q: 'x' }).subscribe();
    const req = ctrl.expectOne((r) => r.url === '/api/bookings');
    expect(req.request.params.has('date')).toBe(false);
    expect(req.request.params.has('status')).toBe(false);
    expect(req.request.params.get('q')).toBe('x');
    req.flush([]);
  });

  it('RemindersApi acks by booking id', () => {
    const api = TestBed.inject(RemindersApi);
    api.ack('b9').subscribe();
    const req = ctrl.expectOne('/api/reminders/b9/ack');
    expect(req.request.method).toBe('POST');
    req.flush({ ok: true });
  });

  it('ReportsApi passes the date range', () => {
    const api = TestBed.inject(ReportsApi);
    api.summary('2026-07-01', '2026-07-31').subscribe();
    const req = ctrl.expectOne((r) => r.url === '/api/reports/summary');
    expect(req.request.params.get('from')).toBe('2026-07-01');
    expect(req.request.params.get('to')).toBe('2026-07-31');
    req.flush({ revenue: '0', forfeited_advances: '0', bookings: {} });
  });
});
