import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { NotificationsPanelComponent } from '../../features/notifications/components/notifications-panel.component';
import { NotificationsApiService } from '../../features/notifications/data/notifications-api.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NavigationEnd, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CurrentWorkspaceFacade } from '../../features/dashboard/data/current-workspace.facade';
import { CurrentSubscriptionFacade } from '../../features/subscription/data/current-subscription.facade';
import { filter } from 'rxjs';

interface ShellNavItem {
  label: string;
  icon:
    | 'dashboard'
    | 'documents'
    | 'approvals'
    | 'members'
    | 'vendors'
    | 'budgets'
    | 'payments'
    | 'departments'
    | 'subscription'
    | 'reports'
    | 'chat';
  route: string;
  badge?: string;
  badgeTone?: 'default' | 'warning';
  step?: number;
}

interface ShellBreadcrumb {
  label: string;
  routerLink?: string;
}

@Component({
  selector: 'app-shell',
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet, NotificationsPanelComponent],
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppShellComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly notificationsApi = inject(NotificationsApiService);
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);
  private readonly currentSubscriptionFacade = inject(CurrentSubscriptionFacade);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly userEmail = this.authService.userEmail;
  protected readonly workspaceState = this.currentWorkspaceFacade.state;
  protected readonly subscriptionState = this.currentSubscriptionFacade.state;
  protected readonly currentUrl = signal(this.router.url);
  protected readonly isSidebarOpen = signal(false);
  protected readonly workspaceName = computed(() => {
    const name = this.workspaceState().workspace?.tenantName?.trim();
    return name || 'Workspace';
  });
  protected readonly workspaceRole = computed(() => {
    const role = this.workspaceState().workspace?.role;
    if (!role) {
      return 'Thành viên';
    }

    const normalized = role.toString().toLowerCase().replace(/[\s_-]+/g, '');
    if (normalized.includes('superadmin')) return 'Super Admin';
    if (normalized.includes('tenantadmin') || normalized.includes('owner')) return 'Quản trị workspace';
    if (normalized.includes('accountant')) return 'Kế toán';
    if (normalized.includes('manager')) return 'Quản lý';
    if (normalized.includes('staff') || normalized.includes('employee')) return 'Nhân viên';
    return role.toString();
  });

  protected readonly canShowUpgrade = computed(() => {
    const role = (this.workspaceState().workspace?.role ?? '').toString().toLowerCase().replace(/[\s_-]+/g, '');
    return role.includes('tenantadmin') || role.includes('owner') || role.includes('superadmin');
  });

  protected readonly isSuperAdmin = computed(() => {
    const role = (this.workspaceState().workspace?.role ?? '').toString().toLowerCase().replace(/[\s_-]+/g, '');
    return role.includes('superadmin');
  });
  protected readonly workspaceBrandName = computed(() => {
    const name = this.workspaceName().trim();
    return name || 'Workspace';
  });
  protected readonly workspaceSubtitle = computed(() => 'FinFlow Workspace');
  protected readonly userDisplayName = computed(() => {
    const email = this.userEmail()?.trim();
    if (!email) {
      return 'Người dùng';
    }

    const localPart = email.split('@')[0]?.trim() ?? '';
    if (!localPart) {
      return email;
    }

    const displayName = localPart
      .replace(/[._-]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ');
    return displayName || email;
  });
  protected readonly profileDisplayName = computed(() => this.userDisplayName());
  protected readonly profileRole = computed(() => this.workspaceRole());
  protected readonly userInitial = computed(() => {
    const parts = this.profileDisplayName()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (parts.length === 0) {
      return 'U';
    }

    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
  });
  protected readonly expenseWorkflowItems: ShellNavItem[] = [
    { label: 'Tài liệu', icon: 'documents', route: '/app/documents', step: 1 },
    {
      label: 'Phê duyệt',
      icon: 'approvals',
      route: '/app/approvals',
      step: 2,
    },
    { label: 'Thanh toán', icon: 'payments', route: '/app/payments', step: 3 },
  ];
  protected readonly managementItems: ShellNavItem[] = [
    { label: 'Thành viên', icon: 'members', route: '/app/members' },
    { label: 'Nhà cung cấp', icon: 'vendors', route: '/app/vendors' },
    { label: 'Ngân sách', icon: 'budgets', route: '/app/budgets' },
    { label: 'Phòng ban', icon: 'departments', route: '/app/departments' },
    { label: 'Tổng quan', icon: 'dashboard', route: '/app/dashboard' },
    { label: 'Gói & Hạn mức', icon: 'subscription', route: '/app/subscription' },
    { label: 'Báo cáo', icon: 'reports', route: '/app/reports' },
    { label: 'Trợ lý AI', icon: 'chat', route: '/app/chat' },
  ];
  protected readonly hasPaidWorkspacePlan = computed(() => {
    const planTier = this.subscriptionState().subscription?.planTier?.toString().toLowerCase() ?? '';
    return planTier === 'pro' || planTier === 'enterprise' || planTier === 'business';
  });
  protected readonly canUseChatbot = computed(
    () => this.subscriptionState().subscription?.entitlements.chatbotEnabled ?? false,
  );
  protected readonly visibleExpenseWorkflowItems = computed(() =>
    this.expenseWorkflowItems.filter((item) => {
      return item.icon === 'documents' || item.icon === 'approvals' || item.icon === 'payments';
    }),
  );
  protected readonly visibleManagementItems = computed(() =>
    this.managementItems.filter((item) => {
      if (
        item.icon === 'members' ||
        item.icon === 'vendors' ||
        item.icon === 'budgets' ||
        item.icon === 'departments' ||
        item.icon === 'subscription' ||
        item.icon === 'dashboard'
      ) {
        return true;
      }

      if (item.icon === 'chat') {
        return this.canUseChatbot();
      }

      if (item.icon === 'reports') {
        return this.hasPaidWorkspacePlan();
      }

      return this.hasPaidWorkspacePlan();
    }),
  );
  protected readonly shellBreadcrumbs = computed<ShellBreadcrumb[]>(() => {
    const url = this.currentUrl().split('?')[0];

    if (url.startsWith('/app/documents')) {
      if (url.startsWith('/app/documents/upload')) {
        return [
          { label: 'Tài liệu', routerLink: '/app/documents/list' },
          { label: 'Tải lên & OCR' },
        ];
      }

      if (url.startsWith('/app/documents/manual')) {
        return [
          { label: 'Tài liệu', routerLink: '/app/documents/list' },
          { label: 'Nhập thủ công' },
        ];
      }

      if (url.startsWith('/app/documents/submitted/')) {
        return [
          { label: 'Tài liệu', routerLink: '/app/documents/list' },
          { label: 'Chi tiết chứng từ' },
        ];
      }

      if (url !== '/app/documents' && url !== '/app/documents/list') {
        return [
          { label: 'Tài liệu', routerLink: '/app/documents/list' },
          { label: 'Chi tiết bản nháp' },
        ];
      }

      return [{ label: 'Tài liệu' }, { label: 'Tất cả tài liệu' }];
    }

    if (url.startsWith('/app/approvals')) {
      return [{ label: 'Phê duyệt' }, { label: 'Hàng đợi duyệt' }];
    }

    if (url.startsWith('/app/payments')) {
      return [{ label: 'Thanh toán' }, { label: 'Hàng đợi hoàn tiền' }];
    }

    if (url.startsWith('/app/members')) {
      return [{ label: 'Thành viên' }, { label: 'Thành viên workspace' }];
    }

    if (url.startsWith('/app/departments')) {
      return [{ label: 'Phòng ban' }, { label: 'Sơ đồ tổ chức' }];
    }

    if (url.startsWith('/app/budgets')) {
      return [{ label: 'Ngân sách' }, { label: 'Quản lý ngân sách' }];
    }

    if (url.startsWith('/app/vendors')) {
      return [{ label: 'Nhà cung cấp' }, { label: 'Danh bạ nhà cung cấp' }];
    }

    if (url.startsWith('/app/subscription')) {
      return [{ label: 'Gói & Hạn mức' }, { label: 'Quản lý gói' }];
    }

    if (url.startsWith('/app/reports')) {
      return [{ label: 'Báo cáo' }, { label: 'Trung tâm báo cáo' }];
    }

    if (url.startsWith('/app/settings')) {
      return [{ label: 'Cấu hình' }, { label: 'Thiết lập workspace' }];
    }

    if (url.startsWith('/app/profile')) {
      return [{ label: 'Cá nhân' }, { label: 'Hồ sơ hoàn ứng' }];
    }

    if (url.startsWith('/app/chat')) {
      return [{ label: 'Trợ lý AI' }, { label: 'Hỏi đáp workspace' }];
    }

    return [{ label: 'Tổng quan' }];
  });
  protected readonly pageTitle = computed(() => {
    const url = this.currentUrl();
    const allItems = [...this.expenseWorkflowItems, ...this.managementItems];
    const activeItem = allItems.find((item) => url === item.route || url.startsWith(`${item.route}/`));
    return activeItem?.label ?? 'Tổng quan';
  });

  constructor() {
    effect(() => {
      this.currentSubscriptionFacade.ensureLoaded(
        this.workspaceState().workspace?.tenantId ?? null,
      );
    });
  }

  ngOnInit(): void {
    this.currentWorkspaceFacade.refresh();
    this.currentUrl.set(this.router.url);
    this.refreshUnreadCount();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((event) => {
        this.currentUrl.set(event.urlAfterRedirects);
        this.isSidebarOpen.set(false);
      });
  }

  protected toggleSidebar(): void {
    this.isSidebarOpen.update((isOpen) => !isOpen);
  }

  protected closeSidebar(): void {
    this.isSidebarOpen.set(false);
  }

  protected readonly isNotificationsPanelOpen = signal(false);
  protected readonly unreadNotifications = signal(0);

  protected toggleNotifications(): void {
    const next = !this.isNotificationsPanelOpen();
    this.isNotificationsPanelOpen.set(next);
    if (next) {
      this.refreshUnreadCount();
    }
  }

  protected closeNotifications(): void {
    this.isNotificationsPanelOpen.set(false);
    this.refreshUnreadCount();
  }

  protected refreshUnreadCount(): void {
    this.notificationsApi
      .getUnreadCount()
      .subscribe({
        next: (count) => this.unreadNotifications.set(count),
        error: () => {
          // non-critical: fail silently
        },
      });
  }

  protected logout(): void {
    this.authService.logout();
  }
}
