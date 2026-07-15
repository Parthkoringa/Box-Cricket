import { Directive, ElementRef, Input, OnChanges, OnDestroy, inject } from '@angular/core';

const DURATION_MS = 800;

@Directive({ selector: '[bcCountUp]' })
export class CountUpDirective implements OnChanges, OnDestroy {
  @Input({ required: true }) bcCountUp: number | string = 0;
  @Input() bcPrefix = '';

  private el = inject(ElementRef<HTMLElement>);
  private frameId: number | null = null;

  ngOnChanges(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
    }
    const target = Number(this.bcCountUp ?? 0);
    const reduced =
      typeof window.matchMedia !== 'function' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || !Number.isFinite(target)) {
      this.render(target);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / DURATION_MS, 1);
      this.render(target * (1 - Math.pow(1 - t, 3))); // ease-out cubic
      if (t < 1) this.frameId = requestAnimationFrame(tick);
    };
    this.frameId = requestAnimationFrame(tick);
  }

  ngOnDestroy(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
    }
  }

  private render(value: number): void {
    this.el.nativeElement.textContent =
      this.bcPrefix + Math.round(value).toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
}
