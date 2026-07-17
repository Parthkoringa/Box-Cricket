import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { BookingsApi } from '../../core/api';
import { groupByDay } from '../../core/booking-groups';
import { todayLocal } from '../../core/booking-time';
import { Booking, BookingStatus } from '../../core/models';
import { InrPipe } from '../../shared/inr.pipe';
import { StatusChipComponent } from '../../shared/status-chip.component';
import { BookingFormDialogComponent } from './booking-form-dialog.component';

@Component({
  selector: 'app-bookings-list',
  imports: [
    ReactiveFormsModule, RouterLink, DatePipe, InrPipe, StatusChipComponent,
    MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
  ],
  template: `
    <div class="filters">
      <mat-form-field appearance="outline">
        <mat-label>Date</mat-label>
        <input matInput type="date" [formControl]="date" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select [formControl]="status">
          <mat-option value="">All</mat-option>
          @for (s of statuses; track s) { <mat-option [value]="s">{{ s }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" class="grow">
        <mat-label>Search name or phone</mat-label>
        <input matInput [formControl]="q" />
      </mat-form-field>
      <button mat-flat-button (click)="newBooking()"><mat-icon>add</mat-icon> New booking</button>
    </div>

    @if (loading()) {
      <div class="bc-stagger">
        <div class="bc-skeleton" style="margin-bottom:8px"></div>
        <div class="bc-skeleton" style="margin-bottom:8px"></div>
        <div class="bc-skeleton"></div>
      </div>
    } @else if (groups().length === 0) {
      <div class="empty bc-fade-up">
        <span class="empty-ic"><mat-icon>sports_cricket</mat-icon></span>
        <p>No bookings match.</p>
      </div>
    } @else {
      @for (g of groups(); track g.date) {
        <div class="day-head">
          <b>{{ g.label }}</b>
          @if (g.label === 'Today' || g.label === 'Tomorrow') { <span>{{ g.date | date: 'EEE d MMM' }}</span> }
          <i>{{ g.count }} booking{{ g.count === 1 ? '' : 's' }}@if (g.totalDue > 0) { · {{ g.totalDue | inr }} due}</i>
        </div>
        <div class="rows bc-card bc-stagger">
          @for (b of g.bookings; track b.id) {
            <div class="row" [routerLink]="['/owner/bookings', b.id]">
              <div class="rail">
                {{ b.start_time | date: 'h:mm' }}
                <small>{{ b.end_time | date: 'h:mm a' }}</small>
              </div>
              <div class="t">
                <div class="who">{{ b.customer_name }}</div>
                <div class="ph">{{ b.customer_phone }}</div>
              </div>
              <status-chip [status]="b.status" />
              @if (paymentLabel(b).text) {
                <span class="pay" [class]="paymentLabel(b).cls">{{ paymentLabel(b).text }}</span>
              } @else {
                <span class="due bc-money">{{ b.balance_due | inr }}<small>due</small></span>
              }
            </div>
          }
        </div>
      }
    }
  `,
  styles: `
    .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 4px; }
    .filters .grow { flex: 1; min-width: 180px; }
    .day-head {
      position: sticky; top: 0; z-index: 1;
      display: flex; align-items: baseline; gap: 8px;
      padding: 12px 4px 7px;
      background: linear-gradient(180deg, var(--bc-dayhead) 70%, transparent);
    }
    .day-head b { font-family: var(--bc-font-display); font-weight: 800; font-size: 15px; color: var(--bc-teal); }
    .day-head span { font-size: 11px; color: var(--bc-muted); }
    .day-head i { font-style: normal; margin-left: auto; font-size: 11.5px; color: var(--bc-muted); }
    .rows { overflow: hidden; margin-bottom: 6px; }
    .row {
      display: flex; align-items: center; gap: 12px;
      padding: 9px 14px; cursor: pointer;
      border-bottom: 1px solid var(--bc-hairline);
      transition: background 0.12s ease;
    }
    .row:last-child { border-bottom: none; }
    .row:hover { background: var(--bc-teal-soft); }
    .rail {
      width: 62px; flex: none; text-align: center; line-height: 1.25;
      font-family: var(--bc-font-display); font-weight: 700; font-size: 13px; color: var(--bc-teal);
      border-right: 2px solid var(--bc-sand); padding-right: 10px;
    }
    .rail small { display: block; font-family: var(--bc-font-body); font-weight: 400; font-size: 10.5px; color: var(--bc-muted); }
    .t { flex: 1; min-width: 0; }
    .who { font-weight: 700; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ph { color: var(--bc-muted); font-size: 11px; }
    .due { font-size: 15px; min-width: 62px; text-align: right; }
    .due small { display: block; font-family: var(--bc-font-body); font-weight: 400; font-size: 9.5px; letter-spacing: 0.1em; color: var(--bc-muted); text-transform: uppercase; }
    .pay { font-size: 11px; font-weight: 700; letter-spacing: 0.06em; min-width: 62px; text-align: right; }
    .pay.green { color: var(--bc-green); }
    .pay.red { color: var(--bc-red); }
    .empty { text-align: center; padding: 40px 0; color: var(--bc-muted); }
    .empty-ic {
      display: inline-flex; width: 56px; height: 56px; border-radius: 50%;
      background: var(--bc-sand); align-items: center; justify-content: center; color: var(--bc-teal);
    }
    @media (max-width: 600px) {
      .ph { display: none; }
      .rail { width: 50px; }
    }
  `,
})
export class BookingsListComponent {
  private api = inject(BookingsApi);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  readonly statuses: BookingStatus[] = ['confirmed', 'arrived', 'completed', 'cancelled', 'no_show'];
  bookings = signal<Booking[]>([]);
  loading = signal(true);
  groups = computed(() => groupByDay(this.bookings(), todayLocal()));

  date = new FormControl('', { nonNullable: true });
  status = new FormControl('', { nonNullable: true });
  q = new FormControl('', { nonNullable: true });

  constructor() {
    this.load();
    this.date.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.load());
    this.status.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.load());
    this.q.valueChanges.pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe(() => this.load());
  }

  load(): void {
    this.loading.set(true);
    this.api.list({
      date: this.date.value || undefined,
      status: this.status.value || undefined,
      q: this.q.value || undefined,
    }).subscribe({
      next: (rows) => { this.bookings.set(rows); this.loading.set(false); },
      error: () => { this.loading.set(false); this.snack.open('Could not load bookings', undefined, { duration: 4000 }); },
    });
  }

  paymentLabel(b: Booking): { text: string; cls: string } {
    if (b.status === 'cancelled') return { text: b.advance_forfeited ? 'FORFEITED' : 'CANCELLED', cls: 'red' };
    if (b.status === 'no_show') return { text: 'FORFEITED', cls: 'red' };
    if (Number(b.balance_due ?? 0) <= 0) return { text: 'PAID', cls: 'green' };
    return { text: '', cls: '' };
  }

  newBooking(): void {
    this.dialog.open(BookingFormDialogComponent, { data: {}, maxWidth: '95vw' })
      .afterClosed().subscribe((created) => {
        if (created) {
          this.snack.open('Booking created', undefined, { duration: 2500 });
          this.load();
        }
      });
  }
}
