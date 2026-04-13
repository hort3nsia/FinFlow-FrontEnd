import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { BrandMarkComponent } from '../../shared/ui/brand-mark/brand-mark.component';

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterOutlet, BrandMarkComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly authService = inject(AuthService);

  protected readonly userEmail = this.authService.userEmail;

  protected logout(): void {
    this.authService.logout();
  }
}
