import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { switchMap, timer } from 'rxjs';
import { BookingsApi, RemindersApi } from '../../core/api';
import { daysAgoLocal, todayLocal } from '../../core/booking-time';
import { Booking } from '../../core/models';
import { InrPipe } from '../../shared/inr.pipe';
import { StatusChipComponent } from '../../shared/status-chip.component';

const POLL_MS = 60_000;

@Component({
  selector: 'app-worker-dashboard',
  imports: [DatePipe, RouterLink, InrPipe, StatusChipComponent, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    @for (r of reminders(); track r.id) {
      <div class="banner">
        <mat-icon>alarm</mat-icon>
        <span><strong>{{ r.customer_name }}</strong> starts at {{ r.start_time | date: 'h:mm a' }}</span>
        <button mat-icon-button (click)="dismiss(r)" aria-label="Dismiss reminder"><mat-icon>close</mat-icon></button>
      </div>
    }

    <h3>Today</h3>
    @if (today().length === 0) { <p class="empty">No bookings today.</p> }
    <div class="cards">
      @for (b of today(); track b.id) {
        <mat-card appearance="outlined" [routerLink]="['/worker/bookings', b.id]">
          <mat-card-content>
            <div class="line"><strong>{{ b.customer_name }}</strong><status-chip [status]="b.status" /></div>
            <div>{{ b.start_time | date: 'h:mm a' }} – {{ b.end_time | date: 'h:mm a' }}</div>
            <div class="line"><span>{{ b.customer_phone }}</span><span>Due: {{ b.balance_due | inr }}</span></div>
          </mat-card-content>
        </mat-card>
      }
    </div>

    <h3>Upcoming</h3>
    @if (upcoming().length === 0) { <p class="empty">Nothing upcoming.</p> }
    <div class="cards">
      @for (b of upcoming(); track b.id) {
        <mat-card appearance="outlined" [routerLink]="['/worker/bookings', b.id]">
          <mat-card-content>
            <div class="line"><strong>{{ b.customer_name }}</strong><status-chip [status]="b.status" /></div>
            <div>{{ b.start_time | date: 'EEE d MMM, h:mm a' }}</div>
          </mat-card-content>
        </mat-card>
      }
    </div>

    <h3>Last 7 days <small>(read-only)</small></h3>
    <div class="cards">
      @for (b of past(); track b.id) {
        <mat-card appearance="outlined" class="muted" [routerLink]="['/worker/bookings', b.id]">
          <mat-card-content>
            <div class="line"><strong>{{ b.customer_name }}</strong><status-chip [status]="b.status" /></div>
            <div>{{ b.start_time | date: 'EEE d MMM, h:mm a' }}</div>
          </mat-card-content>
        </mat-card>
      } @empty { <p class="empty">No recent bookings.</p> }
    </div>
  `,
  styles: `
    .banner { display: flex; align-items: center; gap: 8px; background: #fff3e0; color: #a1490d;
              border: 1px solid #ffb74d; border-radius: 8px; padding: 6px 12px; margin-bottom: 8px; }
    .banner span { flex: 1; }
    h3 { margin: 16px 0 8px; }
    .cards { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
    mat-card { cursor: pointer; }
    .muted { opacity: 0.75; }
    .line { display: flex; justify-content: space-between; align-items: center; }
    .empty { opacity: 0.6; }
  `,
})
export class WorkerDashboardComponent {
  private bookingsApi = inject(BookingsApi);
  private remindersApi = inject(RemindersApi);

  private bookings = signal<Booking[]>([]);
  reminders = signal<Booking[]>([]);

  today = computed(() => this.bookings().filter((b) => b.booking_date === todayLocal()));
  upcoming = computed(() => this.bookings().filter((b) => b.booking_date > todayLocal()));
  past = computed(() => this.bookings().filter((b) => b.booking_date < todayLocal()));

  constructor() {
    this.bookingsApi.list({ from: daysAgoLocal(7) }).pipe(takeUntilDestroyed())
      .subscribe((rows) => this.bookings.set(rows));
    timer(0, POLL_MS).pipe(switchMap(() => this.remindersApi.list()), takeUntilDestroyed())
      .subscribe((rows) => this.reminders.set(rows));
  }

  dismiss(booking: Booking): void {
    this.remindersApi.ack(booking.id).subscribe(() => {
      this.reminders.update((list) => list.filter((r) => r.id !== booking.id));
    });
  }
}
