import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { ChartConfiguration } from 'chart.js';
import { BaseChartDirective } from 'ng2-charts';
import { ReportsApi } from '../../core/api';
import { todayLocal } from '../../core/booking-time';
import { Booking, ReportSummary, TrendPoint } from '../../core/models';
import { InrPipe } from '../../shared/inr.pipe';
import { StatusChipComponent } from '../../shared/status-chip.component';

@Component({
  selector: 'app-reports',
  imports: [
    ReactiveFormsModule, DatePipe, InrPipe, StatusChipComponent, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, BaseChartDirective,
  ],
  template: `
    <div class="range">
      <mat-form-field appearance="outline">
        <mat-label>From</mat-label>
        <input matInput type="date" [formControl]="from" />
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>To</mat-label>
        <input matInput type="date" [formControl]="to" />
      </mat-form-field>
    </div>

    @if (summary(); as s) {
      <div class="cards">
        <mat-card appearance="outlined"><mat-card-content>
          <span class="label">Revenue</span><strong>{{ s.revenue | inr }}</strong>
        </mat-card-content></mat-card>
        <mat-card appearance="outlined"><mat-card-content>
          <span class="label">Forfeited advances</span><strong>{{ s.forfeited_advances | inr }}</strong>
        </mat-card-content></mat-card>
        <mat-card appearance="outlined"><mat-card-content>
          <span class="label">Completed</span><strong>{{ s.bookings.completed ?? 0 }}</strong>
        </mat-card-content></mat-card>
        <mat-card appearance="outlined"><mat-card-content>
          <span class="label">Cancelled / no-show</span>
          <strong>{{ (s.bookings.cancelled ?? 0) + (s.bookings.no_show ?? 0) }}</strong>
        </mat-card-content></mat-card>
      </div>
    }

    <mat-card appearance="outlined">
      <mat-card-content>
        <h3>Bookings & revenue per day</h3>
        <canvas baseChart type="line" [data]="chartData" [options]="chartOptions"></canvas>
      </mat-card-content>
    </mat-card>

    <mat-card appearance="outlined">
      <mat-card-content>
        <h3>Pending payments</h3>
        <div class="scroll">
          <table>
            <thead><tr><th>Date</th><th>Customer</th><th>Status</th><th>Balance due</th></tr></thead>
            <tbody>
              @for (b of pending(); track b.id) {
                <tr [routerLink]="['/owner/bookings', b.id]">
                  <td>{{ b.start_time | date: 'd MMM, h:mm a' }}</td>
                  <td>{{ b.customer_name }}<br /><small>{{ b.customer_phone }}</small></td>
                  <td><status-chip [status]="b.status" /></td>
                  <td>{{ b.balance_due | inr }}</td>
                </tr>
              } @empty { <tr><td colspan="4" class="empty">Nothing pending.</td></tr> }
            </tbody>
          </table>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    .range { display: flex; gap: 8px; flex-wrap: wrap; }
    .cards { display: grid; gap: 8px; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); }
    .cards mat-card-content { display: flex; flex-direction: column; }
    .label { font-size: 12px; opacity: 0.7; }
    .cards strong { font-size: 22px; }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th, td { text-align: left; padding: 8px; border-bottom: 1px solid rgba(0 0 0 / 10%); white-space: nowrap; }
    tbody tr { cursor: pointer; }
    .empty { opacity: 0.6; text-align: center; }
    h3 { margin: 0 0 8px; }
  `,
})
export class ReportsComponent {
  private api = inject(ReportsApi);

  from = new FormControl(todayLocal().slice(0, 8) + '01', { nonNullable: true });
  to = new FormControl(todayLocal(), { nonNullable: true });

  summary = signal<ReportSummary | null>(null);
  pending = signal<Booking[]>([]);
  chartData: ChartConfiguration<'line'>['data'] = { labels: [], datasets: [] };
  chartOptions: ChartConfiguration<'line'>['options'] = {
    responsive: true,
    scales: { bookings: { type: 'linear', position: 'right', ticks: { precision: 0 } }, y: { type: 'linear', position: 'left' } },
  };

  constructor() {
    this.load();
    this.from.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.load());
    this.to.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.load());
  }

  load(): void {
    const from = this.from.value;
    const to = this.to.value;
    if (!from || !to || from > to) return;
    this.api.summary(from, to).subscribe((s) => this.summary.set(s));
    this.api.pending().subscribe((p) => this.pending.set(p));
    this.api.trends(from, to).subscribe((t) => this.setChart(t));
  }

  private setChart(points: TrendPoint[]): void {
    this.chartData = {
      labels: points.map((p) => p.day),
      datasets: [
        { label: 'Revenue (₹)', data: points.map((p) => Number(p.revenue)), yAxisID: 'y', tension: 0.3 },
        { label: 'Bookings', data: points.map((p) => p.bookings), yAxisID: 'bookings', tension: 0.3 },
      ],
    };
  }
}
