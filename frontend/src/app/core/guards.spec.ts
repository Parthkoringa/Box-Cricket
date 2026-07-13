import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { UrlTree, provideRouter } from '@angular/router';
import { authGuard, roleGuard } from './guards';
import { fakeJwt } from './auth.service.spec';

describe('guards', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    localStorage.clear();
  });

  const run = (fn: () => unknown) => TestBed.runInInjectionContext(fn);

  it('authGuard redirects to /login when logged out', () => {
    const result = run(() => authGuard({} as never, {} as never));
    expect(result instanceof UrlTree && result.toString()).toBe('/login');
  });

  it('authGuard passes when logged in', () => {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'owner', name: 'O' }));
    expect(run(() => authGuard({} as never, {} as never))).toBe(true);
  });

  it('roleGuard sends the wrong role to its own home', () => {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'worker', name: 'W' }));
    const result = run(() => roleGuard('owner')({} as never, {} as never));
    expect(result instanceof UrlTree && result.toString()).toBe('/worker');
  });

  it('roleGuard passes the right role', () => {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'owner', name: 'O' }));
    expect(run(() => roleGuard('owner')({} as never, {} as never))).toBe(true);
  });
});
