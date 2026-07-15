import { Component, Input } from '@angular/core';
import { BookingStatus } from '../core/models';

const LABELS: Record<BookingStatus, string> = {
  confirmed: 'Confirmed', arrived: 'Arrived', completed: 'Completed',
  cancelled: 'Cancelled', no_show: 'No-show',
};

@Component({
  selector: 'status-chip',
  template: `<span class="bc-pill bc-pill--{{ status }}">{{ label }}</span>`,
  styles: ``,
})
export class StatusChipComponent {
  @Input({ required: true }) status!: BookingStatus;
  get label(): string { return LABELS[this.status]; }
}
