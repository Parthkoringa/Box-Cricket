import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { BookingsApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { todayLocal } from '../../core/booking-time';
import { BookingDetail } from '../../core/models';
import { BookingAction, allowedActions } from '../../core/permissions';
import { InrPipe } from '../../shared/inr.pipe';
import { StatusChipComponent } from '../../shared/status-chip.component';
import { BookingFormDialogComponent } from '../owner/booking-form-dialog.component';
import { CancelDialogComponent } from './cancel-dialog.component';
import { ItemDialogComponent, ItemDialogResult } from './item-dialog.component';
import { PaymentDialogComponent, PaymentDialogResult } from './payment-dialog.component';

@Component({
  selector: 'app-booking-detail',
  imports: [DatePipe, InrPipe, StatusChipComponent, MatCardModule, MatButtonModule, MatIconModule],
  template: `
    @if (booking(); as b) {
      <div class="bc-stagger">
        <mat-card appearance="outlined" class="bc-card">
          <mat-card-content>
            <div class="head">
              <h2>{{ b.customer_name }}</h2>
              <status-chip [status]="b.status" />
            </div>
            <p>{{ b.start_time | date: 'EEEE d MMM y, h:mm a' }} – {{ b.end_time | date: 'h:mm a' }}</p>
            <p>{{ b.customer_phone }}</p>
            @if (b.cancellation_reason) { <p>Reason: {{ b.cancellation_reason }}</p> }
            @if (b.advance_forfeited) { <p class="forfeit">Advance forfeited</p> }
            <div class="balances">
              <div><span>Total due</span><strong class="bc-money">{{ b.total_due | inr }}</strong></div>
              <div><span>Paid</span><strong class="bc-money green">{{ b.total_paid | inr }}</strong></div>
              <div class="hero"><span>Balance</span><strong class="bc-money">{{ b.balance_due | inr }}</strong></div>
            </div>
            <div class="actions">
              @if (can('arrive')) { <button mat-flat-button (click)="run(api.arrive(b.id))">Mark arrived</button> }
              @if (can('complete')) { <button mat-flat-button (click)="run(api.complete(b.id))">Mark completed</button> }
              @if (can('no_show')) { <button mat-stroked-button (click)="run(api.noShow(b.id))">No-show</button> }
              @if (can('edit')) { <button mat-stroked-button (click)="edit()">Edit</button> }
              @if (can('cancel')) { <button mat-stroked-button (click)="cancel()">Cancel booking</button> }
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="bc-card">
          <mat-card-content>
            <div class="head">
              <h3>Payments</h3>
              @if (can('add_payment')) { <button mat-stroked-button (click)="addPayment()">Add payment</button> }
            </div>
            @for (p of b.payments; track p.id) {
              <div class="rowline">
                <span>{{ p.paid_at | date: 'd MMM, h:mm a' }} · {{ p.type }} · {{ p.method }}</span>
                <span class="amount">
                  {{ p.amount | inr }}
                  @if (can('delete_entries')) {
                    <button mat-icon-button data-test="delete-payment" aria-label="Delete payment" (click)="deletePayment(p.id)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  }
                </span>
              </div>
            } @empty { <p class="empty">No payments yet.</p> }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="bc-card">
          <mat-card-content>
            <div class="head">
              <h3>Extra items</h3>
              @if (can('add_item')) { <button mat-stroked-button (click)="addItem()">Add item</button> }
            </div>
            @for (i of b.items; track i.id) {
              <div class="rowline">
                <span>{{ i.item_name }} × {{ i.quantity }}</span>
                <span class="amount">
                  {{ i.total_price | inr }}
                  @if (can('delete_entries')) {
                    <button mat-icon-button data-test="delete-item" aria-label="Delete item" (click)="deleteItem(i.id)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  }
                </span>
              </div>
            } @empty { <p class="empty">No extra items.</p> }
          </mat-card-content>
        </mat-card>
      </div>
    }
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; }
    mat-card { border: none; }
    .head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    h2 { margin: 0; font-size: 24px; font-weight: 800; }
    h3 { margin: 0; font-size: 15px; font-weight: 800; }
    .balances {
      display: flex; gap: 10px; margin: 14px 0; flex-wrap: wrap;
    }
    .balances > div {
      flex: 1; min-width: 90px;
      background: var(--bc-paper); border: 1px solid var(--bc-line);
      border-radius: 12px; padding: 10px 12px;
      display: flex; flex-direction: column;
    }
    .balances > div.hero { background: var(--bc-teal-soft); border-color: rgba(15, 76, 92, 0.2); }
    .balances span { font-size: 10px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--bc-muted); font-weight: 700; }
    .balances strong { font-size: 22px; }
    .balances strong.green { color: var(--bc-green); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .actions button { border-radius: 10px; }
    .rowline {
      display: flex; justify-content: space-between; align-items: center;
      padding: 8px 0; border-bottom: 1px solid var(--bc-hairline);
    }
    .rowline:last-of-type { border-bottom: none; }
    .amount { display: flex; align-items: center; gap: 4px; font-family: var(--bc-font-display); font-weight: 700; color: var(--bc-teal); }
    .forfeit { color: var(--bc-red); font-weight: 700; }
    .empty { color: var(--bc-muted); }
  `,
})
export class BookingDetailComponent {
  protected api = inject(BookingsApi);
  private auth = inject(AuthService);
  private route = inject(ActivatedRoute);
  private dialog = inject(MatDialog);
  private snack = inject(MatSnackBar);

  booking = signal<BookingDetail | null>(null);
  private actions = computed<BookingAction[]>(() => {
    const b = this.booking();
    const user = this.auth.user;
    if (!b || !user) return [];
    return allowedActions(user.role, b.status, b.booking_date >= todayLocal());
  });

  constructor() {
    this.reload();
  }

  private get id(): string {
    return this.route.snapshot.paramMap.get('id')!;
  }

  can(action: BookingAction): boolean {
    return this.actions().includes(action);
  }

  reload(): void {
    this.api.get(this.id).subscribe({
      next: (b) => this.booking.set(b),
      error: (err) => this.snack.open(err.error?.error?.message ?? 'Could not load booking', undefined, { duration: 4000 }),
    });
  }

  run(call: Observable<unknown>): void {
    call.subscribe({
      next: () => { this.snack.open('Updated', undefined, { duration: 2000 }); this.reload(); },
      error: (err) => this.snack.open(err.error?.error?.message ?? 'Action failed', undefined, { duration: 4000 }),
    });
  }

  edit(): void {
    this.dialog.open(BookingFormDialogComponent, { data: { booking: this.booking() }, maxWidth: '95vw' })
      .afterClosed().subscribe((saved) => {
        if (saved) {
          this.snack.open('Booking updated', undefined, { duration: 2500 });
          this.reload();
        }
      });
  }

  cancel(): void {
    this.dialog.open(CancelDialogComponent, { maxWidth: '95vw' }).afterClosed().subscribe((result) => {
      if (result?.confirmed) this.run(this.api.cancel(this.id, result.reason || undefined));
    });
  }

  addPayment(): void {
    this.dialog.open(PaymentDialogComponent, { maxWidth: '95vw' })
      .afterClosed().subscribe((p: PaymentDialogResult | undefined) => {
        if (p) this.run(this.api.addPayment(this.id, p));
      });
  }

  addItem(): void {
    this.dialog.open(ItemDialogComponent, { maxWidth: '95vw' })
      .afterClosed().subscribe((i: ItemDialogResult | undefined) => {
        if (i) this.run(this.api.addItem(this.id, i));
      });
  }

  deletePayment(paymentId: string): void {
    if (confirm('Delete this payment entry?')) this.run(this.api.deletePayment(paymentId));
  }

  deleteItem(itemId: string): void {
    if (confirm('Delete this item?')) this.run(this.api.deleteItem(itemId));
  }
}
