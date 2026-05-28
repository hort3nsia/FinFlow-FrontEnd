import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  PaymentAuditTrailItemResponse,
  PaymentDetailResponse,
  PaymentQueueItemResponse,
  PaymentsApiService,
  RejectType,
} from '../data/payments-api.service';

type PaymentTabId = 'ready' | 'scheduled' | 'paid' | 'failed' | 'all';
type PaymentTone = 'ready' | 'scheduled' | 'paid' | 'failed';

interface PaymentTab {
  id: PaymentTabId;
  label: string;
  count: number;
}

interface PaymentKpi {
  id: 'ready' | 'scheduled' | 'paid' | 'total';
  label: string;
  value: string;
  caption: string;
}

interface PaymentRow {
  id: string;
  paymentId: string | null;
  documentId: string;
  reference: string;
  documentFileName: string;
  employeeName: string;
  employeeMembershipId: string;
  employeeCode: string | null;
  merchantName: string | null;
  department: string;
  amount: number;
  amountInBaseCurrency: number;
  currencyCode: string;
  amountDisplay: string;
  submittedAt: string;
  submittedAtLabel: string;
  expenseDateLabel: string;
  ageDays: number;
  queueStatus: PaymentQueueItemResponse['queueStatus'];
  statusTone: PaymentTone;
  statusLabel: string;
  paymentMethod: string | null;
  recordedAtLabel: string | null;
  confirmedAtLabel: string | null;
  rejectionReason: string | null;
  notes: string | null;
}

