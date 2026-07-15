import { Component, inject, signal } from '@angular/core';
import { FormControl, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSnackBar } from '@angular/material/snack-bar';
import { UsersApi } from '../../core/api';
import { AuthService } from '../../core/auth.service';
import { WorkerAccount } from '../../core/models';

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatSlideToggleModule],
  template: `
    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title>Worker account</mat-card-title></mat-card-header>
      <mat-card-content>
        <form [formGroup]="workerForm" (ngSubmit)="saveWorker()">
          <mat-form-field appearance="outline">
            <mat-label>Name</mat-label>
            <input matInput formControlName="name" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Phone</mat-label>
            <input matInput type="tel" formControlName="phone" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Email (optional)</mat-label>
            <input matInput type="email" formControlName="email" />
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>New password (leave blank to keep)</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" />
          </mat-form-field>
          <mat-slide-toggle formControlName="is_active">Account active</mat-slide-toggle>
          <button mat-flat-button type="submit" [disabled]="workerForm.invalid || !worker()">Save worker</button>
        </form>
      </mat-card-content>
    </mat-card>

    <mat-card appearance="outlined">
      <mat-card-header><mat-card-title>Change my password</mat-card-title></mat-card-header>
      <mat-card-content>
        <form (ngSubmit)="saveOwnPassword()">
          <mat-form-field appearance="outline">
            <mat-label>New password</mat-label>
            <input matInput type="password" [formControl]="ownPassword" autocomplete="new-password" />
          </mat-form-field>
          <button mat-flat-button type="submit" [disabled]="ownPassword.invalid">Update password</button>
        </form>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    :host { display: flex; flex-direction: column; gap: 12px; max-width: 480px; }
    form { display: flex; flex-direction: column; gap: 8px; }
    button { align-self: flex-start; border-radius: 10px; }
    mat-card {
      border: none;
      box-shadow: var(--bc-shadow);
      border-radius: var(--bc-radius);
    }
    mat-card-title {
      font-family: var(--bc-font-display);
      font-weight: 800;
      color: var(--bc-teal);
    }
  `,
})
export class SettingsComponent {
  private fb = inject(NonNullableFormBuilder);
  private api = inject(UsersApi);
  private auth = inject(AuthService);
  private snack = inject(MatSnackBar);

  worker = signal<WorkerAccount | null>(null);

  workerForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    phone: ['', [Validators.required, Validators.pattern(/^[0-9+\- ]{7,15}$/)]],
    email: [''],
    password: ['', [Validators.minLength(8)]],
    is_active: [true],
  });

  ownPassword = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] });

  constructor() {
    this.api.worker().subscribe((w) => {
      this.worker.set(w);
      this.workerForm.patchValue({ name: w.name, phone: w.phone, email: w.email ?? '', is_active: w.is_active });
    });
  }

  saveWorker(): void {
    const w = this.worker();
    if (!w || this.workerForm.invalid) return;
    const v = this.workerForm.getRawValue();
    const patch: Parameters<UsersApi['update']>[1] = {
      name: v.name, phone: v.phone, email: v.email || null, is_active: v.is_active,
    };
    if (v.password) patch.password = v.password;
    this.api.update(w.id, patch).subscribe({
      next: (updated) => {
        this.worker.set(updated);
        this.workerForm.controls.password.reset('');
        this.snack.open('Worker account saved', undefined, { duration: 2500 });
      },
      error: (err) => this.snack.open(err.error?.error?.message ?? 'Save failed', undefined, { duration: 4000 }),
    });
  }

  saveOwnPassword(): void {
    const me = this.auth.user;
    if (!me || this.ownPassword.invalid) return;
    this.api.update(me.id, { password: this.ownPassword.value }).subscribe({
      next: () => { this.ownPassword.reset(''); this.snack.open('Password updated', undefined, { duration: 2500 }); },
      error: (err) => this.snack.open(err.error?.error?.message ?? 'Update failed', undefined, { duration: 4000 }),
    });
  }
}
