import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { BrandMarkComponent } from '../../shared/ui/brand-mark/brand-mark.component';

interface ShellNavItem {
  label: string;
  icon: string;
  route?: string;
}

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, BrandMarkComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent {
  private readonly authService = inject(AuthService);

  protected readonly userEmail = this.authService.userEmail;
  protected readonly isAccountMenuOpen = signal(false);
  protected readonly navItems: ShellNavItem[] = [
    { label: 'Workspace Overview', icon: 'overview', route: '/app/dashboard' },
    { label: 'Documents', icon: 'documents', route: '/app/documents' },
    { label: 'Approvals', icon: 'approvals', route: '/app/approvals' },
    { label: 'Expenses', icon: 'expenses' },
    { label: 'Budgets', icon: 'budgets' },
    { label: 'Vendors', icon: 'vendors' },
    { label: 'AI Assistant', icon: 'assistant' },
    { label: 'Audit Logs', icon: 'audit' },
    { label: 'Settings', icon: 'settings' },
  ];

  protected toggleAccountMenu(): void {
    this.isAccountMenuOpen.update((value) => !value);
  }

  protected closeAccountMenu(): void {
    this.isAccountMenuOpen.set(false);
  }

  protected logout(): void {
    this.closeAccountMenu();
    this.authService.logout();
  }
}
