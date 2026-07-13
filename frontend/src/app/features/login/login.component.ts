import { Component, inject } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  template: `
    <div class="wrap">
      <mat-card appearance="outlined">
        <mat-card-header><mat-card-title>Box Cricket</mat-card-title></mat-card-header>
        <mat-card-content>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <mat-form-field appearance="outline">
              <mat-label>Phone or email</mat-label>
              <input matInput formControlName="identifier" autocomplete="username" />
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Password</mat-label>
              <input matInput type="password" formControlName="password" autocomplete="current-password" />
            </mat-form-field>
            <button mat-flat-button type="submit" [disabled]="form.invalid || loading">Sign in</button>
            @if (error) { <p class="error">{{ error }}</p> }
          </form>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: `
    .wrap { display: flex; justify-content: center; padding: 15vh 16px 0; }
    mat-card { width: 100%; max-width: 360px; }
    form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    .error { color: var(--mat-sys-error, #b00020); margin: 8px 0 0; }
  `,
})
export class LoginComponent {
  private fb = inject(NonNullableFormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  loading = false;
  error = '';
  form = this.fb.group({
    identifier: ['', Validators.required],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    const { identifier, password } = this.form.getRawValue();
    this.auth.login(identifier, password).subscribe({
      next: (r) => this.router.navigateByUrl(this.auth.homeFor(r.user.role)),
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error?.message ?? 'Login failed';
      },
    });
  }
}
