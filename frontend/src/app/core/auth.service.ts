import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthUser, LoginResponse, Role } from './models';

const TOKEN_KEY = 'token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  login(identifier: string, password: string) {
    return this.http
      .post<LoginResponse>('/api/auth/login', { identifier, password })
      .pipe(tap((r) => localStorage.setItem(TOKEN_KEY, r.token)));
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  get user(): AuthUser | null {
    const token = this.token;
    if (!token) return null;
    try {
      const payload = this.decodePayload(token.split('.')[1]);
      if (typeof payload['exp'] === 'number' && payload['exp'] * 1000 < Date.now()) return null;
      return { id: payload['sub'], role: payload['role'], name: payload['name'] } as AuthUser;
    } catch {
      return null;
    }
  }

  private decodePayload(segment: string): Record<string, unknown> {
    const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    this.router.navigate(['/login']);
  }

  homeFor(role: Role): string {
    return role === 'owner' ? '/owner/bookings' : '/worker';
  }
}
