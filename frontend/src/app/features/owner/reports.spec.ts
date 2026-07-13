import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideCharts, withDefaultRegisterables } from 'ng2-charts';
import { ReportsComponent } from './reports.component';

describe('ReportsComponent', () => {
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ReportsComponent],
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        provideRouter([]), provideCharts(withDefaultRegisterables()),
      ],
    });
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('loads summary, pending, and trends for the default range on init', () => {
    const fixture = TestBed.createComponent(ReportsComponent);
    fixture.detectChanges();

    const summary = ctrl.expectOne((r) => r.url === '/api/reports/summary');
    expect(summary.request.params.get('from')).toMatch(/^\d{4}-\d{2}-01$/);
    summary.flush({ revenue: '5400', forfeited_advances: '300', bookings: { confirmed: 2, completed: 5 } });

    ctrl.expectOne('/api/reports/pending').flush([]);
    ctrl.expectOne((r) => r.url === '/api/reports/trends')
      .flush([{ day: '2026-07-01', bookings: 2, revenue: '2000' }]);

    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent!;
    expect(text).toContain('₹5,400');
    expect(text).toContain('₹300');
  });
});
