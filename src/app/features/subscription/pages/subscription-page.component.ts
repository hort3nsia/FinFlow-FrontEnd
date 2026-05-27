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
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import {
  MembersApiService,
  WorkspaceMemberResponse,
} from '../../members/data/members-api.service';
import {
  CurrentSubscriptionResponse,
  SubscriptionApiService,
} from '../data/subscription-api.service';
import { CurrentSubscriptionFacade } from '../data/current-subscription.facade';

type RoleType =
  | 'TenantAdmin'
  | 'Accountant'
  | 'Manager'
  | 'Staff'
  | 'SuperAdmin'
  | 'Unknown';

type UpgradePlanTier = 'Pro' | 'Enterprise';

interface QuotaCard {
  id: 'ocr' | 'chatbot' | 'storage' | 'memberOcr' | 'memberChat';
  title: string;
  used: number;
  limit: number;
  unit: string;
  percent: number;
  tone: 'safe' | 'warning' | 'danger' | 'unlimited';
  description: string;
  detail?: string;
}

interface MemberQuotaRow {
  id: string;
  name: string;
  email: string;
  initials: string;
  department: string;
  roleLabel: string;
  ocrUsed: number | null;
  ocrLimit: number;
  ocrPercent: number | null;
  chatUsed: number | null;
  chatLimit: number;
  chatPercent: number | null;
  status: 'ok' | 'warn' | 'danger' | 'unknown';
  statusLabel: string;
  isCurrentUser: boolean;
}

interface PlanFeatureRow {
  feature: string;
  free: string;
  pro: string;
  business: string;
  highlight?: boolean;
}

const PLAN_FEATURE_MATRIX: PlanFeatureRow[] = [
  {
    feature: 'Số trang OCR / tháng (toàn workspace)',
    free: '50 trang',
    pro: '500 trang',
    business: '2.000 trang',
    highlight: true,
  },
  {
    feature: 'Số tin nhắn AI / tháng (toàn workspace)',
    free: '50',
    pro: '1.000',
    business: '5.000',
  },
  {
    feature: 'Hạn mức cá nhân / tháng',
    free: 'Không cấp riêng',
    pro: '100 trang OCR · 200 tin AI',
    business: '300 trang OCR · 800 tin AI',
  },
  {
    feature: 'Lưu trữ tài liệu',
    free: '500 MB',
    pro: '10 GB',
    business: '50 GB',
  },
  {
    feature: 'Nhập chi phí thủ công',
    free: '✓',
    pro: '✓',
    business: '✓',
  },
  {
    feature: 'OCR + tự động hoá tài liệu',
    free: '✗',
    pro: '✓',
    business: '✓',
  },
  {
    feature: 'Trợ lý AI tài chính (chat + RAG)',
    free: '✗',
    pro: '✓',
    business: '✓',
  },
  {
    feature: 'Phân quyền + workflow phê duyệt',
    free: 'Cơ bản',
    pro: 'Đầy đủ',
    business: 'Đầy đủ + chữ ký số',
  },
  {
    feature: 'Báo cáo & phân tích nâng cao',
    free: '✗',
    pro: '✓',
    business: '✓',
  },
  {
    feature: 'Hỗ trợ',
    free: 'Email',
    pro: 'Email + Chat',
    business: 'Hỗ trợ ưu tiên 24/7',
  },
];

