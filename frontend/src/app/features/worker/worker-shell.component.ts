import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-worker-shell',
  imports: [RouterOutlet, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar>
      <span class="logo">Box<em>Cricket</em></span>
      <span> — {{ auth.user?.name }}</span>
      <span class="spacer"></span>
      <button mat-icon-button (click)="auth.logout()" aria-label="Log out"><mat-icon>logout</mat-icon></button>
    </mat-toolbar>
    <main><router-outlet /></main>
  `,
  styles: `
    mat-toolbar {
      background: rgba(253, 252, 250, 0.8);
      backdrop-filter: blur(6px);
      border-bottom: 1px solid var(--bc-line);
      color: var(--bc-ink);
      gap: 14px;
    }
    .logo { font-family: var(--bc-font-display); font-weight: 800; font-size: 18px; color: var(--bc-teal); }
    .logo em { font-style: normal; color: var(--bc-gold); }
    .spacer { flex: 1; }
    main { padding: 12px; max-width: 800px; margin: 0 auto; }
    @media (max-width: 600px) { .logo { font-size: 16px; } main { padding: 8px; } }
  `,
})
export class WorkerShellComponent {
  protected auth = inject(AuthService);
}
