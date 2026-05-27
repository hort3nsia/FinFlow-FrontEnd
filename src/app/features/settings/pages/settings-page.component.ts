import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { CurrentSubscriptionFacade } from '../../subscription/data/current-subscription.facade';
import {
  SettingsApiService,
  TenantSettingsResponse,
  UpdateApprovalPolicyInput,
  UpdateBrandingInput,
  UpdateBudgetPolicyInput,
  UpdateNotificationPreferencesInput,
  UpdateReimbursementPolicyInput,
} from '../data/settings-api.service';

type SettingsTab =
  | 'branding'
  | 'approval'
  | 'budget'
  | 'reimbursement'
  | 'notifications'
  | 'quota';

interface SettingsTabConfig {
  id: SettingsTab;
  label: string;
  shortLabel: string;
  eyebrow: string;
  description: string;
  icon: string;
}

interface SettingsSummaryCard {
  label: string;
  value: string;
  detail: string;
  tone: 'blue' | 'emerald' | 'amber' | 'slate';
}

const ENFORCEMENT_MODES = [
  { code: 'Off', label: 'Tắt – chỉ ghi nhận, không chặn' },
  { code: 'SoftBlock', label: 'Soft – yêu cầu lý do khi vượt' },
  { code: 'HardBlock', label: 'Hard – chặn duyệt khi vượt' },
];

const APPROVER_ROLES = [
  { code: 'Manager', label: 'Manager' },
  { code: 'Accountant', label: 'Accountant' },
  { code: 'TenantAdmin', label: 'Tenant Admin' },
];

const DIGEST_FREQUENCIES = [
  { code: 'Daily', label: 'Hằng ngày' },
  { code: 'Weekly', label: 'Hằng tuần' },
  { code: 'Monthly', label: 'Hằng tháng' },
  { code: 'Disabled', label: 'Tắt' },
];

const LOCALES = [
  { code: 'vi-VN', label: 'Tiếng Việt (vi-VN)' },
  { code: 'en-US', label: 'English (en-US)' },
];

const TIMEZONES = [
  { code: 'Asia/Ho_Chi_Minh', label: 'Hồ Chí Minh (UTC+7)' },
  { code: 'Asia/Bangkok', label: 'Bangkok (UTC+7)' },
  { code: 'Asia/Singapore', label: 'Singapore (UTC+8)' },
  { code: 'Asia/Tokyo', label: 'Tokyo (UTC+9)' },
  { code: 'UTC', label: 'UTC' },
];

