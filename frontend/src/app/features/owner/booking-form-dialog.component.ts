import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { BookingsApi, CourtsApi } from '../../core/api';
import { composeRange, plusTwoHours, toTimeInput, todayLocal } from '../../core/booking-time';
import { BookingDetail, Court, NewBooking } from '../../core/models';

@Component({
  selector: 'app-booking-form-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ booking ? 'Edit booking' : 'New booking' }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="booking-form" (ngSubmit)="save()">
        <mat-form-field appearance="outline">
          <mat-label>Date</mat-label>
          <input matInput type="date" formControlName="date" />
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Start</mat-label>
            <input matInput type="time" formControlName="start" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>End</mat-label>
            <input matInput type="time" formControlName="end" />
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>Customer name</mat-label>
          <input matInput formControlName="customer_name" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Customer phone</mat-label>
          <input matInput type="tel" formControlName="customer_phone" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Total amount (₹)</mat-label>
          <input matInput type="number" formControlName="total_amount" />
        </mat-form-field>
        @if (error) { <p class="error">{{ error }}</p> }
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button form="booking-form" type="submit" [disabled]="form.invalid || saving">
        {{ booking ? 'Save' : 'Create' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    form { display: flex; flex-direction: column; gap: 4px; min-width: min(420px, 80vw); }
    .row { display: flex; gap: 8px; }
    .row mat-form-field { flex: 1; }
    .error { color: var(--mat-sys-error, #b00020); margin: 0; }
  `,
})
export class BookingFormDialogComponent {
  private fb = inject(NonNullableFormBuilder);
  private api = inject(BookingsApi);
  private courtsApi = inject(CourtsApi);
  private ref = inject(MatDialogRef<BookingFormDialogComponent>);
  protected booking?: BookingDetail = inject<{ booking?: BookingDetail }>(MAT_DIALOG_DATA).booking;

  saving = false;
  error = '';
  private courts: Court[] = [];

  form = this.fb.group({
    date: [this.booking?.booking_date ?? todayLocal(), Validators.required],
    start: [this.booking ? toTimeInput(this.booking.start_time) : '18:00', Validators.required],
    end: [this.booking ? toTimeInput(this.booking.end_time) : '20:00', Validators.required],
    customer_name: [this.booking?.customer_name ?? '', [Validators.required, Validators.maxLength(100)]],
    customer_phone: [this.booking?.customer_phone ?? '', [Validators.required, Validators.pattern(/^[0-9+\- ]{7,15}$/)]],
    total_amount: [this.booking ? Number(this.booking.total_amount) : 0, [Validators.required, Validators.min(1)]],
  });

  constructor() {
    this.courtsApi.list().pipe(takeUntilDestroyed()).subscribe((c) => (this.courts = c));
    if (this.booking) this.form.controls.end.markAsDirty();
    this.form.controls.start.valueChanges.pipe(takeUntilDestroyed()).subscribe((start) => {
      if (!this.form.controls.end.dirty) this.form.controls.end.setValue(plusTwoHours(start), { emitEvent: false });
    });
  }

  save(): void {
    if (this.form.invalid || this.saving) return;
    const v = this.form.getRawValue();
    const courtId = this.booking?.court_id ?? this.courts[0]?.id;
    if (!courtId) { this.error = 'No court available'; return; }
    const payload: NewBooking = {
      court_id: courtId,
      customer_name: v.customer_name,
      customer_phone: v.customer_phone,
      booking_date: v.date,
      ...composeRange(v.date, v.start, v.end),
      total_amount: v.total_amount,
    };
    this.saving = true;
    const call = this.booking ? this.api.update(this.booking.id, payload) : this.api.create(payload);
    call.subscribe({
      next: () => this.ref.close(true),
      error: (err) => {
        this.saving = false;
        this.error = err.error?.error?.message ?? 'Could not save booking';
      },
    });
  }
}
