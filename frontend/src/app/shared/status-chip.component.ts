import { Component, Input } from '@angular/core';
import { BookingStatus } from '../core/models';

const LABELS: Record<BookingStatus, string> = {
  confirmed: 'Confirmed', arrived: 'Arrived', completed: 'Completed',
  cancelled: 'Cancelled', no_show: 'No-show',
};

@Component({
  selector: 'status-chip',
  template: `<span class="chip" [class]="status">{{ label }}</span>`,
  styles: `
    .chip { padding: 2px 10px; border-radius: 12px; font-size: 12px; font-weight: 500; white-space: nowrap; }
    .confirmed { background: #e3f2fd; color: #1565c0; }
    .arrived { background: #fff8e1; color: #b26a00; }
    .completed { background: #e8f5e9; color: #2e7d32; }
    .cancelled { background: #fbe9e7; color: #c62828; }
    .no_show { background: #efebe9; color: #5d4037; }
  `,
})
export class StatusChipComponent {
  @Input({ required: true }) status!: BookingStatus;
  get label(): string { return LABELS[this.status]; }
}
