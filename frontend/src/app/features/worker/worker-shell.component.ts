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
    <mat-toolbar color="primary">
      <span>Box Cricket — {{ auth.user?.name }}</span>
      <span class="spacer"></span>
      <button mat-icon-button (click)="auth.logout()" aria-label="Log out"><mat-icon>logout</mat-icon></button>
    </mat-toolbar>
    <main><router-outlet /></main>
  `,
  styles: `
    .spacer { flex: 1; }
    main { padding: 12px; max-width: 800px; margin: 0 auto; }
  `,
})
export class WorkerShellComponent {
  protected auth = inject(AuthService);
}
