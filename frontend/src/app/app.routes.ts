import { Routes } from '@angular/router';
import { authGuard, roleGuard } from './core/guards';
import { LoginComponent } from './features/login/login.component';
import { OwnerShellComponent } from './features/owner/owner-shell.component';
import { WorkerShellComponent } from './features/worker/worker-shell.component';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'owner',
    component: OwnerShellComponent,
    canActivate: [authGuard, roleGuard('owner')],
    children: [
      { path: 'bookings', loadComponent: () => import('./features/owner/bookings-list.component').then(m => m.BookingsListComponent) },
      { path: 'bookings/:id', loadComponent: () => import('./features/bookings/booking-detail.component').then(m => m.BookingDetailComponent) },
      // Task 7: { path: 'reports', loadComponent: ... }
      // Task 8: { path: 'settings', loadComponent: ... }
      { path: '', pathMatch: 'full', redirectTo: 'bookings' },
    ],
  },
  {
    path: 'worker',
    component: WorkerShellComponent,
    canActivate: [authGuard, roleGuard('worker')],
    children: [
      // Task 9: { path: '', loadComponent: ... (dashboard) }
      { path: 'bookings/:id', loadComponent: () => import('./features/bookings/booking-detail.component').then(m => m.BookingDetailComponent) },
    ],
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  { path: '**', redirectTo: 'login' },
];
