import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface ItemDialogResult { item_name: string; quantity: number; unit_price: number; }

@Component({
  selector: 'app-item-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Add item</h2>
    <mat-dialog-content>
      <form [formGroup]="form" id="item-form" (ngSubmit)="save()">
        <mat-form-field appearance="outline">
          <mat-label>Item</mat-label>
          <input matInput formControlName="item_name" placeholder="Water bottle" />
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>Qty</mat-label>
            <input matInput type="number" formControlName="quantity" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Unit price (₹)</mat-label>
            <input matInput type="number" formControlName="unit_price" />
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Cancel</button>
      <button mat-flat-button form="item-form" type="submit" [disabled]="form.invalid">Add</button>
    </mat-dialog-actions>
  `,
  styles: `
    form { display: flex; flex-direction: column; gap: 10px; min-width: min(320px, 80vw); }
    .row { display: flex; gap: 8px; } .row mat-form-field { flex: 1; }
    mat-dialog-title { font-family: var(--bc-font-display); font-weight: 800; color: var(--bc-teal); }
    mat-dialog-actions button { border-radius: 10px; }
  `,
})
export class ItemDialogComponent {
  private fb = inject(NonNullableFormBuilder);
  private ref = inject(MatDialogRef<ItemDialogComponent, ItemDialogResult>);
  form = this.fb.group({
    item_name: ['', [Validators.required, Validators.maxLength(100)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unit_price: [0, [Validators.required, Validators.min(0)]],
  });
  save(): void {
    if (this.form.valid) this.ref.close(this.form.getRawValue());
  }
}