@Component({
  selector: 'app-settings-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './settings-page.component.html',
  styleUrl: './settings-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPageComponent {
  private readonly settingsApi = inject(SettingsApiService);
  private readonly currentSubscriptionFacade = inject(CurrentSubscriptionFacade);
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly workspaceState = this.currentWorkspaceFacade.state;

  protected readonly enforcementModes = ENFORCEMENT_MODES;
  protected readonly approverRoles = APPROVER_ROLES;
  protected readonly digestFrequencies = DIGEST_FREQUENCIES;
  protected readonly locales = LOCALES;
  protected readonly timezones = TIMEZONES;

  // ─── Loading + role gating ─────────────────────────────────────
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly settings = signal<TenantSettingsResponse | null>(null);
  protected readonly subscriptionData = computed(
    () => this.currentSubscriptionFacade.state().subscription,
  );
  protected readonly activeTab = signal<SettingsTab>('branding');

  protected readonly currentRole = computed(() => {
    const raw = (this.workspaceState().workspace?.role ?? '').toString();
    const normalized = raw.replace(/[\s_-]+/g, '').toLowerCase();
    if (normalized.includes('superadmin')) return 'SuperAdmin';
    if (normalized.includes('tenantadmin') || normalized.includes('owner')) return 'TenantAdmin';
    if (normalized.includes('accountant')) return 'Accountant';
    if (normalized.includes('manager')) return 'Manager';
    return 'Other';
  });

  protected readonly canEdit = computed(
    () => this.currentRole() === 'TenantAdmin' || this.currentRole() === 'SuperAdmin',
  );

  // ─── Per-tab form state (signals) ──────────────────────────────
  // Branding
  protected readonly companyDisplayName = signal('');
  protected readonly primaryColor = signal('#4f46e5');
  protected readonly logoUrl = signal('');
  protected readonly faviconUrl = signal('');
  protected readonly locale = signal('vi-VN');
  protected readonly timezone = signal('Asia/Ho_Chi_Minh');

  // Approval
  protected readonly autoApproveThreshold = signal<number>(0);
  protected readonly escalationThreshold = signal<number>(0);
  protected readonly escalationApproverRole = signal<string>('TenantAdmin');
  protected readonly requireDifferentApprover = signal(true);
  protected readonly maxApprovalAgeHours = signal<number>(48);
  protected readonly isEscalationEnabled = signal(true);

  // Budget
  protected readonly defaultEnforcementMode = signal<string>('SoftBlock');
  protected readonly defaultCarryOverPercent = signal<number>(0);
  protected readonly warningThreshold1 = signal<number>(70);
  protected readonly warningThreshold2 = signal<number>(90);

  // Reimbursement
  protected readonly maxClaimAmount = signal<number>(0);
  protected readonly receiptRequiredAbove = signal<number>(0);

  // Notifications
  protected readonly emailDigestEnabled = signal(true);
  protected readonly emailDigestFrequency = signal<string>('Weekly');

  // Per-tab save signals
  protected readonly savingTab = signal<SettingsTab | null>(null);
  protected readonly tabError = signal<{ tab: SettingsTab; message: string } | null>(null);
  protected readonly tabSuccess = signal<{ tab: SettingsTab; message: string } | null>(null);

  protected readonly tabs: SettingsTabConfig[] = [
    {
      id: 'branding',
      label: 'Thương hiệu & vùng',
      shortLabel: 'Thương hiệu',
      eyebrow: 'BRANDING',
      description: 'Tên hiển thị, màu nhận diện, ngôn ngữ và múi giờ mặc định.',
      icon: 'branding',
    },
    {
      id: 'approval',
      label: 'Phê duyệt',
      shortLabel: 'Phê duyệt',
      eyebrow: 'APPROVAL POLICY',
      description: 'Ngưỡng tự duyệt, SLA xử lý và quy tắc người duyệt.',
      icon: 'approval',
    },
    {
      id: 'budget',
      label: 'Ngân sách',
      shortLabel: 'Ngân sách',
      eyebrow: 'BUDGET POLICY',
      description: 'Cơ chế kiểm soát, carry-over và ngưỡng cảnh báo.',
      icon: 'budget',
    },
    {
      id: 'reimbursement',
      label: 'Hoàn tiền',
      shortLabel: 'Hoàn tiền',
      eyebrow: 'REIMBURSEMENT',
      description: 'Hạn mức yêu cầu hoàn và điều kiện bắt buộc chứng từ.',
      icon: 'reimbursement',
    },
    {
      id: 'notifications',
      label: 'Thông báo',
      shortLabel: 'Thông báo',
      eyebrow: 'NOTIFICATIONS',
      description: 'Email digest và tần suất tổng hợp cho quản trị viên.',
      icon: 'notifications',
    },
    {
      id: 'quota',
      label: 'Hạn mức',
      shortLabel: 'Hạn mức',
      eyebrow: 'PLAN LIMITS',
      description: 'Theo dõi nhanh quota workspace và cá nhân từ gói hiện tại.',
      icon: 'quota',
    },
  ];

  protected readonly workspaceName = computed(
    () =>
      this.settings()?.branding.companyDisplayName?.trim() ||
      this.workspaceState().workspace?.tenantName ||
      'Workspace',
  );

  protected readonly workspaceCode = computed(
    () => this.workspaceState().workspace?.tenantCode?.toUpperCase() ?? 'WORKSPACE',
  );

  protected readonly userEmail = computed(() => this.workspaceState().workspace?.email ?? '—');

  protected readonly brandInitial = computed(() => {
    const name = this.workspaceName().trim();
    return (name.charAt(0) || 'F').toUpperCase();
  });

  protected readonly activeTabConfig = computed(
    () => this.tabs.find((tab) => tab.id === this.activeTab()) ?? this.tabs[0],
  );

  protected readonly settingsSummaryCards = computed<SettingsSummaryCard[]>(() => {
    const settings = this.settings();
    const subscription = this.subscriptionData();

    return [
      {
        label: 'Workspace',
        value: this.workspaceName(),
        detail: `${this.workspaceCode()} · ${this.currentRole()}`,
        tone: 'blue',
      },
      {
        label: 'Phê duyệt',
        value: `${settings?.approvalPolicy.maxApprovalAgeHours ?? this.maxApprovalAgeHours()} giờ`,
        detail: settings?.approvalPolicy.requireDifferentApprover
          ? 'Bắt buộc khác người lập'
          : 'Cho phép tự duyệt',
        tone: settings?.approvalPolicy.requireDifferentApprover ? 'emerald' : 'amber',
      },
      {
        label: 'Ngân sách',
        value: settings?.budgetPolicy.defaultEnforcementMode ?? this.defaultEnforcementMode(),
        detail: `Cảnh báo ${settings?.budgetPolicy.warningThreshold1 ?? this.warningThreshold1()}% / ${settings?.budgetPolicy.warningThreshold2 ?? this.warningThreshold2()}%`,
        tone: 'amber',
      },
      {
        label: 'Gói hiện tại',
        value: subscription?.planTier ?? '—',
        detail: subscription
          ? `${this.formatNumber(subscription.usage.ocrPagesUsed)} / ${this.formatNumber(subscription.entitlements.workspaceMonthlyOcrPages)} trang · ${this.formatNumber(subscription.usage.chatbotMessagesUsed)} / ${this.formatNumber(subscription.entitlements.workspaceMonthlyChatbotMessages)} tin`
          : 'Chưa tải quota',
        tone: 'slate',
      },
    ];
  });

  protected readonly workflowSnapshot = computed(() => {
    const settings = this.settings();
    return [
      {
        label: 'Auto approve',
        value: this.formatMoney(settings?.approvalPolicy.autoApproveThreshold ?? this.autoApproveThreshold()),
      },
      {
        label: 'Escalation',
        value: this.formatMoney(settings?.approvalPolicy.escalationThreshold ?? this.escalationThreshold()),
      },
      {
        label: 'Receipt required',
        value: this.formatMoney(settings?.reimbursementPolicy.receiptRequiredAbove ?? this.receiptRequiredAbove()),
      },
      {
        label: 'Digest',
        value: this.digestFrequencyLabel(settings?.notificationPreferences.emailDigestFrequency ?? this.emailDigestFrequency()),
      },
    ];
  });

  constructor() {
    effect(() => {
      const tenantId = this.workspaceState().workspace?.tenantId;
      if (tenantId) {
        this.currentSubscriptionFacade.ensureLoaded(tenantId);
        this.loadSettings();
      } else {
        this.currentSubscriptionFacade.ensureLoaded(null);
      }
    });
  }

  protected setActiveTab(tab: SettingsTab): void {
    this.activeTab.set(tab);
    this.tabError.set(null);
    this.tabSuccess.set(null);
  }

  protected refresh(): void {
    this.currentSubscriptionFacade.refresh({ silent: true });
    this.loadSettings();
  }

  private loadSettings(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.settingsApi
      .getSettings()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (s) => {
          this.settings.set(s);
          this.hydrateForms(s);
          this.isLoading.set(false);
        },
        error: (err: Error) => {
          this.loadError.set(err.message);
          this.isLoading.set(false);
        },
      });
  }
  private hydrateForms(s: TenantSettingsResponse): void {
    this.companyDisplayName.set(s.branding.companyDisplayName ?? '');
    this.primaryColor.set(s.branding.primaryColor ?? '#4f46e5');
    this.logoUrl.set(s.branding.logoUrl ?? '');
    this.faviconUrl.set(s.branding.faviconUrl ?? '');
    this.locale.set(s.branding.locale);
    this.timezone.set(s.branding.timezone);

    this.autoApproveThreshold.set(s.approvalPolicy.autoApproveThreshold);
    this.escalationThreshold.set(s.approvalPolicy.escalationThreshold);
    this.escalationApproverRole.set(s.approvalPolicy.escalationApproverRole);
    this.requireDifferentApprover.set(s.approvalPolicy.requireDifferentApprover);
    this.maxApprovalAgeHours.set(s.approvalPolicy.maxApprovalAgeHours);
    this.isEscalationEnabled.set(s.approvalPolicy.isEscalationEnabled);

    this.defaultEnforcementMode.set(s.budgetPolicy.defaultEnforcementMode);
    this.defaultCarryOverPercent.set(s.budgetPolicy.defaultCarryOverPercent);
    this.warningThreshold1.set(s.budgetPolicy.warningThreshold1);
    this.warningThreshold2.set(s.budgetPolicy.warningThreshold2);

    this.maxClaimAmount.set(s.reimbursementPolicy.maxClaimAmount);
    this.receiptRequiredAbove.set(s.reimbursementPolicy.receiptRequiredAbove);

    this.emailDigestEnabled.set(s.notificationPreferences.emailDigestEnabled);
    this.emailDigestFrequency.set(s.notificationPreferences.emailDigestFrequency);
  }

  // ─── Save actions per tab ──────────────────────────────────────
  protected saveBranding(): void {
    if (!this.canEdit() || this.savingTab()) return;
    const input: UpdateBrandingInput = {
      logoUrl: this.logoUrl().trim() || null,
      faviconUrl: this.faviconUrl().trim() || null,
      primaryColor: this.primaryColor().trim() || null,
      companyDisplayName: this.companyDisplayName().trim() || null,
      locale: this.locale() || null,
      timezone: this.timezone() || null,
    };
    this.runSave('branding', this.settingsApi.updateBranding(input));
  }

  protected saveApproval(): void {
    if (!this.canEdit() || this.savingTab()) return;
    const input: UpdateApprovalPolicyInput = {
      autoApproveThreshold: this.autoApproveThreshold(),
      escalationThreshold: this.escalationThreshold(),
      escalationApproverRole: this.escalationApproverRole(),
      requireDifferentApprover: this.requireDifferentApprover(),
      maxApprovalAgeHours: this.maxApprovalAgeHours(),
      isEscalationEnabled: this.isEscalationEnabled(),
    };
    this.runSave('approval', this.settingsApi.updateApprovalPolicy(input));
  }

  protected saveBudget(): void {
    if (!this.canEdit() || this.savingTab()) return;
    const input: UpdateBudgetPolicyInput = {
      defaultEnforcementMode: this.defaultEnforcementMode(),
      defaultCarryOverPercent: this.defaultCarryOverPercent(),
      warningThreshold1: this.warningThreshold1(),
      warningThreshold2: this.warningThreshold2(),
    };
    this.runSave('budget', this.settingsApi.updateBudgetPolicy(input));
  }

  protected saveReimbursement(): void {
    if (!this.canEdit() || this.savingTab()) return;
    const input: UpdateReimbursementPolicyInput = {
      maxClaimAmount: this.maxClaimAmount(),
      receiptRequiredAbove: this.receiptRequiredAbove(),
    };
    this.runSave('reimbursement', this.settingsApi.updateReimbursementPolicy(input));
  }

  protected saveNotifications(): void {
    if (!this.canEdit() || this.savingTab()) return;
    const input: UpdateNotificationPreferencesInput = {
      emailDigestEnabled: this.emailDigestEnabled(),
      emailDigestFrequency: this.emailDigestFrequency(),
    };
    this.runSave('notifications', this.settingsApi.updateNotificationPreferences(input));
  }

  private runSave(
    tab: SettingsTab,
    obs: import('rxjs').Observable<TenantSettingsResponse>,
  ): void {
    this.savingTab.set(tab);
    this.tabError.set(null);
    this.tabSuccess.set(null);

    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (s) => {
        this.settings.set(s);
        this.hydrateForms(s);
        this.savingTab.set(null);
        this.tabSuccess.set({ tab, message: 'Đã lưu cấu hình.' });
      },
      error: (err: Error) => {
        this.tabError.set({ tab, message: err.message });
        this.savingTab.set(null);
      },
    });
  }

  // ─── Formatting helpers ────────────────────────────────────────
  protected formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 MB';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let i = 0;
    while (value >= 1024 && i < units.length - 1) { value /= 1024; i++; }
    return `${value.toFixed(value < 10 && i > 1 ? 2 : 1)} ${units[i]}`;
  }

  protected quotaPercent(used: number, limit: number): number {
    if (limit <= 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  protected quotaTone(used: number, limit: number): 'safe' | 'warning' | 'danger' | 'unlimited' {
    if (limit <= 0) return 'unlimited';
    const p = (used / limit) * 100;
    if (p >= 90) return 'danger';
    if (p >= 70) return 'warning';
    return 'safe';
  }

  protected formatMoney(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' ₫';
  }

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(Math.round(value));
  }

  protected digestFrequencyLabel(value: string): string {
    const match = this.digestFrequencies.find((frequency) => frequency.code === value);
    return match ? `Digest ${match.label.toLowerCase()}` : `Digest ${value}`;
  }

  protected formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
