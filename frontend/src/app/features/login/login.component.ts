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
    <div class="wrap bc-stagger">
      <div class="sun" aria-hidden="true"></div>
      <h1 class="brand">Box<em>Cricket</em></h1>
      <p class="tag">Ground bookings, payments &amp; match-day ops</p>
      <mat-card appearance="outlined">
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
    .wrap { display: flex; flex-direction: column; align-items: center; padding: 13vh 16px 0; }
    .sun {
      width: 64px; height: 64px; border-radius: 50%;
      background: radial-gradient(circle at 35% 35%, #f5c96a, var(--bc-gold));
      box-shadow: 0 0 60px 18px rgba(224, 165, 46, 0.30);
      margin-bottom: 14px;
    }
    .brand { font-size: 34px; font-weight: 800; margin: 0; letter-spacing: -0.01em; }
    .brand em { font-style: normal; color: var(--bc-gold); }
    .tag { color: var(--bc-muted); font-size: 13px; margin: 4px 0 22px; }
    mat-card { width: 100%; max-width: 340px; border: none; border-radius: 20px; box-shadow: var(--bc-shadow-lift); }
    form { display: flex; flex-direction: column; gap: 8px; margin-top: 8px; }
    button { border-radius: 12px; padding: 22px 0; font-size: 15px; }
    .error { color: var(--bc-red); margin: 8px 0 0; }
    @media (prefers-reduced-motion: no-preference) {
      .sun { animation: bc-fade-up 0.5s ease-out both; }
    }
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
