import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RouterLink } from '@angular/router';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { BookingsApi } from '../../core/api';
import { Booking, BookingStatus } from '../../core/models';
import { InrPipe } from '../../shared/inr.pipe';
import { StatusChipComponent } from '../../shared/status-chip.component';
import { BookingFormDialogComponent } from './booking-form-dialog.component';

@Component({
  selector: 'app-bookings-list',
  imports: [
    ReactiveFormsModule, RouterLink, DatePipe, InrPipe, StatusChipComponent,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule, MatIconModule,
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

    @if (bookings().length === 0) { <p class="empty">No bookings match.</p> }
    <div class="cards">
      @for (b of bookings(); track b.id) {
        <mat-card appearance="outlined" [routerLink]="['/owner/bookings', b.id]">
          <mat-card-content>
            <div class="line1">
              <strong>{{ b.customer_name }}</strong>
              <status-chip [status]="b.status" />
            </div>
            <div>{{ b.start_time | date: 'EEE d MMM, h:mm a' }} – {{ b.end_time | date: 'h:mm a' }}</div>
            <div class="line3">
              <span>{{ b.customer_phone }}</span>
              <span>Due: {{ b.balance_due | inr }}</span>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </div>
  `,
  styles: `
    .filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
    .filters .grow { flex: 1; min-width: 180px; }
    .cards { display: grid; gap: 8px; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
    mat-card { cursor: pointer; }
    .line1, .line3 { display: flex; justify-content: space-between; align-items: center; }
    .line3 { color: rgba(0 0 0 / 60%); font-size: 13px; }
    .empty { text-align: center; opacity: 0.7; padding: 24px; }
  `,
})
export class BookingsListComponent {
  private api = inject(BookingsApi);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  readonly statuses: BookingStatus[] = ['confirmed', 'arrived', 'completed', 'cancelled', 'no_show'];
  bookings = signal<Booking[]>([]);

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
    this.api.list({
      date: this.date.value || undefined,
      status: this.status.value || undefined,
      q: this.q.value || undefined,
    }).subscribe((rows) => this.bookings.set(rows));
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
