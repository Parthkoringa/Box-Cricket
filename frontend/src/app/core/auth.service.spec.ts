import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from './auth.service';

export function fakeJwt(payload: object, expiresInSec = 3600): string {
  const body = { ...payload, exp: Math.floor(Date.now() / 1000) + expiresInSec };
  return ['header', btoa(JSON.stringify(body)), 'sig'].join('.');
}

// Real route target for '/login' so that logout()'s real router.navigate(['/login']) call
// resolves instead of rejecting with "NG04002: Cannot match any routes" (an empty route
// table doesn't tolerate real navigation the way Jasmine/Karma's environment did).
@Component({ template: '' })
class BlankComponent {}

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', component: BlankComponent }]),
      ],
    });
    localStorage.clear();
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { http.verify(); localStorage.clear(); });

  it('login POSTs credentials and stores the token', () => {
    service.login('9000000001', 'pw').subscribe();
    const req = http.expectOne('/api/auth/login');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ identifier: '9000000001', password: 'pw' });
    const token = fakeJwt({ sub: 'u1', role: 'owner', name: 'O' });
    req.flush({ token, user: { id: 'u1', name: 'O', role: 'owner' } });
    expect(service.token).toBe(token);
    expect(service.user?.role).toBe('owner');
  });

  it('user is null with no token, an expired token, or garbage', () => {
    expect(service.user).toBeNull();
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'owner', name: 'O' }, -60));
    expect(service.user).toBeNull();
    localStorage.setItem('token', 'garbage');
    expect(service.user).toBeNull();
  });

  it('logout clears the token', () => {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'worker', name: 'W' }));
    service.logout();
    expect(service.token).toBeNull();
  });

  it('homeFor maps roles to their landing routes', () => {
    expect(service.homeFor('owner')).toBe('/owner/bookings');
    expect(service.homeFor('worker')).toBe('/worker');
  });
});
