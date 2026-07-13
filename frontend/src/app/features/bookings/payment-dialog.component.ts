import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { PaymentMethod, PaymentType } from '../../core/models';

export interface PaymentDialogResult { amount: number; type: PaymentType; method: PaymentMethod; }

@Component({
  selector: 'app-payment-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatRadioModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Record payment</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="payment-form" (ngSubmit)="save()">
        <mat-form-field appearance="outline">
          <mat-label>Amount (₹)</mat-label>
          <input matInput type="number" formControlName="amount" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Type</mat-label>
          <mat-select formControlName="type">
            <mat-option value="advance">Advance</mat-option>
            <mat-option value="remaining">Remaining</mat-option>
            <mat-option value="extra">Extra</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-radio-group formControlName="method">
          <mat-radio-button value="cash">Cash</mat-radio-button>
          <mat-radio-button value="upi">UPI</mat-radio-button>
        </mat-radio-group>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button form="payment-form" type="submit" [disabled]="form.invalid">Save</button>
    </mat-dialog-actions>
  `,
  styles: `form { display: flex; flex-direction: column; gap: 8px; min-width: min(320px, 80vw); }`,
})
export class PaymentDialogComponent {
  private fb = inject(NonNullableFormBuilder);
  private ref = inject(MatDialogRef<PaymentDialogComponent, PaymentDialogResult>);
  form = this.fb.group({
    amount: [0, [Validators.required, Validators.min(1)]],
    type: ['remaining' as PaymentType, Validators.required],
    method: ['cash' as PaymentMethod, Validators.required],
  });
  save(): void {
    if (this.form.valid) this.ref.close(this.form.getRawValue());
  }
}
