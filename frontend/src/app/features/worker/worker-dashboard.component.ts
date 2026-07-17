import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { switchMap, timer } from 'rxjs';
import { BookingsApi, RemindersApi } from '../../core/api';
import { groupByDay } from '../../core/booking-groups';
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
      <div class="banner bc-fade-up">
        <mat-icon class="bell">alarm</mat-icon>
        <span><strong>{{ r.customer_name }}</strong> starts at {{ r.start_time | date: 'h:mm a' }} — get the court ready</span>
        <button mat-icon-button (click)="dismiss(r)" aria-label="Dismiss reminder"><mat-icon>close</mat-icon></button>
      </div>
    }

    <h3 class="bc-section-title">Today</h3>
    @if (today().length === 0) { <p class="empty">No bookings today.</p> }
    <div class="cards">
      @for (b of today(); track b.id) {
        <mat-card appearance="outlined" class="bc-card bc-card--hover" [routerLink]="['/worker/bookings', b.id]">
          <mat-card-content>
            <div class="line"><strong>{{ b.customer_name }}</strong><status-chip [status]="b.status" /></div>
            <div>{{ b.start_time | date: 'h:mm a' }} – {{ b.end_time | date: 'h:mm a' }}</div>
            <div class="line"><span>{{ b.customer_phone }}</span><span class="bc-money">Due: {{ b.balance_due | inr }}</span></div>
          </mat-card-content>
        </mat-card>
      }
    </div>

    <h3 class="bc-section-title">Upcoming</h3>
    @if (upcomingGroups().length === 0) {
      <p class="empty">Nothing upcoming.</p>
    } @else {
      @for (g of upcomingGroups(); track g.date) {
        <div class="day-head">
          <b>{{ g.label }}</b>
          @if (g.label === 'Today' || g.label === 'Tomorrow') { <span>{{ g.date | date: 'EEE d MMM' }}</span> }
          <i>{{ g.count }} booking{{ g.count === 1 ? '' : 's' }}</i>
        </div>
        <div class="rows bc-card">
          @for (b of g.bookings; track b.id) {
            <div class="row" [routerLink]="['/worker/bookings', b.id]">
              <div class="rail">
                {{ b.start_time | date: 'h:mm' }}
                <small>{{ b.end_time | date: 'h:mm a' }}</small>
              </div>
              <div class="t">
                <div class="who">{{ b.customer_name }}</div>
                <div class="ph">{{ b.customer_phone }}</div>
              </div>
              <status-chip [status]="b.status" />
            </div>
          }
        </div>
      }
    }

    <h3 class="bc-section-title">Last 7 days <small>(read-only)</small></h3>
    @if (pastGroups().length === 0) {
      <p class="empty">No recent bookings.</p>
    } @else {
      @for (g of pastGroups(); track g.date) {
        <div class="day-head">
          <b>{{ g.label }}</b>
          @if (g.label === 'Today' || g.label === 'Tomorrow') { <span>{{ g.date | date: 'EEE d MMM' }}</span> }
          <i>{{ g.count }} booking{{ g.count === 1 ? '' : 's' }}</i>
        </div>
        <div class="rows bc-card">
          @for (b of g.bookings; track b.id) {
            <div class="row done" [routerLink]="['/worker/bookings', b.id]">
              <div class="rail">
                {{ b.start_time | date: 'h:mm' }}
                <small>{{ b.end_time | date: 'h:mm a' }}</small>
              </div>
              <div class="t">
                <div class="who">{{ b.customer_name }}</div>
                <div class="ph">{{ b.customer_phone }}</div>
              </div>
              <status-chip [status]="b.status" />
            </div>
          }
        </div>
      }
    }
  `,
  styles: `
    .banner {
      display: flex; align-items: center; gap: 10px;
      background: linear-gradient(95deg, var(--bc-gold) 0%, #ecc25e 100%);
      color: #3d2c00; border-radius: 14px; padding: 10px 14px; margin-bottom: 10px;
      box-shadow: 0 6px 18px var(--bc-gold-soft); font-size: 13.5px;
    }
    .banner strong { font-weight: 700; }
    .banner span { flex: 1; }
    .banner button { color: #3d2c00; }
    @media (prefers-reduced-motion: no-preference) {
      .bell { animation: bc-ring 2.2s ease-in-out infinite; }
    }
    .cards { display: grid; gap: 10px; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); margin-bottom: 10px; }
    mat-card { cursor: pointer; }
    .line { display: flex; justify-content: space-between; align-items: center; }
    .empty { opacity: 0.6; }

    .rows { overflow: hidden; margin-bottom: 6px; }
    .row {
      display: flex; align-items: center; gap: 12px;
      padding: 9px 14px; cursor: pointer;
      border-bottom: 1px solid var(--bc-hairline);
      transition: background 0.12s ease;
    }
    .row:last-child { border-bottom: none; }
    .row:hover { background: var(--bc-teal-soft); }
    .row.done { opacity: 0.68; }
    .rail {
      width: 62px; flex: none; text-align: center; line-height: 1.25;
      font-family: var(--bc-font-display); font-weight: 700; font-size: 13px; color: var(--bc-teal);
      border-right: 2px solid var(--bc-sand); padding-right: 10px;
    }
    .rail small { display: block; font-family: var(--bc-font-body); font-weight: 400; font-size: 10.5px; color: var(--bc-muted); }
    .t { flex: 1; min-width: 0; }
    .who { font-weight: 700; font-size: 13.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ph { color: var(--bc-muted); font-size: 11px; }
    .day-head {
      position: sticky; top: 0; z-index: 1;
      display: flex; align-items: baseline; gap: 8px;
      padding: 12px 4px 7px;
      background: linear-gradient(180deg, var(--bc-dayhead) 70%, transparent);
    }
    .day-head b { font-family: var(--bc-font-display); font-weight: 800; font-size: 15px; color: var(--bc-teal); }
    .day-head span { font-size: 11px; color: var(--bc-muted); }
    .day-head i { font-style: normal; margin-left: auto; font-size: 11.5px; color: var(--bc-muted); }
    @media (max-width: 600px) { .ph { display: none; } .rail { width: 50px; } }
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

  upcomingGroups = computed(() => groupByDay(this.upcoming(), todayLocal()));
  pastGroups = computed(() => groupByDay(this.past(), todayLocal()));

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
