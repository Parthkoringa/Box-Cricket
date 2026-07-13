import { Component } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-cancel-dialog',
  imports: [ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Cancel booking?</h2>
    <mat-dialog-content>
      <p>The advance (if any) is forfeited. This cannot be undone.</p>
      <mat-form-field appearance="outline" class="full">
        <mat-label>Reason (optional)</mat-label>
        <textarea matInput [formControl]="reason" rows="2"></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close type="button">Keep booking</button>
      <button mat-flat-button [mat-dialog-close]="{ confirmed: true, reason: reason.value }">Cancel booking</button>
    </mat-dialog-actions>
  `,
  styles: `.full { width: 100%; }`,
})
export class CancelDialogComponent {
  reason = new FormControl('', { nonNullable: true });
}
