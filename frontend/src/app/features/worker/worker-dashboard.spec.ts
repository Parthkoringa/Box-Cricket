import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Booking } from '../../core/models';
import { WorkerDashboardComponent } from './worker-dashboard.component';

function booking(id: string, dayOffset: number): Booking {
  const start = new Date(Date.now() + dayOffset * 86_400_000);
  return {
    id, court_id: 'c1', customer_name: `Cust ${id}`, customer_phone: '9876543210',
    booking_date: start.toLocaleDateString('en-CA'),
    start_time: start.toISOString(), end_time: new Date(start.getTime() + 7_200_000).toISOString(),
    total_amount: '1000', status: 'confirmed', advance_forfeited: false,
    cancellation_reason: null, reminder_acknowledged: false, created_at: '', updated_at: '',
    balance_due: '500',
  };
}

// NOTE: the task brief's spec used fakeAsync/tick/discardPeriodicTasks (zone.js APIs).
// This app is zoneless, so those don't work here. We drive rxjs's timer(0, 60_000)
// with Vitest's fake timers instead: vi.useFakeTimers() + vi.advanceTimersByTimeAsync(...).
describe('WorkerDashboardComponent', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [WorkerDashboardComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    ctrl.verify();
    vi.useRealTimers();
  });

  it('groups bookings into today / upcoming / past and polls reminders every 60s', async () => {
    const fixture = TestBed.createComponent(WorkerDashboardComponent);

    // Fires the timer(0, 60_000)'s initial (0ms) tick, which subscribes to RemindersApi.list().
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    ctrl.expectOne((r) => r.url === '/api/bookings').flush([booking('past', -2), booking('today', 0), booking('future', 2)]);
    ctrl.expectOne('/api/reminders').flush([booking('today', 0)]);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    expect(component.today().length).toBe(1);
    expect(component.upcoming().length).toBe(1);
    expect(component.past().length).toBe(1);
    expect(component.reminders().length).toBe(1);

    // Advance one full poll interval; the timer's second tick re-subscribes to RemindersApi.list().
    await vi.advanceTimersByTimeAsync(60_000);
    ctrl.expectOne('/api/reminders').flush([]);
    fixture.detectChanges();
    expect(component.reminders().length).toBe(0);
  });

  it('dismissing a reminder acks it and removes the banner', async () => {
    const fixture = TestBed.createComponent(WorkerDashboardComponent);

    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();

    ctrl.expectOne((r) => r.url === '/api/bookings').flush([]);
    ctrl.expectOne('/api/reminders').flush([booking('soon', 0)]);
    fixture.detectChanges();

    fixture.componentInstance.dismiss(fixture.componentInstance.reminders()[0]);
    ctrl.expectOne('/api/reminders/soon/ack').flush({ ok: true });
    expect(fixture.componentInstance.reminders().length).toBe(0);
  });
});
