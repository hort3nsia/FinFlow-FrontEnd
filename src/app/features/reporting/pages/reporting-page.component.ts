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
import { Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { toUserFacingError } from '../../../core/errors/user-facing-error.util';
import {
  ApprovalQueuePageResponse,
  ApprovalsApiService,
} from '../../approvals/data/approvals-api.service';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import {
  BudgetUtilizationResponse,
  ExpenseSummaryGroup,
  ExpenseSummaryResponse,
  MonthlyTrendPointResponse,
  PendingPaymentItemResponse,
  ReportingApiService,
  TopEmployeeResponse,
} from '../data/reporting-api.service';

type RoleType = 'TenantAdmin' | 'Accountant' | 'Manager' | 'Staff' | 'SuperAdmin' | 'Unknown';
type PresetRange = 'thisWeek' | 'thisMonth' | 'lastMonth' | 'thisQuarter' | 'thisYear' | 'custom';
type KpiTone = 'default' | 'green' | 'amber' | 'red';

interface PeriodKpi {
  id: 'total' | 'pendingApprovals' | 'avg' | 'budgetHealth';
  label: string;
  value: string;
  hint: string;
  tone: KpiTone;
}

interface TrendBar {
  label: string;
  amount: number;
  documents: number;
  heightPercent: number;
}

interface TrendSvgPoint extends TrendBar {
  x: number;
  y: number;
}

interface PendingReimbursementRow {
  id: string;
  employee: string;
  code: string;
  department: string;
  amount: number;
  currencyCode: string;
  approvedAt: string;
  ageDays: number;
  actionLabel: string;
}

@Component({
  selector: 'app-reporting-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reporting-page.component.html',
  styleUrl: './reporting-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportingPageComponent {
  private readonly reportingApi = inject(ReportingApiService);
  private readonly approvalsApi = inject(ApprovalsApiService);
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly workspaceState = this.currentWorkspaceFacade.state;

  protected readonly preset = signal<PresetRange>('thisMonth');
  protected readonly fromDate = signal(this.firstDayOfThisMonth());
  protected readonly toDate = signal(this.todayIso());
  protected readonly selectedDepartmentLabel = signal('Tất cả phòng ban');
  protected readonly selectedDepartmentId = signal<string | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly loadWarnings = signal<string[]>([]);
  protected readonly exportedAt = signal<string>('');

  protected readonly summary = signal<ExpenseSummaryResponse | null>(null);
  protected readonly budgets = signal<BudgetUtilizationResponse[]>([]);
  protected readonly topEmployees = signal<TopEmployeeResponse[]>([]);
  protected readonly pendingPayments = signal<PendingPaymentItemResponse[]>([]);
  protected readonly monthlyTrend = signal<MonthlyTrendPointResponse[]>([]);
  protected readonly approvalQueue = signal<ApprovalQueuePageResponse | null>(null);

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

  protected readonly canViewReports = computed(() => {
    const role = this.currentRole();
    return role === 'TenantAdmin' || role === 'Accountant' || role === 'Manager' || role === 'SuperAdmin';
  });

  protected readonly canViewPaymentQueue = computed(() => {
    const role = this.currentRole();
    return role === 'TenantAdmin' || role === 'Accountant' || role === 'SuperAdmin';
  });

  protected readonly canViewApprovalQueue = computed(() => {
    const role = this.currentRole();
    return role === 'TenantAdmin' || role === 'Manager' || role === 'SuperAdmin';
  });

  protected readonly pendingApprovalItems = computed(() => this.approvalQueue()?.items ?? []);
  protected readonly pendingApprovalCount = computed(
    () => this.approvalQueue()?.totalCount ?? this.pendingApprovalItems().length,
  );
  protected readonly pendingApprovalTotal = computed(() =>
    this.pendingApprovalItems().reduce((sum, item) => sum + item.amount, 0),
  );
  protected readonly approvalCurrencyCode = computed(() => {
    const firstCurrency = this.pendingApprovalItems()[0]?.currency;
    if (!firstCurrency) return 'VND';
    return this.pendingApprovalItems().every((item) => item.currency === firstCurrency)
      ? firstCurrency
      : 'VND';
  });
  protected readonly baseCurrencyCode = computed(
    () => this.summary()?.baseCurrencyCode ?? this.approvalCurrencyCode(),
  );
  protected readonly hasReportingData = computed(() => {
    const summary = this.summary();
    return (
      !!summary?.expenseCount ||
      this.budgets().length > 0 ||
      this.departmentSpendRows().length > 0 ||
      this.topEmployees().length > 0 ||
      this.pendingPayments().length > 0 ||
      this.monthlyTrend().some((point) => point.expenseTotal > 0)
    );
  });
  protected readonly hasOperationalData = computed(() => this.pendingApprovalItems().length > 0);

  protected readonly datePresetOptions: Array<{ id: PresetRange; label: string }> = [
    { id: 'thisWeek', label: 'Tuần này' },
    { id: 'thisMonth', label: 'Tháng này' },
    { id: 'lastMonth', label: 'Tháng trước' },
    { id: 'thisQuarter', label: 'Quý này' },
    { id: 'thisYear', label: 'Năm nay' },
    { id: 'custom', label: 'Tùy chỉnh' },
  ];

  protected readonly presetLabel = computed(
    () => this.datePresetOptions.find((option) => option.id === this.preset())?.label ?? 'Tùy chỉnh',
  );

  protected readonly departmentOptions = computed(() => {
    const options = new Map<string, string>();
    for (const row of this.summary()?.byDepartment ?? []) {
      if (row.keyId) {
        options.set(row.keyId, row.keyName);
      }
    }
    for (const row of this.budgets()) {
      options.set(row.departmentId, row.departmentName);
    }
    return [...options.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((left, right) => left.label.localeCompare(right.label, 'vi'));
  });

  protected readonly sourceBanner = computed(() => {
    if (this.hasReportingData()) {
      return 'Dữ liệu thật từ reporting API: expense, budget, payment và phòng ban.';
    }
    if (this.hasOperationalData()) {
      return 'Dữ liệu thật từ hàng đợi phê duyệt. Bảng expense/payment/budget chưa có dữ liệu confirmed nên báo cáo dùng pipeline chứng từ đang xử lý.';
    }
    return 'Chưa có dữ liệu reporting hoặc chứng từ operational trong workspace hiện tại.';
  });

  protected readonly periodKpis = computed<PeriodKpi[]>(() => {
    const summary = this.summary();
    const total = summary?.totalInBaseCurrency ?? this.pendingApprovalTotal();
    const docs = summary?.expenseCount ?? this.pendingApprovalCount();
    const oldestPendingAge = Math.max(
      0,
      ...this.pendingReimbursementRows().map((row) => row.ageDays),
    );
    const avgApprovalAge =
      this.pendingReimbursementRows().length > 0
        ? this.pendingReimbursementRows().reduce((sum, row) => sum + row.ageDays, 0) /
          this.pendingReimbursementRows().length
        : 0;
    const overBudget = this.budgets().filter((item) => item.isOverBudget).length;
    const watchedBudget = this.budgets().filter(
      (item) => item.isOverBudget || item.isApproachingLimit,
    ).length;
    const avgBudgetUse = this.budgets().length
      ? Math.round(
          this.budgets().reduce((sum, item) => sum + item.utilizationPercent, 0) /
            this.budgets().length,
        )
      : 0;

    return [
      {
        id: 'total',
        label: 'Tổng chi tiêu',
        value: this.formatMoney(total),
        hint: `${this.formatNumber(docs)} chứng từ · dữ liệu thật`,
        tone: 'default',
      },
      {
        id: 'pendingApprovals',
        label: 'Đang chờ hoàn tiền',
        value: this.formatMoney(this.pendingApprovalTotal(), this.approvalCurrencyCode()),
        hint: `${this.formatNumber(this.pendingApprovalCount())} chứng từ đang chờ · cũ nhất ${this.formatNumber(oldestPendingAge)} ngày`,
        tone: this.pendingApprovalCount() > 0 ? 'red' : 'green',
      },
      {
        id: 'avg',
        label: 'Thời gian duyệt TB',
        value: `${this.formatDecimal(avgApprovalAge)} ngày`,
        hint: this.pendingReimbursementRows().length
          ? `${this.formatNumber(this.pendingReimbursementRows().length)} chứng từ trong queue`
          : 'Chưa có chứng từ chờ xử lý',
        tone: 'default',
      },
      {
        id: 'budgetHealth',
        label: 'Sức khỏe ngân sách',
        value: this.budgets().length ? `${this.formatNumber(avgBudgetUse)}% sử dụng` : 'Chưa có',
        hint: this.budgets().length
          ? `${this.formatNumber(overBudget)} vượt ngân sách`
          : 'Chưa có ngân sách trong kỳ',
        tone: overBudget > 0 ? 'red' : watchedBudget > 0 ? 'amber' : 'green',
      },
    ];
  });

  protected readonly categoryRows = computed(() => {
    const rows = [...(this.summary()?.byCategory ?? [])];
    if (!rows.length && this.pendingApprovalItems().length) {
      const grouped = new Map<string, { amount: number; count: number }>();
      for (const item of this.pendingApprovalItems()) {
        const key = item.department?.trim() || 'Chưa có phòng ban';
        const current = grouped.get(key) ?? { amount: 0, count: 0 };
        current.amount += item.amount;
        current.count += 1;
        grouped.set(key, current);
      }

      rows.push(
        ...[...grouped.entries()].map(([keyName, value]) => ({
          keyId: keyName,
          keyName,
          amountInBaseCurrency: value.amount,
          expenseCount: value.count,
        })),
      );
    }

    rows.sort((left, right) => right.amountInBaseCurrency - left.amountInBaseCurrency);
    const total = rows.reduce((sum, row) => sum + row.amountInBaseCurrency, 0) || 1;
    return rows.map((row, index) => ({
      ...row,
      index,
      percent: Math.round((row.amountInBaseCurrency / total) * 100),
    }));
  });

  protected readonly categoryTotal = computed(() =>
    this.categoryRows().reduce((sum, row) => sum + row.amountInBaseCurrency, 0),
  );

  protected readonly categoryConicGradient = computed(() => {
    const palette = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#6b7280'];
    const rows = this.categoryRows();
    if (!rows.length) return 'conic-gradient(#e5e7eb 0deg 360deg)';

    let cursor = 0;
    const segments = rows.map((row, index) => {
      const start = cursor;
      const sweep = Math.max(1, (row.percent / 100) * 360);
      cursor += sweep;
      return `${palette[index % palette.length]} ${start}deg ${cursor}deg`;
    });
    return `conic-gradient(${segments.join(', ')})`;
  });

  protected readonly trendBars = computed<TrendBar[]>(() => {
    const points =
      this.monthlyTrend().length > 0
        ? this.monthlyTrend()
        : this.operationalTrendPoints();
    if (!points.length) return [];
    const max = Math.max(...points.map((point) => point.expenseTotal), 1);
    return points.map((point) => ({
      label: this.shortMonth(point.year, point.month),
      amount: point.expenseTotal,
      documents: point.documentCount,
      heightPercent: Math.max(4, Math.round((point.expenseTotal / max) * 100)),
    }));
  });

  protected readonly trendSvgPoints = computed<TrendSvgPoint[]>(() => {
    const bars = this.trendBars();
    if (!bars.length) return [];
    const max = Math.max(...bars.map((bar) => bar.amount), 1);
    const min = Math.min(...bars.map((bar) => bar.amount), 0);
    const range = Math.max(max - min, 1);
    const left = 34;
    const right = 560;
    const top = 26;
    const bottom = 150;
    const step = bars.length > 1 ? (right - left) / (bars.length - 1) : 0;

    return bars.map((bar, index) => ({
      ...bar,
      x: bars.length > 1 ? left + step * index : (left + right) / 2,
      y: bottom - ((bar.amount - min) / range) * (bottom - top),
    }));
  });

  protected readonly trendPolyline = computed(() =>
    this.trendSvgPoints()
      .map((point) => `${point.x},${point.y}`)
      .join(' '),
  );

  protected readonly trendBenchmarkPolyline = computed(() => {
    const points = this.trendSvgPoints();
    if (!points.length) return '';
    const average = points.reduce((sum, point) => sum + point.amount, 0) / points.length;
    const max = Math.max(...points.map((point) => point.amount), average, 1);
    const min = Math.min(...points.map((point) => point.amount), 0);
    const range = Math.max(max - min, 1);
    const top = 26;
    const bottom = 150;
    const y = bottom - ((average - min) / range) * (bottom - top);
    return `${points[0].x},${y} ${points[points.length - 1].x},${y}`;
  });

  protected readonly budgetWatchList = computed(() =>
    [...this.budgets()].sort((left, right) => right.utilizationPercent - left.utilizationPercent),
  );

  protected readonly departmentSpendRows = computed(() => {
    const reportingRows = [...(this.summary()?.byDepartment ?? [])]
      .sort((left, right) => right.amountInBaseCurrency - left.amountInBaseCurrency)
      .map((department: ExpenseSummaryGroup, index) => ({
      id: department.keyId ?? department.keyName,
      rank: index + 1,
      name: department.keyName || 'Chưa có phòng ban',
      total: department.amountInBaseCurrency,
      documents: department.expenseCount,
      source: 'reporting',
    }));
    if (reportingRows.length) return reportingRows;

    const grouped = new Map<string, { total: number; documents: number }>();
    for (const item of this.pendingApprovalItems()) {
      const key = item.department?.trim() || 'Chưa có phòng ban';
      const current = grouped.get(key) ?? { total: 0, documents: 0 };
      current.total += item.amount;
      current.documents += 1;
      grouped.set(key, current);
    }

    return [...grouped.entries()]
      .map(([name, value], index) => ({
        id: `${name}-${index}`,
        rank: index + 1,
        name,
        total: value.total,
        documents: value.documents,
        source: 'approval',
      }))
      .sort((left, right) => right.total - left.total);
  });

  protected readonly employeeRows = computed(() => {
    const reportingRows = this.topEmployees().map((employee, index) => ({
      id: employee.membershipId,
      rank: index + 1,
      name: employee.employeeName,
      department: employee.departmentName,
      total: employee.totalAmountInBaseCurrency,
      count: employee.expenseCount,
      currencyCode: employee.baseCurrencyCode,
    }));
    if (reportingRows.length) return reportingRows;

    const grouped = new Map<string, { department: string; total: number; count: number }>();
    for (const item of this.pendingApprovalItems()) {
      const key = item.requester?.trim() || item.requesterEmail?.trim() || 'Chưa có nhân viên';
      const current = grouped.get(key) ?? {
        department: item.department?.trim() || 'Chưa có phòng ban',
        total: 0,
        count: 0,
      };
      current.total += item.amount;
      current.count += 1;
      grouped.set(key, current);
    }

    return [...grouped.entries()]
      .map(([name, value], index) => ({
        id: `${name}-${index}`,
        rank: index + 1,
        name,
        department: value.department,
        total: value.total,
        count: value.count,
        currencyCode: this.approvalCurrencyCode(),
      }))
      .sort((left, right) => right.total - left.total);
  });

  protected readonly pendingReimbursementRows = computed<PendingReimbursementRow[]>(() => {
    const reportingRows = this.pendingPayments().map((item) => ({
      id: item.paymentId,
      employee: item.employeeName,
      code: item.reference || item.documentId,
      department: item.departmentName || '—',
      amount: item.amountInBaseCurrency || item.amount,
      currencyCode: item.baseCurrencyCode || item.currencyCode,
      approvedAt: item.recordedAt,
      ageDays: item.ageDays,
      actionLabel: 'Xử lý ngay',
    }));
    if (reportingRows.length) return reportingRows;

    return this.pendingApprovalItems().map((item) => ({
      id: item.documentId,
      employee: item.requester || item.requesterEmail || 'Chưa có người gửi',
      code: item.title || item.documentId,
      department: item.department || '—',
      amount: item.amount,
      currencyCode: item.currency,
      approvedAt: item.submittedAt,
      ageDays: this.ageDaysSince(item.submittedAt || item.expenseDate),
      actionLabel: 'Xử lý ngay',
    }));
  });

  protected readonly currencyRows = computed(() => {
    const summaryCurrencies = this.summary()?.byCurrency ?? [];
    if (summaryCurrencies.length) {
      const total =
        summaryCurrencies.reduce((sum, item) => sum + item.amountInBaseCurrency, 0) || 1;
      return summaryCurrencies.map((item) => ({
        code: item.currencyCode,
        amount: item.nativeAmount,
        baseAmount: item.amountInBaseCurrency,
        percent: Math.round((item.amountInBaseCurrency / total) * 100),
      }));
    }

    const amount = this.pendingApprovalTotal();
    return amount > 0
      ? [
          {
            code: this.approvalCurrencyCode(),
            amount,
            baseAmount: amount,
            percent: 100,
          },
        ]
      : [];
  });

  constructor() {
    effect(() => {
      const tenantId = this.workspaceState().workspace?.tenantId;
      if (tenantId && this.canViewReports()) {
        this.refresh();
      }
    });
  }

  protected applyPreset(preset: PresetRange): void {
    this.preset.set(preset);
    const today = new Date();
    const setRange = (from: Date, to: Date) => {
      this.fromDate.set(this.toIso(from));
      this.toDate.set(this.toIso(to));
    };

    switch (preset) {
      case 'thisWeek': {
        const day = today.getDay() || 7;
        setRange(new Date(today.getFullYear(), today.getMonth(), today.getDate() - day + 1), today);
        break;
      }
      case 'thisMonth':
        setRange(new Date(today.getFullYear(), today.getMonth(), 1), today);
        break;
      case 'lastMonth': {
        const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const end = new Date(today.getFullYear(), today.getMonth(), 0);
        setRange(start, end);
        break;
      }
      case 'thisQuarter': {
        const quarterStartMonth = Math.floor(today.getMonth() / 3) * 3;
        setRange(new Date(today.getFullYear(), quarterStartMonth, 1), today);
        break;
      }
      case 'thisYear':
        setRange(new Date(today.getFullYear(), 0, 1), today);
        break;
      case 'custom':
        break;
    }

    this.refresh();
  }

  protected refresh(): void {
    if (!this.canViewReports()) return;

    this.isLoading.set(true);
    this.loadError.set(null);
    this.loadWarnings.set([]);

    const from = this.fromDate();
    const to = this.toDate();
    const refDate = new Date(to);
    const month = refDate.getMonth() + 1;
    const year = refDate.getFullYear();
    const departmentId = this.selectedDepartmentId();

    forkJoin({
      summary: this.reportingApi.expenseSummary({ from, to, departmentId }).pipe(
        catchError(() => {
          this.addLoadWarning('Không tải được tổng quan chi tiêu.');
          return of(null as ExpenseSummaryResponse | null);
        }),
      ),
      budgets: this.reportingApi.budgetUtilization(month, year, departmentId).pipe(
        catchError(() => {
          this.addLoadWarning('Không tải được dữ liệu ngân sách.');
          return of([] as BudgetUtilizationResponse[]);
        }),
      ),
      employees: this.reportingApi.topEmployees(from, to, 8, departmentId).pipe(
        catchError(() => {
          this.addLoadWarning('Không tải được bảng xếp hạng nhân viên.');
          return of([] as TopEmployeeResponse[]);
        }),
      ),
      approvals: this.canViewApprovalQueue()
        ? this.approvalsApi.getApprovalQueue('PENDING', null, 1, 20).pipe(
            catchError(() => {
              this.addLoadWarning('Không tải được hàng đợi phê duyệt.');
              return of(this.emptyApprovalQueue());
            }),
          )
        : of(this.emptyApprovalQueue()),
      pending: this.canViewPaymentQueue()
        ? this.reportingApi.pendingPaymentQueue().pipe(
            catchError(() => {
              this.addLoadWarning('Không tải được hàng đợi thanh toán.');
              return of([] as PendingPaymentItemResponse[]);
            }),
          )
        : of([] as PendingPaymentItemResponse[]),
      trend: this.reportingApi.monthlyTrend(6, departmentId).pipe(
        catchError(() => {
          this.addLoadWarning('Không tải được xu hướng theo tháng.');
          return of([] as MonthlyTrendPointResponse[]);
        }),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.summary.set(data.summary);
          this.budgets.set(data.budgets);
          this.topEmployees.set(data.employees);
          this.approvalQueue.set(data.approvals);
          this.pendingPayments.set(data.pending);
          this.monthlyTrend.set(data.trend);
          this.isLoading.set(false);
        },
        error: (err: Error) => {
          this.loadError.set(toUserFacingError(err.message));
          this.isLoading.set(false);
        },
      });
  }

  protected formatMoney(value: number, code = this.baseCurrencyCode()): string {
    if (!isFinite(value)) return '—';
    if (code === 'VND') {
      return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + ' ₫';
    }
    return (
      new Intl.NumberFormat('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(value) +
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

  protected formatDecimal(value: number): string {
    if (!isFinite(value)) return '0';
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: value % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    }).format(value);
  }

  protected formatDate(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  protected statusLabel(status: string): string {
    const normalized = status.replace(/[\s_-]+/g, '').toLowerCase();
    if (normalized.includes('readyforapproval') || normalized.includes('pending')) {
      return 'Chờ phê duyệt';
    }
    if (normalized.includes('approved')) return 'Đã duyệt';
    if (normalized.includes('rejected')) return 'Từ chối';
    return status || 'Không rõ';
  }

  protected exportPdf(): void {
    if (typeof window === 'undefined') return;

    // Stamp the export header and set a meaningful document title so the
    // browser's "Save as PDF" defaults to a recognisable filename.
    const now = new Date();
    this.exportedAt.set(
      now.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' }),
    );

    const tenant = this.workspaceState().workspace?.tenantName?.trim() || 'FinFlow';
    const previousTitle = document.title;
    document.title = `Bao-cao_${tenant}_${this.fromDate()}_${this.toDate()}`
      .replace(/\s+/g, '-');

    try {
      window.print();
    } finally {
      document.title = previousTitle;
    }
  }

  protected onFromDateChange(value: string): void {
    this.fromDate.set(value);
  }

  protected onToDateChange(value: string): void {
    this.toDate.set(value);
  }

  protected onDepartmentChange(value: string): void {
    const departmentId = value || null;
    this.selectedDepartmentId.set(departmentId);
    const label =
      departmentId === null
        ? 'Tất cả phòng ban'
        : this.departmentOptions().find((option) => option.id === departmentId)?.label ??
          'Phòng ban đã chọn';
    this.selectedDepartmentLabel.set(label);
    this.refresh();
  }

  protected openPendingPayment(row: PendingReimbursementRow): void {
    void this.router.navigate(['/app/payments'], {
      queryParams: { q: row.code },
    });
  }

  private firstDayOfThisMonth(): string {
    const today = new Date();
    return this.toIso(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  private todayIso(): string {
    return this.toIso(new Date());
  }

  private toIso(date: Date): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private shortMonth(year: number, month: number): string {
    return `T${month.toString().padStart(2, '0')}/${String(year).slice(-2)}`;
  }

  private operationalTrendPoints(): MonthlyTrendPointResponse[] {
    const grouped = new Map<string, { year: number; month: number; amount: number; count: number }>();
    for (const item of this.pendingApprovalItems()) {
      const date = new Date(item.submittedAt || item.expenseDate);
      if (isNaN(date.getTime())) continue;
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const key = `${year}-${month}`;
      const current = grouped.get(key) ?? { year, month, amount: 0, count: 0 };
      current.amount += item.amount;
      current.count += 1;
      grouped.set(key, current);
    }

    return [...grouped.values()]
      .sort((left, right) => left.year - right.year || left.month - right.month)
      .map((item) => ({
        year: item.year,
        month: item.month,
        expenseTotal: item.amount,
        documentCount: item.count,
        baseCurrencyCode: this.approvalCurrencyCode(),
      }));
  }

  private ageDaysSince(iso: string): number {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return 0;
    const diff = Date.now() - date.getTime();
    return Math.max(0, Math.floor(diff / 86_400_000));
  }

  private emptyApprovalQueue(): ApprovalQueuePageResponse {
    return {
      items: [],
      page: 1,
      pageSize: 20,
      totalCount: 0,
      totalPages: 1,
    };
  }

  private addLoadWarning(message: string): void {
    this.loadWarnings.update((warnings) => [...warnings, message]);
  }
}
