import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
import { composeRange } from '../../core/booking-time';
import { BookingFormDialogComponent } from './booking-form-dialog.component';

describe('BookingFormDialogComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [BookingFormDialogComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: {} },
      ],
    });
  });

  it('defaults end time to start + 2 hours while end is untouched', () => {
    const fixture = TestBed.createComponent(BookingFormDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.controls.start.setValue('19:00');
    expect(component.form.controls.end.value).toBe('21:00');
  });

  it('stops auto-syncing end once the user edits it', () => {
    const fixture = TestBed.createComponent(BookingFormDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.controls.end.setValue('22:30');
    component.form.controls.end.markAsDirty();
    component.form.controls.start.setValue('19:00');
    expect(component.form.controls.end.value).toBe('22:30');
  });

  it('requires name, phone and a positive amount', () => {
    const fixture = TestBed.createComponent(BookingFormDialogComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.form.patchValue({ customer_name: '', customer_phone: 'abc', total_amount: 0 });
    expect(component.form.valid).toBe(false);
    component.form.patchValue({ customer_name: 'Ravi', customer_phone: '9876543210', total_amount: 1200 });
    expect(component.form.valid).toBe(true);
  });

  it('edit mode: prefills form and prevents end-time clobber', () => {
    const { start_time, end_time } = composeRange('2026-07-20', '18:00', '21:00');
    const booking = {
      id: 'b1',
      court_id: 'c1',
      customer_name: 'Ravi',
      customer_phone: '9876543210',
      booking_date: '2026-07-20',
      start_time,
      end_time,
      total_amount: '1500.00',
      status: 'confirmed' as const,
      advance_forfeited: false,
      cancellation_reason: null,
      reminder_acknowledged: false,
      created_at: '2026-07-13T12:00:00Z',
      updated_at: '2026-07-13T12:00:00Z',
      payments: [],
      items: [],
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [BookingFormDialogComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        { provide: MAT_DIALOG_DATA, useValue: { booking } },
      ],
    });
    const ctrl = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(BookingFormDialogComponent);
    // Flush the GET /api/courts request from constructor
    ctrl.expectOne('/api/courts').flush([]);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    // Assert prefill
    expect(component.form.controls.date.value).toBe('2026-07-20');
    expect(component.form.controls.start.value).toBe('18:00');
    expect(component.form.controls.end.value).toBe('21:00');
    expect(component.form.controls.customer_name.value).toBe('Ravi');
    expect(component.form.controls.customer_phone.value).toBe('9876543210');
    expect(component.form.controls.total_amount.value).toBe(1500);

    // Assert no clobber: change start to 19:00, end should stay 21:00
    component.form.controls.start.setValue('19:00');
    expect(component.form.controls.end.value).toBe('21:00');
  });

  it('save() in create mode: posts booking and closes dialog on success', () => {
    const ctrl = TestBed.inject(HttpTestingController);
    const dialogRefSpy = TestBed.inject(MatDialogRef<BookingFormDialogComponent>);
    const fixture = TestBed.createComponent(BookingFormDialogComponent);

    // Flush the GET /api/courts request
    ctrl.expectOne('/api/courts').flush([{ id: 'c9', venue_id: 'v1', name: 'Court 1' }]);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    // Fill the form
    component.form.patchValue({
      date: '2026-07-21',
      start: '18:00',
      end: '21:00',
      customer_name: 'Amit',
      customer_phone: '9876543210',
      total_amount: 1500,
    });

    // Call save
    component.save();

    // Expect POST to /api/bookings with correct body
    const req = ctrl.expectOne('/api/bookings');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.court_id).toBe('c9');
    expect(req.request.body.booking_date).toBe('2026-07-21');
    expect(req.request.body.customer_name).toBe('Amit');
    expect(req.request.body.customer_phone).toBe('9876543210');
    expect(req.request.body.total_amount).toBe(1500);
    expect(typeof req.request.body.start_time).toBe('string');
    expect(typeof req.request.body.end_time).toBe('string');

    // Flush success response
    req.flush({});

    // Assert dialog closed with true
    expect(dialogRefSpy.close).toHaveBeenCalledWith(true);
  });

  it('save() surfaces server 409 error message', () => {
    const ctrl = TestBed.inject(HttpTestingController);
    const dialogRefSpy = TestBed.inject(MatDialogRef<BookingFormDialogComponent>);
    const fixture = TestBed.createComponent(BookingFormDialogComponent);

    // Flush the GET /api/courts request
    ctrl.expectOne('/api/courts').flush([{ id: 'c9', venue_id: 'v1', name: 'Court 1' }]);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    // Fill the form
    component.form.patchValue({
      date: '2026-07-21',
      start: '18:00',
      end: '21:00',
      customer_name: 'Amit',
      customer_phone: '9876543210',
      total_amount: 1500,
    });

    // Call save
    component.save();

    // Expect POST to /api/bookings
    const req = ctrl.expectOne('/api/bookings');

    // Flush 409 Conflict with error message
    req.flush(
      { error: { code: 'SLOT_OVERLAP', message: 'This time slot overlaps an existing booking on this court.' } },
      { status: 409, statusText: 'Conflict' }
    );

    // Assert error message set and dialog not closed
    expect(component.error).toBe('This time slot overlaps an existing booking on this court.');
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });
});
