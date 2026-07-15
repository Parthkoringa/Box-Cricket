import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-owner-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, MatToolbarModule, MatButtonModule, MatIconModule],
  template: `
    <mat-toolbar>
      <span class="logo">Box<em>Cricket</em></span>
      <nav>
        <a mat-button routerLink="/owner/bookings" routerLinkActive="active">Bookings</a>
        <a mat-button routerLink="/owner/reports" routerLinkActive="active">Reports</a>
        <a mat-button routerLink="/owner/settings" routerLinkActive="active">Settings</a>
      </nav>
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
    .logo { font-family: var(--bc-font-display); font-weight: 800; font-size: 18px; color: var(--bc-teal); margin-right: 8px; }
    .logo em { font-style: normal; color: var(--bc-gold); }
    nav { display: flex; overflow-x: auto; }
    nav a { color: var(--bc-muted); font-weight: 500; position: relative; }
    nav a.active { color: var(--bc-teal); font-weight: 700; }
    nav a.active::after {
      content: ''; position: absolute; left: 14px; right: 14px; bottom: 4px;
      height: 2px; background: var(--bc-gold); border-radius: 2px;
    }
    @media (prefers-reduced-motion: no-preference) {
      nav a::after { transition: left 0.2s ease, right 0.2s ease; }
    }
    .spacer { flex: 1; }
    main { padding: 16px; max-width: 1100px; margin: 0 auto; }
    @media (max-width: 600px) {
      .logo { font-size: 16px; }
      main { padding: 8px; }
      nav a { min-width: 0; padding: 0 8px; font-size: 13px; }
    }
  `,
})
export class OwnerShellComponent {
  protected auth = inject(AuthService);
}
