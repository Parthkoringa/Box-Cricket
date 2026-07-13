import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { fakeJwt } from '../../core/auth.service.spec';
import { BookingDetail } from '../../core/models';
import { BookingDetailComponent } from './booking-detail.component';

function detail(overrides: Partial<BookingDetail> = {}): BookingDetail {
  const future = new Date(Date.now() + 86_400_000);
  return {
    id: 'b1', court_id: 'c1', customer_name: 'Ravi', customer_phone: '9876543210',
    booking_date: future.toLocaleDateString('en-CA'),
    start_time: future.toISOString(), end_time: new Date(future.getTime() + 7_200_000).toISOString(),
    total_amount: '1000.00', status: 'confirmed', advance_forfeited: false,
    cancellation_reason: null, reminder_acknowledged: false,
    created_at: '', updated_at: '', total_due: '1040.00', total_paid: '500.00', balance_due: '540.00',
    payments: [{ id: 'p1', booking_id: 'b1', amount: '500.00', type: 'advance', method: 'upi', collected_by: 'u', paid_at: future.toISOString() }],
    items: [{ id: 'i1', booking_id: 'b1', item_name: 'Water', quantity: 2, unit_price: '20.00', total_price: '40.00', added_by: 'u', added_at: future.toISOString() }],
    ...overrides,
  };
}

describe('BookingDetailComponent', () => {
  let ctrl: HttpTestingController;

  function setup(role: 'owner' | 'worker', data: BookingDetail) {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role, name: 'T' }));
    TestBed.configureTestingModule({
      imports: [BookingDetailComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(), provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['id', 'b1']]) } } },
      ],
    });
    ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BookingDetailComponent);
    fixture.detectChanges();
    ctrl.expectOne('/api/bookings/b1').flush(data);
    fixture.detectChanges();
    return fixture;
  }

  afterEach(() => { ctrl.verify(); localStorage.clear(); });

  it('shows balance and offers owner the full confirmed action set', () => {
    const fixture = setup('owner', detail());
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('₹540');
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map((b: any) => b.textContent.trim());
    expect(labels.some((l: string) => l.includes('Mark arrived'))).toBe(true);
    expect(labels.some((l: string) => l.includes('Cancel booking'))).toBe(true);
  });

  it('hides owner-only actions from the worker and shows no delete icons', () => {
    const fixture = setup('worker', detail());
    const html = (fixture.nativeElement as HTMLElement).innerHTML;
    expect(html).not.toContain('Cancel booking');
    expect(html).not.toContain('Edit');
    expect(fixture.nativeElement.querySelectorAll('[data-test="delete-payment"]').length).toBe(0);
  });

  it('offers nothing to a worker on a past booking', () => {
    const past = new Date(Date.now() - 3 * 86_400_000);
    const fixture = setup('worker', detail({
      booking_date: past.toLocaleDateString('en-CA'),
      start_time: past.toISOString(), end_time: new Date(past.getTime() + 7_200_000).toISOString(),
    }));
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map((b: any) => b.textContent.trim());
    expect(labels.some((l: string) => l.includes('Mark arrived'))).toBe(false);
    expect(labels.some((l: string) => l.includes('Add payment'))).toBe(false);
  });

  it('shows the completed state with no transition buttons', () => {
    const fixture = setup('owner', detail({ status: 'completed' }));
    const labels = Array.from(fixture.nativeElement.querySelectorAll('button')).map((b: any) => b.textContent.trim());
    expect(labels.some((l: string) => l.includes('Mark arrived'))).toBe(false);
    expect(labels.some((l: string) => l.includes('Add payment'))).toBe(true);
  });
});