@Component({
  selector: 'app-payments-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './payments-page.component.html',
  styleUrl: './payments-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PaymentsPageComponent {
  private readonly paymentsApi = inject(PaymentsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private detailRequestKey = '';
  private readonly detailCache = new Map<string, PaymentDetailResponse | null>();

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly detailLoading = signal(false);
  protected readonly detailError = signal<string | null>(null);
  protected readonly paymentActionKey = signal<string | null>(null);
  protected readonly activeTab = signal<PaymentTabId>('ready');
  protected readonly searchQuery = signal('');
  protected readonly showAdvancedFilters = signal(false);
  protected readonly thisMonthOnly = signal(false);
  protected readonly methodFilter = signal('all');
  protected readonly paymentMethod = signal('BankTransfer');
  protected readonly transactionReference = signal('');
  protected readonly rejectReason = signal('');
  private readonly queueItems = signal<PaymentRow[]>([]);
  private readonly selectedPaymentId = signal<string | null>(null);
  protected readonly selectedDetail = signal<PaymentDetailResponse | null>(null);

  protected readonly tabs = computed<PaymentTab[]>(() => {
    const rows = this.queueItems();
    const count = (status: PaymentRow['queueStatus']) =>
      rows.filter((row) => row.queueStatus === status).length;

    return [
      { id: 'ready', label: 'Sẵn sàng thanh toán', count: count('ReadyToPay') },
      { id: 'scheduled', label: 'Đã lên lịch', count: count('Scheduled') },
      { id: 'paid', label: 'Đã thanh toán', count: count('Paid') },
      { id: 'failed', label: 'Thất bại', count: count('Failed') },
      { id: 'all', label: 'Tất cả', count: rows.length },
    ];
  });

  protected readonly kpis = computed<PaymentKpi[]>(() => {
    const rows = this.queueItems();
    const ready = rows.filter((row) => row.queueStatus === 'ReadyToPay');
    const scheduled = rows.filter((row) => row.queueStatus === 'Scheduled');
    const paid = rows.filter((row) => row.queueStatus === 'Paid');
    const currency = rows[0]?.currencyCode ?? 'VND';

    return [
      {
        id: 'ready',
        label: 'Sẵn sàng thanh toán',
        value: `${ready.length} khoản`,
        caption: `${this.formatCurrency(this.sum(ready), currency)} đang chờ`,
      },
      {
        id: 'scheduled',
        label: 'Đã lên lịch',
        value: `${scheduled.length} khoản`,
        caption: 'Chờ thực hiện giao dịch',
      },
      {
        id: 'paid',
        label: 'Đã thanh toán trong kỳ',
        value: `${paid.length} khoản`,
        caption: 'Đã xác nhận chi trả',
      },
      {
        id: 'total',
        label: 'Tổng đã chi trong kỳ',
        value: this.formatCurrency(this.sum(paid), currency),
        caption: 'Theo dữ liệu thanh toán thực tế',
      },
    ];
  });

  protected readonly filteredRows = computed(() => {
    const query = this.searchQuery().trim().toLocaleLowerCase('vi-VN');
    const rows = this.queueItems().filter((row) => {
      if (!query) return true;

      return [row.reference, row.employeeName, row.merchantName, row.department]
        .filter(Boolean)
        .some((value) => value!.toLocaleLowerCase('vi-VN').includes(query));
    });
    const monthFiltered = this.thisMonthOnly()
      ? rows.filter((row) => this.isCurrentMonth(row.submittedAt))
      : rows;
    const method = this.methodFilter();
    const methodFiltered =
      method === 'all'
        ? monthFiltered
        : monthFiltered.filter((row) => (row.paymentMethod ?? 'unset') === method);
    const activeTab = this.activeTab();

    if (activeTab === 'all') return methodFiltered;

    const statuses: Record<Exclude<PaymentTabId, 'all'>, PaymentRow['queueStatus']> = {
      ready: 'ReadyToPay',
      scheduled: 'Scheduled',
      paid: 'Paid',
      failed: 'Failed',
    };

    return methodFiltered.filter((row) => row.queueStatus === statuses[activeTab]);
  });

  // ─── Pagination ─────────────────────────────────────────────────
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(20);
  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil(this.filteredRows().length / this.pageSize())),
  );
  protected readonly paginatedRows = computed(() => {
    const rows = this.filteredRows();
    const page = this.currentPage();
    const size = this.pageSize();
    const start = (page - 1) * size;
    return rows.slice(start, start + size);
  });
  protected readonly paginationLabel = computed(() => {
    const total = this.filteredRows().length;
    const page = this.currentPage();
    const size = this.pageSize();
    const start = Math.min((page - 1) * size + 1, total);
    const end = Math.min(page * size, total);
    return `${start}–${end} / ${total}`;
  });

  protected goToPage(page: number): void {
    const clamped = Math.max(1, Math.min(page, this.totalPages()));
    this.currentPage.set(clamped);
  }

  protected readonly selectedRow = computed(
    () => this.queueItems().find((row) => row.id === this.selectedPaymentId()) ?? null,
  );

  constructor() {
    this.loadQueue();
  }

  protected setActiveTab(tabId: PaymentTabId): void {
    this.activeTab.set(tabId);
    this.currentPage.set(1);
    this.syncSelection();
  }

  protected updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
    this.syncSelection();
  }

  protected toggleAdvancedFilters(): void {
    this.showAdvancedFilters.update((value) => !value);
  }

  protected toggleThisMonthOnly(): void {
    this.thisMonthOnly.update((value) => !value);
    this.syncSelection();
  }

  protected updateMethodFilter(value: string): void {
    this.methodFilter.set(value);
    this.syncSelection();
  }

  protected selectPayment(id: string): void {
    if (id === this.selectedPaymentId()) {
      return;
    }

    this.selectedPaymentId.set(id);
    this.loadSelectedDetail();
  }

  protected clearSelection(): void {
    this.selectedPaymentId.set(null);
    this.selectedDetail.set(null);
    this.detailError.set(null);
    this.detailLoading.set(false);
    this.detailRequestKey = '';
  }

  protected updatePaymentMethod(value: string): void {
    this.paymentMethod.set(value);
  }

  protected updateTransactionReference(value: string): void {
    this.transactionReference.set(value);
  }

  protected updateRejectReason(value: string): void {
    this.rejectReason.set(value);
  }

  protected isPaymentActionBusy(row: PaymentRow, action: 'schedule' | 'confirm' | 'reject'): boolean {
    return this.paymentActionKey() === `${row.id}:${action}`;
  }

  protected exportVisibleRows(): void {
    const rows = this.filteredRows();
    if (!rows.length) return;

    const headers = [
      'Nhân viên',
      'Mã khoản chi',
      'Nhà cung cấp',
      'Phòng ban',
      'Số tiền',
      'Tiền tệ',
      'Phương thức',
      'Trạng thái',
    ];
    const body = rows.map((row) => [
      row.employeeName,
      row.reference,
      row.merchantName ?? '',
      row.department,
      String(row.amount),
      row.currencyCode,
      this.paymentMethodLabel(row.paymentMethod),
      row.statusLabel,
    ]);
    const csv = [headers, ...body]
      .map((values) => values.map((value) => this.escapeCsv(value)).join(','))
      .join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `finflow-thanh-toan-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  protected schedulePayment(row: PaymentRow): void {
    if (this.paymentActionKey()) return;
    this.paymentActionKey.set(`${row.id}:schedule`);
    this.detailError.set(null);

    this.paymentsApi
      .recordPayment({
        documentId: row.documentId,
        paymentMethod: this.paymentMethod(),
        notes: row.notes ?? undefined,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.paymentActionKey.set(null);
          this.detailCache.delete(row.id);
          this.loadQueue();
        },
        error: (error: Error) => {
          this.paymentActionKey.set(null);
          this.detailError.set(error.message);
        },
      });
  }

  protected confirmPayment(row: PaymentRow): void {
    if (!row.paymentId) {
      this.schedulePayment(row);
      return;
    }

    if (this.paymentActionKey()) return;
    this.paymentActionKey.set(`${row.id}:confirm`);
    this.detailError.set(null);

    const reference = this.transactionReference().trim() || undefined;
    this.paymentsApi
      .confirmPayment(row.paymentId, reference)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.paymentActionKey.set(null);
          this.transactionReference.set('');
          this.detailCache.delete(row.id);
          this.loadQueue();
        },
        error: (error: Error) => {
          this.paymentActionKey.set(null);
          this.detailError.set(error.message);
        },
      });
  }

  protected rejectPayment(row: PaymentRow): void {
    if (!row.paymentId) return;
    if (this.paymentActionKey()) return;

    const rejectType: RejectType = 'OTHER';
    const reason = this.rejectReason().trim() || 'Chuyển lại để kiểm tra thông tin chi trả.';
    this.paymentActionKey.set(`${row.id}:reject`);
    this.detailError.set(null);

    this.paymentsApi
      .rejectPayment(row.paymentId, rejectType, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.paymentActionKey.set(null);
          this.rejectReason.set('');
          this.detailCache.delete(row.id);
          this.loadQueue();
        },
        error: (error: Error) => {
          this.paymentActionKey.set(null);
          this.detailError.set(error.message);
        },
      });
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  protected paymentMethodLabel(value: string | null): string {
    if (!value) return 'Chưa thiết lập';

    const labels: Record<string, string> = {
      BankTransfer: 'Chuyển khoản ngân hàng',
      ACH: 'Chuyển khoản ngân hàng',
      Cash: 'Tiền mặt',
      Payroll: 'Qua bảng lương',
      Other: 'Khác',
    };

    return labels[value] ?? value.replace(/([a-z])([A-Z])/g, '$1 $2');
  }

  protected auditTrail(): PaymentAuditTrailItemResponse[] {
    return this.selectedDetail()?.auditTrail ?? [];
  }

  protected formatCurrency(value: number, currencyCode: string): string {
    if (currencyCode === 'VND') {
      return `₫${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)}`;
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  protected formatDate(value: string | null | undefined): string {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  protected formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  private loadQueue(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.paymentsApi
      .getPaymentQueue()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.queueItems.set(items.map((item) => this.toPaymentRow(item)));
          this.isLoading.set(false);
          this.syncSelection(true);
        },
        error: (error: Error) => {
          this.queueItems.set([]);
          this.clearSelection();
          this.loadError.set(error.message);
          this.isLoading.set(false);
        },
      });
  }

  private syncSelection(reloadDetail = false): void {
    const visible = this.filteredRows();
    const current = this.selectedPaymentId();
    const nextId = visible.some((row) => row.id === current) ? current : visible[0]?.id ?? null;

    if (!nextId) {
      this.clearSelection();
      return;
    }

    if (nextId !== current || reloadDetail) {
      this.selectedPaymentId.set(nextId);
      this.loadSelectedDetail();
    }
  }

  private loadSelectedDetail(): void {
    const row = this.selectedRow();
    if (!row) return;

    const requestKey = row.id;
    this.detailRequestKey = requestKey;
    this.detailError.set(null);

    if (this.detailCache.has(requestKey)) {
      this.selectedDetail.set(this.detailCache.get(requestKey) ?? null);
      this.detailLoading.set(false);
      return;
    }

    this.detailLoading.set(true);
    this.selectedDetail.set(null);

    this.paymentsApi
      .getPaymentDetail(row.paymentId, row.documentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          if (this.detailRequestKey !== requestKey) return;

          this.detailCache.set(requestKey, detail);
          this.selectedDetail.set(detail);
          this.detailLoading.set(false);
        },
        error: (error: Error) => {
          if (this.detailRequestKey !== requestKey) return;

          this.detailError.set(error.message);
          this.detailLoading.set(false);
        },
      });
  }

  private toPaymentRow(item: PaymentQueueItemResponse): PaymentRow {
    const submittedAt = new Date(item.submittedAt);
    const ageDays = Number.isNaN(submittedAt.getTime())
      ? 0
      : Math.max(0, Math.floor((Date.now() - submittedAt.getTime()) / 86_400_000));

    return {
      id: item.paymentId ?? item.documentId,
      paymentId: item.paymentId,
      documentId: item.documentId,
      reference: item.reference,
      documentFileName: item.documentFileName,
      employeeName: item.employeeName,
      employeeMembershipId: item.employeeMembershipId,
      employeeCode: item.employeeCode,
      merchantName: item.merchantName,
      department: item.department || 'Chưa phân bổ',
      amount: item.amount,
      amountInBaseCurrency: item.amountInBaseCurrency,
      currencyCode: item.currencyCode,
      amountDisplay: this.formatCurrency(item.amount, item.currencyCode),
      submittedAt: item.submittedAt,
      submittedAtLabel: this.formatDateTime(item.submittedAt),
      expenseDateLabel: this.formatDate(item.expenseDate),
      ageDays,
      queueStatus: item.queueStatus,
      statusTone: this.statusTone(item.queueStatus),
      statusLabel: this.statusLabel(item.queueStatus),
      paymentMethod: item.paymentMethod,
      recordedAtLabel: item.recordedAt ? this.formatDateTime(item.recordedAt) : null,
      confirmedAtLabel: item.confirmedAt ? this.formatDateTime(item.confirmedAt) : null,
      rejectionReason: item.rejectionReason,
      notes: item.notes,
    };
  }

  private sum(rows: PaymentRow[]): number {
    return rows.reduce((total, row) => total + row.amount, 0);
  }

  private escapeCsv(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
  }

  private statusTone(status: PaymentQueueItemResponse['queueStatus']): PaymentTone {
    if (status === 'ReadyToPay') return 'ready';
    return status.toLowerCase() as PaymentTone;
  }

  private statusLabel(status: PaymentQueueItemResponse['queueStatus']): string {
    const labels: Record<PaymentQueueItemResponse['queueStatus'], string> = {
      ReadyToPay: 'Sẵn sàng thanh toán',
      Scheduled: 'Đã lên lịch',
      Paid: 'Đã thanh toán',
      Failed: 'Thất bại',
    };

    return labels[status];
  }

  private isCurrentMonth(value: string): boolean {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    const now = new Date();
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  }
}
