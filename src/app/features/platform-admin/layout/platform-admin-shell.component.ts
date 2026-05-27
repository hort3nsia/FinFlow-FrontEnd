import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { AuthService } from '../../../core/auth/auth.service';

interface AdminNavItem {
  label: string;
  route: string;
  icon: 'dashboard' | 'tenants' | 'subscriptions' | 'audit';
}

@Component({
  selector: 'app-platform-admin-shell',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './platform-admin-shell.component.html',
  styleUrl: './platform-admin-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlatformAdminShellComponent {
  private readonly authService = inject(AuthService);
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);

  protected readonly workspaceState = this.currentWorkspaceFacade.state;
  protected readonly userEmail = this.authService.userEmail;

  protected readonly navItems: AdminNavItem[] = [
    { label: 'Tổng quan', route: '/admin/overview', icon: 'dashboard' },
    { label: 'Tenants & Members', route: '/admin/tenants', icon: 'tenants' },
    { label: 'Subscriptions', route: '/admin/subscriptions', icon: 'subscriptions' },
  ];

  protected readonly adminInitial = computed(() => {
    const email = this.userEmail()?.trim();
    if (!email) return 'S';
    return email.charAt(0).toUpperCase();
  });

  protected readonly currentTenantName = computed(
    () => this.workspaceState().workspace?.tenantName ?? '—',
  );

  protected logout(): void {
    this.authService.logout();
  }
}
