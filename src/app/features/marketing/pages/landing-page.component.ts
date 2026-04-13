import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { BrandMarkComponent } from '../../../shared/ui/brand-mark/brand-mark.component';

@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, BrandMarkComponent],
  templateUrl: './landing-page.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPageComponent {
  protected readonly isMenuOpen = signal(false);

  protected toggleMenu(): void {
    this.isMenuOpen.update((value) => !value);
  }

  protected closeMenu(): void {
    this.isMenuOpen.set(false);
  }
}
