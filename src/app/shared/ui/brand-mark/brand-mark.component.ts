import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-brand-mark',
  template: `
    <span class="brand-mark">
      <span class="brand-mark__glyph">F</span>
      <span class="brand-mark__copy">
        <strong>FinFlow</strong>
        <small>Finance operations hub</small>
      </span>
    </span>
  `,
  styleUrl: './brand-mark.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BrandMarkComponent {}
