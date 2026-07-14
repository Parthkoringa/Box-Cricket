import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fakeJwt } from '../../core/auth.service.spec';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('token', fakeJwt({ sub: 'owner-1', role: 'owner', name: 'O' }));
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => { ctrl.verify(); localStorage.clear(); });

  it('loads the worker and PATCHes only changed/filled fields', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    ctrl.expectOne('/api/users/worker').flush({
      id: 'w1', name: 'Worker', phone: '9000000002', email: null, role: 'worker', is_active: true,
    });
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component.workerForm.patchValue({ name: 'Renamed', password: '' });
    component.saveWorker();
    const req = ctrl.expectOne('/api/users/w1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body.name).toBe('Renamed');
    expect('password' in req.request.body).toBe(false); // empty password not sent
    expect(req.request.body.email).toBeNull();      // '' converts to null on the wire
    expect(req.request.body.is_active).toBe(true);  // always included in the PATCH
    req.flush({ id: 'w1', name: 'Renamed', phone: '9000000002', email: null, role: 'worker', is_active: true });
  });

  it('changes own password via own user id from the JWT', () => {
    const fixture = TestBed.createComponent(SettingsComponent);
    fixture.detectChanges();
    ctrl.expectOne('/api/users/worker').flush({
      id: 'w1', name: 'Worker', phone: '9000000002', email: null, role: 'worker', is_active: true,
    });

    const component = fixture.componentInstance;
    component.ownPassword.setValue('newownerpass');
    component.saveOwnPassword();
    const req = ctrl.expectOne('/api/users/owner-1');
    expect(req.request.body).toEqual({ password: 'newownerpass' });
    req.flush({ id: 'owner-1', name: 'O', phone: 'x', email: null, role: 'owner', is_active: true });
  });
});
