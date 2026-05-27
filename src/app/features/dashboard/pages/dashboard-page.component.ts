import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CurrentWorkspaceFacade } from '../data/current-workspace.facade';
import {
  BudgetUtilizationResponse,
  ExpenseSummaryResponse,
  MonthlyTrendPointResponse,
  PendingPaymentItemResponse,
  ReportingApiService,
  TopVendorResponse,
} from '../../reporting/data/reporting-api.service';
import {
  NotificationDto,
  NotificationsApiService,
} from '../../notifications/data/notifications-api.service';
import {
  ApprovalQueuePageResponse,
  ApprovalsApiService,
  PendingApprovalItemResponse,
} from '../../approvals/data/approvals-api.service';
import { CurrentSubscriptionFacade } from '../../subscription/data/current-subscription.facade';

interface DashboardKpi {
  id:
    | 'total'
    | 'documents'
    | 'pendingApprovals'
    | 'operationalValue'
    | 'pendingPayments'
    | 'budgetWarn';
  label: string;
  value: string;
  hint?: string;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose';
  icon: 'money' | 'doc' | 'clock' | 'alert';
}

interface TrendBar {
  label: string;
  amount: number;
  documents: number;
  heightPercent: number;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard-page.component.html',
  styleUrl: './dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPageComponent implements OnInit {
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);
  private readonly reportingApi = inject(ReportingApiService);
  private readonly approvalsApi = inject(ApprovalsApiService);
  private readonly notificationsApi = inject(NotificationsApiService);
  private readonly currentSubscriptionFacade = inject(CurrentSubscriptionFacade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = this.currentWorkspaceFacade.state;
  protected readonly subscriptionState = this.currentSubscriptionFacade.state;

  // ─── Loading + data ─────────────────────────────────────────────
  protected readonly isLoading = signal(true);
  protected readonly hasError = signal(false);
  protected readonly loadWarnings = signal<string[]>([]);
  protected readonly summary = signal<ExpenseSummaryResponse | null>(null);
  protected readonly trend = signal<MonthlyTrendPointResponse[]>([]);
  protected readonly topVendors = signal<TopVendorResponse[]>([]);
  protected readonly approvalQueue = signal<ApprovalQueuePageResponse | null>(null);
  protected readonly pending = signal<PendingPaymentItemResponse[]>([]);
  protected readonly budgets = signal<BudgetUtilizationResponse[]>([]);
  protected readonly recentNotifications = signal<NotificationDto[]>([]);

  // ─── Role detection ────────────────────────────────────────────
  protected readonly currentRole = computed(() => {
    const raw = (this.state().workspace?.role ?? '').toString();
    const normalized = raw.replace(/[\s_-]+/g, '').toLowerCase();
    if (normalized.includes('superadmin')) return 'SuperAdmin';
    if (normalized.includes('tenantadmin') || normalized.includes('owner')) return 'TenantAdmin';
    if (normalized.includes('accountant')) return 'Accountant';
    if (normalized.includes('manager')) return 'Manager';
    if (normalized.includes('staff') || normalized.includes('employee')) return 'Staff';
    return 'Other';
  });

  protected readonly canViewReports = computed(() => {
    const r = this.currentRole();
    return r === 'TenantAdmin' || r === 'Accountant' || r === 'Manager' || r === 'SuperAdmin';
  });

  protected readonly canViewPaymentQueue = computed(() => {
    const r = this.currentRole();
    return r === 'TenantAdmin' || r === 'Accountant' || r === 'SuperAdmin';
  });

  protected readonly canViewApprovalQueue = computed(() => {
    const r = this.currentRole();
    return r === 'TenantAdmin' || r === 'Manager' || r === 'SuperAdmin';
  });

  protected readonly canUploadWithOcr = computed(
    () => this.subscriptionState().subscription?.entitlements.documentsOcrEnabled ?? false,
  );

  protected readonly canUseChatbot = computed(
    () => this.subscriptionState().subscription?.entitlements.chatbotEnabled ?? false,
  );

  protected readonly userDisplayName = computed(() => {
    const email = this.state().workspace?.email ?? '';
    if (!email) return 'bạn';
    const local = email.split('@')[0] ?? email;
    return local.replace(/[._-]+/g, ' ');
  });

  protected readonly tenantName = computed(
    () => this.state().workspace?.tenantName ?? 'Workspace',
  );

  protected readonly pendingApprovalItems = computed(() => this.approvalQueue()?.items ?? []);
  protected readonly pendingApprovalCount = computed(
    () => this.approvalQueue()?.totalCount ?? this.pendingApprovalItems().length,
  );
  protected readonly pendingApprovalTotal = computed(() =>
    this.pendingApprovalItems().reduce((sum, item) => sum + item.amount, 0),
  );
  protected readonly pendingApprovalCurrency = computed(() => {
    const firstCurrency = this.pendingApprovalItems()[0]?.currency;
    if (!firstCurrency) return this.summary()?.baseCurrencyCode ?? 'VND';

    return this.pendingApprovalItems().every((item) => item.currency === firstCurrency)
      ? firstCurrency
      : this.summary()?.baseCurrencyCode ?? firstCurrency;
  });

  // ─── KPIs ───────────────────────────────────────────────────────
  protected readonly kpis = computed<DashboardKpi[]>(() => {
    const sum = this.summary();
    const cards: DashboardKpi[] = [];

    if (sum) {
      cards.push({
        id: 'total',
        label: 'Tổng chi tháng này',
        value: this.formatMoney(sum.totalInBaseCurrency),
        hint: `${sum.expenseCount} chứng từ`,
        tone: 'indigo',
        icon: 'money',
      });
      cards.push({
        id: 'documents',
        label: 'Chứng từ đã ghi nhận',
        value: this.formatNumber(sum.expenseCount),
        hint: 'Trong kỳ tháng hiện tại',
        tone: 'emerald',
        icon: 'doc',
      });
    }

    if (this.canViewApprovalQueue()) {
      cards.push({
        id: 'pendingApprovals',
        label: 'Chứng từ chờ duyệt',
        value: this.formatNumber(this.pendingApprovalCount()),
        hint:
          this.pendingApprovalCount() > 0
            ? 'Dữ liệu thật từ hàng đợi phê duyệt'
            : 'Không có chứng từ chờ xử lý',
        tone: this.pendingApprovalCount() > 0 ? 'amber' : 'emerald',
        icon: 'doc',
      });
      cards.push({
        id: 'operationalValue',
        label: 'Giá trị đang xử lý',
        value: this.formatCurrency(this.pendingApprovalTotal(), this.pendingApprovalCurrency()),
        hint: `${this.pendingApprovalItems().length} mục mới nhất`,
        tone: 'indigo',
        icon: 'money',
      });
    }

    if (this.canViewPaymentQueue()) {
      cards.push({
        id: 'pendingPayments',
        label: 'Đang chờ thanh toán',
        value: this.formatNumber(this.pending().length),
        hint:
          this.pending().length > 0
            ? `Cũ nhất: ${this.pending()[0]?.ageDays ?? 0} ngày`
            : 'Hàng đợi sạch',
        tone: 'amber',
        icon: 'clock',
      });
    }

    const overBudget = this.budgets().filter((b) => b.isOverBudget || b.isApproachingLimit);
    if (this.canViewReports()) {
      cards.push({
        id: 'budgetWarn',
        label: 'Phòng ban cần chú ý',
        value: this.formatNumber(overBudget.length),
        hint:
          overBudget.length > 0
            ? `${overBudget.filter((b) => b.isOverBudget).length} đã vượt`
            : 'Tất cả trong ngưỡng an toàn',
        tone: overBudget.length > 0 ? 'rose' : 'emerald',
        icon: 'alert',
      });
    }

    return cards;
  });

  protected readonly trendBars = computed<TrendBar[]>(() => {
    const points = this.trend();
    if (!points.length) return [];
    const max = Math.max(...points.map((p) => p.expenseTotal), 1);
    return points.map((p) => ({
      label: this.shortMonth(p.year, p.month),
      amount: p.expenseTotal,
      documents: p.documentCount,
      heightPercent: Math.max(4, Math.round((p.expenseTotal / max) * 100)),
    }));
  });

  protected readonly topBudgets = computed(() =>
    [...this.budgets()].sort((a, b) => b.utilizationPercent - a.utilizationPercent).slice(0, 5),
  );

  constructor() {
    effect(() => {
      const tenantId = this.state().workspace?.tenantId;
      if (tenantId) {
        this.currentSubscriptionFacade.ensureLoaded(tenantId);
        this.loadAll();
      }
    });
  }

  ngOnInit(): void {
    this.currentWorkspaceFacade.refresh();
  }

  protected loadAll(): void {
    this.isLoading.set(true);
    this.hasError.set(false);
    this.loadWarnings.set([]);

    const today = new Date();
    const fromDate = this.toIso(new Date(today.getFullYear(), today.getMonth(), 1));
    const toDate = this.toIso(today);
    const month = today.getMonth() + 1;
    const year = today.getFullYear();

    forkJoin({
      summary: this.canViewReports()
        ? this.reportingApi.expenseSummary({ from: fromDate, to: toDate }).pipe(
            catchError(() => {
              this.addLoadWarning('Không tải được tổng quan chi tiêu.');
              return of(null as ExpenseSummaryResponse | null);
            }),
          )
        : of(null as ExpenseSummaryResponse | null),
      trend: this.canViewReports()
        ? this.reportingApi
            .monthlyTrend(6)
            .pipe(
              catchError(() => {
                this.addLoadWarning('Không tải được xu hướng chi tiêu.');
                return of([] as MonthlyTrendPointResponse[]);
              }),
            )
        : of([] as MonthlyTrendPointResponse[]),
      vendors: this.canViewReports()
        ? this.reportingApi
            .topVendors(fromDate, toDate, 5)
            .pipe(
              catchError(() => {
                this.addLoadWarning('Không tải được top nhà cung cấp.');
                return of([] as TopVendorResponse[]);
              }),
            )
        : of([] as TopVendorResponse[]),
      approvals: this.canViewApprovalQueue()
        ? this.approvalsApi.getApprovalQueue('PENDING', null, 1, 5).pipe(
            catchError(() => {
              this.addLoadWarning('Không tải được hàng đợi phê duyệt.');
              return of(this.emptyApprovalQueue());
            }),
          )
        : of(this.emptyApprovalQueue()),
      pending: this.canViewPaymentQueue()
        ? this.reportingApi
            .pendingPaymentQueue()
            .pipe(
              catchError(() => {
                this.addLoadWarning('Không tải được hàng đợi thanh toán.');
                return of([] as PendingPaymentItemResponse[]);
              }),
            )
        : of([] as PendingPaymentItemResponse[]),
      budgets: this.canViewReports()
        ? this.reportingApi
            .budgetUtilization(month, year)
            .pipe(
              catchError(() => {
                this.addLoadWarning('Không tải được dữ liệu ngân sách.');
                return of([] as BudgetUtilizationResponse[]);
              }),
            )
        : of([] as BudgetUtilizationResponse[]),
      notifications: this.notificationsApi
        .getMyNotifications(false, 6)
        .pipe(
          catchError(() => {
            this.addLoadWarning('Không tải được hoạt động gần đây.');
            return of([] as NotificationDto[]);
          }),
        ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.summary.set(data.summary);
          this.trend.set(data.trend);
          this.topVendors.set(data.vendors);
          this.approvalQueue.set(data.approvals);
          this.pending.set(data.pending);
          this.budgets.set(data.budgets);
          this.recentNotifications.set(data.notifications);
          this.isLoading.set(false);
        },
        error: () => {
          this.hasError.set(true);
          this.isLoading.set(false);
        },
      });
  }

  // ─── Formatting helpers ─────────────────────────────────────────
  protected formatMoney(value: number): string {
    if (!isFinite(value)) return '—';
    const code = this.summary()?.baseCurrencyCode ?? 'VND';
    return this.formatCurrency(value, code);
  }

  protected formatCurrency(value: number, code = 'VND'): string {
    if (!isFinite(value)) return '—';
    if (code === 'VND') {
      return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' ₫';
    }
    return (
      new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
        value,
      ) +
      ' ' +
      code
    );
  }

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.floor(value)));
  }

  protected formatPercent(value: number): string {
    if (!isFinite(value)) return '—';
    return Math.round(value).toString() + '%';
  }

  protected severityDotClass(severity: string | null | undefined): string {
    const s = (severity ?? '').toLowerCase();
    if (s.includes('error') || s.includes('critical')) return 'bg-rose-500';
    if (s.includes('warn')) return 'bg-amber-500';
    if (s.includes('success')) return 'bg-emerald-500';
    return 'bg-indigo-500';
  }

  protected formatRelativeTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const diff = Math.floor((Date.now() - d.getTime()) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  protected formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  protected statusLabel(status: string | null | undefined): string {
    const normalized = (status ?? '').replace(/[\s_-]+/g, '').toLowerCase();
    if (normalized.includes('readyforapproval') || normalized.includes('pending')) {
      return 'Chờ phê duyệt';
    }
    if (normalized.includes('approved')) return 'Đã duyệt';
    if (normalized.includes('rejected')) return 'Từ chối';
    return status?.trim() || 'Không rõ';
  }

  private toIso(d: Date): string {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private shortMonth(year: number, month: number): string {
    return `T${month.toString().padStart(2, '0')}/${String(year).slice(-2)}`;
  }

  private addLoadWarning(message: string): void {
    this.loadWarnings.update((warnings) => [...warnings, message]);
  }

  private emptyApprovalQueue(): ApprovalQueuePageResponse {
    return {
      items: [],
      page: 1,
      pageSize: 5,
      totalCount: 0,
      totalPages: 1,
    };
  }
}
