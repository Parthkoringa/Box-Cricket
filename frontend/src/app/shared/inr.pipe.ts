import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'inr' })
export class InrPipe implements PipeTransform {
  transform(value: string | number | null | undefined): string {
    const n = Number(value ?? 0);
    return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
}
