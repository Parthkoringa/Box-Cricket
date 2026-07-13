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
    <mat-toolbar color="primary">
      <span class="title">Box Cricket</span>
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
    .spacer { flex: 1; }
    .title { margin-right: 16px; }
    nav { display: flex; overflow-x: auto; }
    nav a.active { text-decoration: underline; text-underline-offset: 6px; }
    main { padding: 16px; max-width: 1100px; margin: 0 auto; }
    @media (max-width: 600px) { .title { display: none; } main { padding: 8px; } }
  `,
})
export class OwnerShellComponent {
  protected auth = inject(AuthService);
}
