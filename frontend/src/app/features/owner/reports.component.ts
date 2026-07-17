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
import { CountUpDirective } from '../../shared/count-up.directive';
import { InrPipe } from '../../shared/inr.pipe';
import { StatusChipComponent } from '../../shared/status-chip.component';

@Component({
  selector: 'app-reports',
  imports: [
    ReactiveFormsModule, DatePipe, InrPipe, StatusChipComponent, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, BaseChartDirective, CountUpDirective,
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
      <div class="statgrid bc-stagger">
        <div class="stat bc-card"><small>Revenue</small><b [bcCountUp]="s.revenue" bcPrefix="₹"></b></div>
        <div class="stat bc-card gold"><small>Forfeited advances</small><b [bcCountUp]="s.forfeited_advances" bcPrefix="₹"></b></div>
        <div class="stat bc-card"><small>Completed</small><b [bcCountUp]="s.bookings.completed ?? 0"></b></div>
        <div class="stat bc-card"><small>Cancelled / no-show</small><b [bcCountUp]="(s.bookings.cancelled ?? 0) + (s.bookings.no_show ?? 0)"></b></div>
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
    .statgrid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
    .stat { padding: 14px 16px; position: relative; overflow: hidden; display: flex; flex-direction: column; }
    .stat::after {
      content: ''; position: absolute; right: -18px; top: -18px;
      width: 54px; height: 54px; border-radius: 50%; background: var(--bc-teal-soft);
    }
    .stat small { font-size: 10px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--bc-muted); font-weight: 700; margin-bottom: 5px; }
    .stat b { font-family: var(--bc-font-display); font-weight: 800; font-size: 26px; color: var(--bc-teal); }
    .stat.gold b { color: var(--bc-gold); }
    .stat.gold::after { background: var(--bc-gold-soft); }
    mat-card { border: none; }
    h3 { margin: 0 0 8px; font-size: 15px; font-weight: 800; }
    .scroll { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 8px; font-size: 10.5px; letter-spacing: 0.1em; text-transform: uppercase; color: var(--bc-teal); border-bottom: 2px solid var(--bc-sand); white-space: nowrap; }
    td { text-align: left; padding: 9px 8px; border-bottom: 1px solid var(--bc-hairline); white-space: nowrap; font-size: 13px; }
    tbody tr { cursor: pointer; transition: background 0.12s ease; }
    tbody tr:hover { background: var(--bc-teal-soft); }
    .empty { color: var(--bc-muted); text-align: center; }
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
        {
          label: 'Revenue (₹)', data: points.map((p) => Number(p.revenue)), yAxisID: 'y',
          tension: 0.35, borderColor: '#0f4c5c', borderWidth: 2.5, pointRadius: 0, fill: true,
          backgroundColor: (ctx: { chart: { ctx: CanvasRenderingContext2D | null; height: number } }) => {
            const c = ctx.chart.ctx;
            if (!c || typeof c.createLinearGradient !== 'function') return 'rgba(15,76,92,.15)';
            const g = c.createLinearGradient(0, 0, 0, ctx.chart.height || 200);
            g.addColorStop(0, 'rgba(15,76,92,.30)');
            g.addColorStop(1, 'rgba(15,76,92,0)');
            return g;
          },
        },
        {
          label: 'Bookings', data: points.map((p) => p.bookings), yAxisID: 'bookings',
          tension: 0.35, borderColor: '#e0a52e', borderWidth: 2, pointRadius: 0, borderDash: [5, 4],
        },
      ],
    };
  }
}
