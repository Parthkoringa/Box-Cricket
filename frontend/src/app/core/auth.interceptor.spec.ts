import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { fakeJwt } from './auth.service.spec';

describe('authInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    localStorage.clear();
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { ctrl.verify(); localStorage.clear(); });

  it('attaches Authorization when a token exists', () => {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'owner', name: 'O' }));
    http.get('/api/bookings').subscribe();
    const req = ctrl.expectOne('/api/bookings');
    expect(req.request.headers.get('Authorization')).toMatch(/^Bearer /);
    req.flush([]);
  });

  it('sends no header without a token', () => {
    http.get('/api/courts').subscribe();
    const req = ctrl.expectOne('/api/courts');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush([]);
  });

  it('a 401 clears the token and navigates to /login', () => {
    localStorage.setItem('token', fakeJwt({ sub: 'u1', role: 'owner', name: 'O' }));
    const router = TestBed.inject(Router);
    // Jasmine's spyOn() stubs the method (no call-through) by default; vi.spyOn() calls
    // through to the real implementation unless given a mock implementation. Without this,
    // the real Router.navigate(['/login']) would run against the empty test route table
    // above and reject with "NG04002: Cannot match any routes", surfacing as an unhandled
    // rejection under Vitest (Jasmine/Karma silently tolerated it).
    const nav = vi.spyOn(router, 'navigate').mockImplementation(() => Promise.resolve(true));
    http.get('/api/bookings').subscribe({ error: () => {} });
    ctrl.expectOne('/api/bookings').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(localStorage.getItem('token')).toBeNull();
    expect(nav).toHaveBeenCalledWith(['/login']);
  });
});
