import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { CountUpDirective } from './count-up.directive';

@Component({ imports: [CountUpDirective], template: `<b [bcCountUp]="5400" bcPrefix="₹"></b>` })
class HostComponent {}

describe('CountUpDirective', () => {
  it('renders the final formatted value instantly in jsdom (no matchMedia)', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toBe('₹5,400');
  });
});