@Component({
  selector: 'app-subscription-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription-page.component.html',
  styleUrl: './subscription-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SubscriptionPageComponent {
  private readonly subscriptionApi = inject(SubscriptionApiService);
  private readonly currentSubscriptionFacade = inject(CurrentSubscriptionFacade);
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);
  private readonly membersApi = inject(MembersApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly workspaceState = this.currentWorkspaceFacade.state;
  protected readonly subscriptionState = this.currentSubscriptionFacade.state;
  protected readonly isLoading = computed(() => this.subscriptionState().loading);
  protected readonly loadError = computed(() => this.subscriptionState().error);
  protected readonly subscription = computed<CurrentSubscriptionResponse | null>(
    () => this.subscriptionState().subscription,
  );

  protected readonly isCancelDialogOpen = signal(false);
  protected readonly isUpgradeDialogOpen = signal(false);
  protected readonly isCancelling = signal(false);
  protected readonly cancelError = signal<string | null>(null);
  protected readonly cancelSuccess = signal<string | null>(null);
  protected readonly upgradeError = signal<string | null>(null);
  protected readonly upgradeSuccess = signal<string | null>(null);
  protected readonly upgradingPlan = signal<string | null>(null);
  protected readonly upgradeDialogTargetPlan = signal<UpgradePlanTier>('Pro');
  protected readonly memberRowsSignal = signal<WorkspaceMemberResponse[]>([]);
  protected readonly memberLoading = signal(false);
  protected readonly memberLoadError = signal<string | null>(null);
  protected readonly memberDepartmentFilter = signal('all');
  protected readonly memberSort = signal<'usage' | 'name'>('usage');
  protected readonly memberSearch = signal('');

  protected readonly planFeatureMatrix = PLAN_FEATURE_MATRIX;

  // ─── Role detection ───────────────────────────────────────────
  protected readonly currentRole = computed<RoleType>(() => {
    const raw = (this.workspaceState().workspace?.role ?? '').toString();
    const normalized = raw.replace(/[\s_-]+/g, '').toLowerCase();
    if (normalized.includes('superadmin')) return 'SuperAdmin';
    if (normalized.includes('tenantadmin') || normalized.includes('owner')) return 'TenantAdmin';
    if (normalized.includes('accountant')) return 'Accountant';
    if (normalized.includes('manager')) return 'Manager';
    if (normalized.includes('staff') || normalized.includes('employee')) return 'Staff';
    return 'Unknown';
  });

  protected readonly canManageBilling = computed(
    () => this.currentRole() === 'TenantAdmin' || this.currentRole() === 'SuperAdmin',
  );

  protected readonly showWorkspaceQuota = computed(
    () =>
      this.currentRole() === 'TenantAdmin' ||
      this.currentRole() === 'Accountant' ||
      this.currentRole() === 'SuperAdmin',
  );

  protected readonly canSeeMemberTable = computed(
    () =>
      this.currentRole() === 'TenantAdmin' ||
      this.currentRole() === 'Accountant' ||
      this.currentRole() === 'SuperAdmin',
  );

  // ─── Plan formatting ──────────────────────────────────────────
  protected readonly planTier = computed(
    () => this.subscription()?.planTier?.toString() ?? 'Free',
  );

  protected readonly planTierLabel = computed(() => {
    const tier = this.planTier().toLowerCase();
    if (tier.includes('business') || tier.includes('enterprise')) return 'Business';
    if (tier.includes('pro')) return 'Pro';
    return 'Free';
  });

  protected readonly isFreePlan = computed(() => this.planTierLabel() === 'Free');

  protected readonly planTierVietnamese = computed(() => {
    switch (this.planTierLabel()) {
      case 'Business':
        return 'Doanh nghiệp';
      case 'Pro':
        return 'Pro – Doanh nghiệp vừa & nhỏ';
      default:
        return 'Miễn phí – Khởi đầu';
    }
  });

  protected readonly planStatusLabel = computed(() => {
    const status = (this.subscription()?.status ?? '').toString().toLowerCase();
    if (status.includes('active')) return { label: 'Đang hoạt động', tone: 'safe' };
    if (status.includes('pastdue')) return { label: 'Quá hạn thanh toán', tone: 'warning' };
    if (status.includes('expired')) return { label: 'Đã hết hạn', tone: 'danger' };
    if (status.includes('cancelled') || status.includes('canceled'))
      return { label: 'Đã huỷ', tone: 'danger' };
    return { label: this.subscription()?.status ?? '—', tone: 'safe' };
  });

  protected readonly canUpgrade = computed(
    () => this.planTierLabel() !== 'Business' && this.canManageBilling(),
  );

  protected readonly isSubscriptionCancelled = computed(() => {
    const status = (this.subscription()?.status ?? '').toString().toLowerCase();
    return status.includes('cancelled') || status.includes('canceled');
  });

  protected readonly canCancelPlan = computed(
    () => this.canManageBilling() && this.planTierLabel() !== 'Free' && !this.isSubscriptionCancelled(),
  );

  protected readonly nextRecommendedPlan = computed<UpgradePlanTier>(() =>
    this.planTierLabel() === 'Free' ? 'Pro' : 'Enterprise',
  );

  protected readonly planMonthlyPrice = computed(() => {
    switch (this.planTierLabel()) {
      case 'Business':
        return '5.000.000 ₫/tháng';
      case 'Pro':
        return '1.500.000 ₫/tháng';
      default:
        return 'Miễn phí';
    }
  });

  protected readonly nextRenewalLabel = computed(() => {
    const end = this.subscription()?.currentPeriodEnd;
    if (!end) return '—';
    return new Date(end).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  });

  protected readonly periodCardTitle = computed(() =>
    this.isFreePlan() ? 'Kỳ sử dụng' : 'Kỳ hiện tại',
  );

  protected readonly periodCardHint = computed(() =>
    this.isFreePlan()
      ? `Reset hạn mức vào ${this.nextRenewalLabel()}`
      : `Tự động gia hạn vào ${this.nextRenewalLabel()}`,
  );

  protected readonly billingCardHint = computed(() =>
    this.isFreePlan() ? 'Không phát sinh thanh toán' : 'Theo chu kỳ workspace',
  );

  protected readonly workspaceQuotaResetHint = computed(() =>
    this.isFreePlan()
      ? `Tổng cho toàn bộ workspace · Reset hạn mức vào ${this.nextRenewalLabel()}`
      : `Tổng cho toàn bộ workspace · Reset vào ${this.nextRenewalLabel()}`,
  );

  protected readonly periodRangeLabel = computed(() => {
    const sub = this.subscription();
    if (!sub) return '—';
    const start = new Date(sub.currentPeriodStart);
    const end = new Date(sub.currentPeriodEnd);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return '—';
    const fmt = (d: Date) =>
      d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${fmt(start)} → ${fmt(end)}`;
  });

  // ─── Quota cards (visible based on role) ───────────────────────
  protected readonly workspaceQuotaCards = computed<QuotaCard[]>(() => {
    const sub = this.subscription();
    if (!sub) return [];

    const cards: QuotaCard[] = [];

    if (this.showWorkspaceQuota()) {
      cards.push(
        this.toQuotaCard(
          'ocr',
          'OCR Pages',
          sub.usage.ocrPagesUsed,
          sub.entitlements.workspaceMonthlyOcrPages,
          'trang',
          `${this.remainingText(sub.entitlements.workspaceMonthlyOcrPages - sub.usage.ocrPagesUsed, 'trang')} còn lại`,
          'Tổng số trang đã quét OCR trong kỳ này',
        ),
        this.toQuotaCard(
          'chatbot',
          'Chatbot Messages',
          sub.usage.chatbotMessagesUsed,
          sub.entitlements.workspaceMonthlyChatbotMessages,
          'tin nhắn',
          `${this.remainingText(
            sub.entitlements.workspaceMonthlyChatbotMessages - sub.usage.chatbotMessagesUsed,
            'tin nhắn',
          )} còn lại`,
          'Tổng số tin nhắn trợ lý AI đã dùng',
        ),
        this.toStorageCard(sub.usage.storageUsedBytes, sub.entitlements.storageLimitBytes),
      );
    }

    return cards;
  });

  protected readonly personalQuotaCards = computed<QuotaCard[]>(() => {
    const sub = this.subscription();
    if (!sub) return [];
    const cards: QuotaCard[] = [];

    if (sub.entitlements.memberMonthlyOcrPages > 0) {
      cards.push(
        this.toQuotaCard(
          'memberOcr',
          'OCR cá nhân – Tháng này',
          sub.currentMemberUsage.ocrPagesUsed,
          sub.entitlements.memberMonthlyOcrPages,
          'trang',
          `Còn lại ${this.formatNumber(sub.currentMemberUsage.remainingOcrPages)} trang`,
        ),
      );
    }
    if (sub.entitlements.memberMonthlyChatbotMessages > 0) {
      cards.push(
        this.toQuotaCard(
          'memberChat',
          'Tin AI cá nhân – Tháng này',
          sub.currentMemberUsage.chatbotMessagesUsed,
          sub.entitlements.memberMonthlyChatbotMessages,
          'tin nhắn',
          `Còn lại ${this.formatNumber(sub.currentMemberUsage.remainingChatbotMessages)} tin`,
        ),
      );
    }

    // For Staff/Manager who don't get workspace cards but have no member quota,
    // show a hint card for clarity.
    if (cards.length === 0) {
      cards.push({
        id: 'memberOcr',
        title: 'Hạn mức cá nhân',
        used: 0,
        limit: 0,
        unit: '',
        percent: 0,
        tone: 'unlimited',
        description: 'Gói hiện tại không cấp hạn mức riêng cho thành viên.',
      });
    }

    return cards;
  });

  protected readonly departments = computed(() => {
    const names = new Set<string>();
    for (const member of this.memberRowsSignal()) {
      const name = member.departmentName?.trim();
      if (name) names.add(name);
    }
    return [...names].sort((left, right) => left.localeCompare(right, 'vi'));
  });

  protected readonly memberQuotaRows = computed<MemberQuotaRow[]>(() => {
    const sub = this.subscription();
    const workspace = this.workspaceState().workspace;
    if (!sub || !workspace) return [];

    const rows = this.memberRowsSignal().map((member) =>
      this.mapMemberQuotaRow(member, workspace.membershipId, sub),
    );
    const dept = this.memberDepartmentFilter();
    const query = this.memberSearch().trim().toLowerCase();

    let filtered = rows.filter((row) => {
      const matchesDepartment = dept === 'all' || row.department === dept;
      const matchesSearch =
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.email.toLowerCase().includes(query);
      return matchesDepartment && matchesSearch;
    });

    filtered = [...filtered].sort((left, right) => {
      if (this.memberSort() === 'name') {
        return left.name.localeCompare(right.name, 'vi');
      }
      return this.rowUsageScore(right) - this.rowUsageScore(left);
    });

    return filtered;
  });

  protected readonly hasMemberTelemetryGap = computed(() =>
    this.memberQuotaRows().some((row) => !row.isCurrentUser),
  );

  constructor() {
    effect(() => {
      const tenantId = this.workspaceState().workspace?.tenantId;
      this.currentSubscriptionFacade.ensureLoaded(tenantId ?? null);
      if (tenantId && this.canSeeMemberTable()) {
        this.loadWorkspaceMembers(tenantId);
      } else {
        this.memberRowsSignal.set([]);
      }
    });
  }

  protected refresh(): void {
    this.cancelSuccess.set(null);
    this.currentSubscriptionFacade.refresh();
  }

  protected openCancelDialog(): void {
    if (!this.canCancelPlan()) return;
    this.cancelError.set(null);
    this.isCancelDialogOpen.set(true);
  }

  protected openUpgradeDialog(targetPlan: UpgradePlanTier = this.nextRecommendedPlan()): void {
    this.upgradeError.set(null);
    this.upgradeSuccess.set(null);
    this.upgradeDialogTargetPlan.set(targetPlan);
    this.isUpgradeDialogOpen.set(true);
  }

  protected closeUpgradeDialog(): void {
    this.isUpgradeDialogOpen.set(false);
  }

  protected closeCancelDialog(): void {
    this.isCancelDialogOpen.set(false);
  }

  protected confirmCancel(): void {
    if (this.isCancelling() || !this.canCancelPlan()) return;
    this.isCancelling.set(true);
    this.cancelError.set(null);

    this.subscriptionApi
      .cancelSubscription()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.isCancelling.set(false);
          this.isCancelDialogOpen.set(false);
          this.cancelSuccess.set(
            result.message ??
              'Đã huỷ gói. Bạn vẫn dùng được đến hết kỳ hiện tại.',
          );
          this.refresh();
        },
        error: (err: Error) => {
          this.cancelError.set(err.message);
          this.isCancelling.set(false);
        },
      });
  }

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.floor(value)));
  }

  protected formatBytes(bytes: number): string {
    if (!bytes || bytes <= 0) return '0 MB';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let value = bytes;
    let unitIdx = 0;
    while (value >= 1024 && unitIdx < units.length - 1) {
      value /= 1024;
      unitIdx++;
    }
    return `${value.toFixed(value < 10 && unitIdx > 1 ? 2 : 1)} ${units[unitIdx]}`;
  }

  protected setMemberSearch(value: string): void {
    this.memberSearch.set(value);
  }

  protected formatQuotaUsed(value: number | null, limit: number): string {
    if (value === null) return '—';
    return `${this.formatNumber(value)}/${this.formatNumber(limit)}`;
  }

  // ─── Helpers ───────────────────────────────────────────────────
  private toQuotaCard(
    id: QuotaCard['id'],
    title: string,
    used: number,
    limit: number,
    unit: string,
    description: string,
    detail?: string,
  ): QuotaCard {
    if (limit <= 0) {
      return {
        id,
        title,
        used,
        limit,
        unit,
        percent: 0,
        tone: 'unlimited',
        description,
        detail,
      };
    }
    const percent = Math.min(100, Math.round((used / limit) * 100));
    let tone: QuotaCard['tone'] = 'safe';
    if (percent >= 90) tone = 'danger';
    else if (percent >= 70) tone = 'warning';
    return { id, title, used, limit, unit, percent, tone, description, detail };
  }

  private toStorageCard(usedBytes: number, limitBytes: number): QuotaCard {
    const percent =
      limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;
    let tone: QuotaCard['tone'] = limitBytes <= 0 ? 'unlimited' : 'safe';
    if (limitBytes > 0) {
      if (percent >= 90) tone = 'danger';
      else if (percent >= 70) tone = 'warning';
    }
    return {
      id: 'storage',
      title: 'Storage',
      used: usedBytes,
      limit: limitBytes,
      unit: 'bytes',
      percent,
      tone,
      description:
        limitBytes > 0
          ? `${this.formatBytes(Math.max(0, limitBytes - usedBytes))} còn lại`
          : 'Không giới hạn',
      detail: `${this.formatBytes(usedBytes)} / ${this.formatBytes(limitBytes)}`,
    };
  }

  private loadWorkspaceMembers(tenantId: string): void {
    this.memberLoading.set(true);
    this.memberLoadError.set(null);

    this.membersApi
      .getWorkspaceMembers(tenantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members) => {
          this.memberRowsSignal.set(members);
          this.memberLoading.set(false);
        },
        error: (error: Error) => {
          this.memberRowsSignal.set([]);
          this.memberLoadError.set(error.message);
          this.memberLoading.set(false);
        },
      });
  }

  protected changePlan(planTier: UpgradePlanTier): void {
    if (this.upgradingPlan()) return;

    this.upgradingPlan.set(planTier);
    this.upgradeError.set(null);
    this.upgradeSuccess.set(null);

    this.subscriptionApi
      .changePlan(planTier)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (result) => {
          this.upgradingPlan.set(null);
          this.upgradeSuccess.set(result.message ?? 'Đã cập nhật gói thành công.');
          this.closeUpgradeDialog();
          this.currentSubscriptionFacade.refresh();
        },
        error: (err: Error) => {
          this.upgradeError.set(err.message);
          this.upgradingPlan.set(null);
        },
      });
  }

  private mapMemberQuotaRow(
    member: WorkspaceMemberResponse,
    currentMembershipId: string,
    sub: CurrentSubscriptionResponse,
  ): MemberQuotaRow {
    const isCurrentUser = member.id === currentMembershipId;
    const ocrUsed = isCurrentUser ? sub.currentMemberUsage.ocrPagesUsed : null;
    const chatUsed = isCurrentUser ? sub.currentMemberUsage.chatbotMessagesUsed : null;
    const ocrLimit = sub.entitlements.memberMonthlyOcrPages;
    const chatLimit = sub.entitlements.memberMonthlyChatbotMessages;
    const ocrPercent = ocrUsed === null || ocrLimit <= 0 ? null : Math.min(100, Math.round((ocrUsed / ocrLimit) * 100));
    const chatPercent = chatUsed === null || chatLimit <= 0 ? null : Math.min(100, Math.round((chatUsed / chatLimit) * 100));
    const worst = Math.max(ocrPercent ?? 0, chatPercent ?? 0);
    const status =
      !isCurrentUser ? 'unknown' : worst >= 90 ? 'danger' : worst >= 70 ? 'warn' : 'ok';

    return {
      id: member.id,
      name: member.fullName?.trim() || this.formatDisplayName(member.email, member.id),
      email: member.email?.trim() || 'Chưa có email',
      initials: this.formatInitials(member.fullName?.trim() || member.email || member.id),
      department: member.departmentName?.trim() || 'Chưa gán',
      roleLabel: this.formatRole(member.role),
      ocrUsed,
      ocrLimit,
      ocrPercent,
      chatUsed,
      chatLimit,
      chatPercent,
      status,
      statusLabel:
        status === 'danger'
          ? 'Nguy hiểm'
          : status === 'warn'
            ? 'Cảnh báo'
            : status === 'ok'
              ? 'Bình thường'
              : 'Chưa có telemetry usage',
      isCurrentUser,
    };
  }

  private rowUsageScore(row: MemberQuotaRow): number {
    return Math.max(row.ocrPercent ?? -1, row.chatPercent ?? -1);
  }

  private remainingText(value: number, unit: string): string {
    return `${this.formatNumber(Math.max(0, value))} ${unit}`;
  }

  private formatDisplayName(email: string | null, id: string): string {
    const localPart = email?.split('@')[0]?.trim();
    return localPart || `Member ${id.slice(0, 8)}`;
  }

  private formatInitials(value: string): string {
    const words = value
      .replace(/@.*/, '')
      .split(/[\s._-]+/)
      .filter(Boolean);
    const initials = words.slice(0, 3).map((word) => word[0]?.toUpperCase()).join('');
    return initials || 'MB';
  }

  private formatRole(role: string): string {
    const normalized = role.replace(/[\s_-]+/g, '').toLowerCase();
    if (normalized.includes('tenantadmin') || normalized.includes('owner')) return 'Quản trị';
    if (normalized.includes('accountant')) return 'Kế toán';
    if (normalized.includes('manager')) return 'Quản lý';
    if (normalized.includes('staff') || normalized.includes('employee')) return 'Nhân viên';
    return role || 'Không rõ';
  }
}
