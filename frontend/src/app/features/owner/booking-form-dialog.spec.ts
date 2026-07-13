import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { vi } from 'vitest';
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
});
