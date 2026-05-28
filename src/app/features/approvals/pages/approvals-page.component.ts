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
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { forkJoin, map } from 'rxjs';
import {
  ApprovalDetailResponse,
  ApprovalQueuePageResponse,
  ApprovalStatusFilter,
  ApprovalsApiService,
  ExportApprovalQueueResponse,
  PendingApprovalItemResponse,
  ReviewedApprovalActionResponse,
} from '../data/approvals-api.service';
import {
  DocumentsApiService,
  SubmittedDocumentDetailResponse,
} from '../../documents/data/documents-api.service';

type ApprovalStatusTone = 'pending' | 'approved' | 'rejected' | 'default';
type ApprovalTabId = 'all' | 'pending' | 'resolved';
type ApprovalInspectorTabId = 'details' | 'invoice' | 'notes' | 'history' | 'actions';

interface ApprovalTab {
  id: ApprovalTabId;
  label: string;
}

interface ApprovalInspectorTab {
  id: ApprovalInspectorTabId;
  label: string;
}

interface ApprovalKpi {
  id: 'pending' | 'approved' | 'rejected' | 'resolved';
  label: string;
  value: string;
}

interface ApprovalRow {
  id: string;
  requestCode: string;
  requestTitle: string;
  requester: string;
  requesterEmail: string;
  requesterInitials: string;
  vendorLabel: string;
  department: string;
  amountValue: number;
  amountDisplay: string;
  currency: string;
  expenseDateValue: string;
  submittedAtValue: string;
  expenseDateLabel: string;
  submittedLabel: string;
  status: string;
  statusTone: ApprovalStatusTone;
  summary: string;
  policySummary: string;
}

interface ApprovalQueueSnapshot {
  items: ApprovalRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

interface ApprovalQueueSnapshots {
  all: ApprovalQueueSnapshot | null;
  pending: ApprovalQueueSnapshot | null;
  approved: ApprovalQueueSnapshot | null;
  rejected: ApprovalQueueSnapshot | null;
  resolved: ApprovalQueueSnapshot | null;
}

interface ApprovalLineItem {
  description: string;
  quantityLabel: string;
  unitPriceLabel: string;
  grossLabel: string;
  discountLabel: string;
  netLabel: string;
}

interface ApprovalInspectorDetail {
  id: string;
  requestCode: string;
  title: string;
  vendorLabel: string;
  currency: string;
  priority: string;
  requester: string;
  requesterInitials: string;
  requesterEmail: string;
  department: string;
  amountDisplay: string;
  expenseDateValue: string;
  expenseDateLabel: string;
  submittedAtValue: string;
  submittedLabel: string;
  status: string;
  statusTone: ApprovalStatusTone;
  policySummary: string;
  lineItems: ApprovalLineItem[];
  grossSubtotalDisplay: string;
  totalDiscountDisplay: string;
  vatDisplay: string;
  grandTotalDisplay: string;
  hasDiscount: boolean;
  hasVat: boolean;
}

interface ApprovalInvoicePreview {
  originalFileName: string;
  contentType: string;
  previewImageDataUrl: string | null;
}

@Component({
  selector: 'app-approvals-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './approvals-page.component.html',
  styleUrl: './approvals-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApprovalsPageComponent {
  private readonly approvalsApi = inject(ApprovalsApiService);
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly queuePageSize = 20;

  protected readonly pageCopy =
    'Manager review queue for submitted spending requests. Approved items move forward to payout processing.';

  protected readonly isLoading = signal(true);
  protected readonly isDetailLoading = signal(false);
  protected readonly isInvoicePreviewLoading = signal(false);
  protected readonly isApproving = signal(false);
  protected readonly isRejecting = signal(false);
  protected readonly isExporting = signal(false);
  protected readonly activeTab = signal<ApprovalTabId>('all');
  protected readonly inspectorTab = signal<ApprovalInspectorTabId>('details');
  protected readonly searchQuery = signal('');
  protected readonly actionComment = signal('');
  protected readonly rejectReason = signal('');
  private readonly pageByTab = signal<Record<ApprovalTabId, number>>({
    all: 1,
    pending: 1,
    resolved: 1,
  });
  protected readonly queueSnapshots = signal<ApprovalQueueSnapshots>({
    all: null,
    pending: null,
    approved: null,
    rejected: null,
    resolved: null,
  });
  private readonly apiError = signal<string | null>(null);
  private readonly detailError = signal<string | null>(null);
  private readonly invoicePreviewError = signal<string | null>(null);
  private readonly actionError = signal<string | null>(null);
  private readonly exportErrorSignal = signal<string | null>(null);
  private readonly selectedApprovalId = signal<string | null>(null);
  private readonly selectedApprovalDetail = signal<ApprovalInspectorDetail | null>(null);
  private readonly selectedApprovalInvoicePreview = signal<ApprovalInvoicePreview | null>(null);
  private readonly isInspectorDismissed = signal(false);
  private readonly detailCache = new Map<string, ApprovalInspectorDetail>();
  private readonly invoicePreviewCache = new Map<string, ApprovalInvoicePreview>();
  private detailRequestSequence = 0;
  private invoicePreviewRequestSequence = 0;
  private queueRequestSequence = 0;

  protected readonly loadError = computed(() => this.apiError());
  protected readonly exportError = computed(() => this.exportErrorSignal());
  protected readonly activeQueue = computed(() => {
    const snapshots = this.queueSnapshots();
    if (this.activeTab() === 'pending') {
      return snapshots.pending;
    }

    if (this.activeTab() === 'resolved') {
      return snapshots.resolved;
    }

    return snapshots.all;
  });
  protected readonly visibleRows = computed(() => this.activeQueue()?.items ?? []);
  protected readonly pagination = computed(() => {
    const queue = this.activeQueue();
    if (!queue) {
      return {
        page: 1,
        pageSize: this.queuePageSize,
        totalCount: 0,
        totalPages: 1,
        start: 0,
        end: 0,
      };
    }

    const start = queue.totalCount ? (queue.page - 1) * queue.pageSize + 1 : 0;
    const end = Math.min(queue.totalCount, start + queue.items.length - 1);

    return {
      page: queue.page,
      pageSize: queue.pageSize,
      totalCount: queue.totalCount,
      totalPages: Math.max(queue.totalPages, 1),
      start,
      end,
    };
  });
  protected readonly selectedQueueRow = computed(
    () =>
      this.isInspectorDismissed()
        ? null
        : this.visibleRows().find((row) => row.id === this.selectedApprovalId()) ?? null,
  );
  protected readonly inspectorDetail = computed(() => this.selectedApprovalDetail());
  protected readonly invoicePreviewImageUrl = computed(() => {
    const preview = this.selectedApprovalInvoicePreview();
    if (!preview?.previewImageDataUrl || preview.contentType === 'application/pdf') {
      return null;
    }

    return preview.previewImageDataUrl;
  });
  protected readonly invoicePreviewPdfUrl = computed<SafeResourceUrl | null>(() => {
    const preview = this.selectedApprovalInvoicePreview();
    if (!preview?.previewImageDataUrl || preview.contentType !== 'application/pdf') {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(preview.previewImageDataUrl);
  });
  protected readonly invoicePreviewFileName = computed(
    () =>
      this.selectedApprovalInvoicePreview()?.originalFileName ||
      this.selectedQueueRow()?.requestTitle ||
      'Chứng từ đính kèm',
  );
  protected readonly inspectorTabs: ApprovalInspectorTab[] = [
    { id: 'details', label: 'Chi tiết' },
    { id: 'invoice', label: 'Hoá đơn' },
    { id: 'notes', label: 'Ghi chú' },
    { id: 'history', label: 'Lịch sử' },
    { id: 'actions', label: 'Hành động' },
  ];
  protected readonly inspectorError = computed(
    () => this.detailError() ?? this.actionError() ?? this.exportError(),
  );
  protected readonly invoiceError = computed(() => this.invoicePreviewError());
  protected readonly tabs = computed<ApprovalTab[]>(() => {
    const snapshots = this.queueSnapshots();
    const resolvedCount = snapshots.resolved?.totalCount ?? 0;

    return [
      { id: 'all', label: `All (${snapshots.all?.totalCount ?? 0})` },
      { id: 'pending', label: `Pending (${snapshots.pending?.totalCount ?? 0})` },
      { id: 'resolved', label: `Resolved (${resolvedCount})` },
    ];
  });
  protected readonly kpis = computed<ApprovalKpi[]>(() => {
    const snapshots = this.queueSnapshots();
    const allRows = snapshots.all?.items ?? [];

    return [
      {
        id: 'pending',
        label: 'Pending Review',
        value: String(snapshots.pending?.totalCount ?? 0),
      },
      {
        id: 'approved',
        label: 'Approved (Month)',
        value: String(snapshots.approved?.totalCount ?? 0),
      },
      {
        id: 'rejected',
        label: 'Rejected (Month)',
        value: String(snapshots.rejected?.totalCount ?? 0),
      },
      {
        id: 'resolved',
        label: 'Resolved',
        value: String(snapshots.resolved?.totalCount ?? 0),
      },
    ];
  });
  protected readonly summaryLine = computed(() => {
    const snapshots = this.queueSnapshots();
    const resolvedCount = snapshots.resolved?.totalCount ?? 0;
    return `${snapshots.pending?.totalCount ?? 0} pending · ${resolvedCount} resolved this period`;
  });

  constructor() {
    effect(() => {
      const search = this.normalizeOptionalValue(this.searchQuery());
      this.pageByTab();
      this.loadApprovalQueues(search);
    });
  }

  protected setActiveTab(tabId: ApprovalTabId): void {
    this.activeTab.set(tabId);
    this.syncSelection();
  }

  protected updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
    this.pageByTab.set({
      all: 1,
      pending: 1,
      resolved: 1,
    });
  }

  protected updateActionComment(value: string): void {
    this.actionComment.set(value);
  }

  protected updateRejectReason(value: string): void {
    this.rejectReason.set(value);
  }

  protected setInspectorTab(tabId: ApprovalInspectorTabId): void {
    this.inspectorTab.set(tabId);
  }

  protected selectApproval(approvalId: string): void {
    this.setSelectedApproval(approvalId);
  }

  protected closeInspector(): void {
    this.isInspectorDismissed.set(true);
  }

  protected previousPage(): void {
    const activeTab = this.activeTab();
    const currentPage = this.pageByTab()[activeTab];
    if (currentPage <= 1) {
      return;
    }

    this.pageByTab.update((pages) => ({
      ...pages,
      [activeTab]: currentPage - 1,
    }));
  }

  protected nextPage(): void {
    const activeTab = this.activeTab();
    const pagination = this.pagination();
    if (pagination.page >= pagination.totalPages) {
      return;
    }

    this.pageByTab.update((pages) => ({
      ...pages,
      [activeTab]: pages[activeTab] + 1,
    }));
  }

  protected exportCurrentQueue(): void {
    if (this.isExporting()) {
      return;
    }

    this.exportErrorSignal.set(null);
    this.isExporting.set(true);
    const search = this.normalizeOptionalValue(this.searchQuery());

    const request =
      this.activeTab() === 'resolved'
        ? forkJoin({
            approved: this.approvalsApi.exportApprovalQueue('APPROVED', search),
            rejected: this.approvalsApi.exportApprovalQueue('REJECTED', search),
          }).pipe(
            map(({ approved, rejected }) => this.combineExportPayloads(approved, rejected, search)),
          )
        : this.approvalsApi.exportApprovalQueue(this.toStatusFilter(this.activeTab()), search);

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (response) => {
        this.isExporting.set(false);
        this.triggerDownload(response);
      },
      error: (error: Error) => {
        this.isExporting.set(false);
        this.exportErrorSignal.set(error.message);
      },
    });
  }

  protected approveSelectedApproval(): void {
    const approvalId = this.selectedApprovalId();
    if (!approvalId || this.isApproving() || this.isRejecting()) {
      return;
    }

    this.actionError.set(null);
    this.isApproving.set(true);

    this.approvalsApi
      .approveReviewedDocument(approvalId, this.normalizeOptionalValue(this.actionComment()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isApproving.set(false);
          this.applyActionResponse(response);
        },
        error: (error: Error) => {
          this.isApproving.set(false);
          this.actionError.set(error.message);
        },
      });
  }

  protected rejectSelectedApproval(): void {
    const approvalId = this.selectedApprovalId();
    const decisionNote = this.actionComment().trim();
    const explicitReason = this.rejectReason().trim();
    const reason = explicitReason || decisionNote;
    const comment = decisionNote && decisionNote !== reason ? decisionNote : null;

    if (!approvalId || this.isApproving() || this.isRejecting()) {
      return;
    }

    if (!reason) {
      this.actionError.set('A rejection reason is required before submitting.');
      return;
    }

    this.actionError.set(null);
    this.isRejecting.set(true);

    this.approvalsApi
      .rejectReviewedDocument(
        approvalId,
        reason,
        this.normalizeOptionalValue(comment),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.isRejecting.set(false);
          this.applyActionResponse(response);
        },
        error: (error: Error) => {
          this.isRejecting.set(false);
          this.actionError.set(error.message);
        },
      });
  }

  private loadApprovalQueues(search: string | null): void {
    const requestSequence = ++this.queueRequestSequence;
    const pages = this.pageByTab();
    this.isLoading.set(true);
    this.apiError.set(null);
    this.exportErrorSignal.set(null);

    forkJoin({
      all: this.approvalsApi.getApprovalQueue('ALL', search, pages.all, this.queuePageSize),
      pending: this.approvalsApi.getApprovalQueue(
        'PENDING',
        search,
        pages.pending,
        this.queuePageSize,
      ),
      resolved: this.loadResolvedQueue(search, pages.resolved, this.queuePageSize),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ all, pending, resolved }) => {
          if (requestSequence !== this.queueRequestSequence) {
            return;
          }

          this.queueSnapshots.set({
            all: this.toQueueSnapshot(all),
            pending: this.toQueueSnapshot(pending),
            approved: resolved.approved,
            rejected: resolved.rejected,
            resolved: resolved.combined,
          });
          this.apiError.set(null);
          this.isLoading.set(false);
          this.syncSelection();
        },
        error: (error: Error) => {
          if (requestSequence !== this.queueRequestSequence) {
            return;
          }

          this.queueSnapshots.set({
            all: null,
            pending: null,
            approved: null,
            rejected: null,
            resolved: null,
          });
          this.selectedApprovalId.set(null);
          this.selectedApprovalDetail.set(null);
          this.selectedApprovalInvoicePreview.set(null);
          this.apiError.set(error.message);
          this.isLoading.set(false);
        },
      });
  }

  private syncSelection(): void {
    const rows = this.visibleRows();
    const currentSelection = this.selectedApprovalId();

    if (!rows.length) {
      this.clearSelection();
      return;
    }

    if (currentSelection && !rows.some((row) => row.id === currentSelection)) {
      this.setSelectedApproval(rows[0].id);
      return;
    }

    if (!currentSelection) {
      this.setSelectedApproval(rows[0].id);
    }
  }

  private setSelectedApproval(approvalId: string): void {
    if (
      this.selectedApprovalId() === approvalId &&
      this.selectedApprovalDetail()?.id === approvalId
    ) {
      return;
    }

    this.selectedApprovalId.set(approvalId);
    this.detailError.set(null);
    this.invoicePreviewError.set(null);
    this.actionError.set(null);
    this.actionComment.set('');
    this.rejectReason.set('');
    this.isInspectorDismissed.set(false);
    this.inspectorTab.set('details');
    this.loadInvoicePreview(approvalId);

    const cachedDetail = this.detailCache.get(approvalId);
    if (cachedDetail) {
      this.selectedApprovalDetail.set(cachedDetail);
      this.isDetailLoading.set(false);
      return;
    }

    this.selectedApprovalDetail.set(null);
    this.loadApprovalDetail(approvalId);
  }

  private clearSelection(): void {
    this.selectedApprovalId.set(null);
    this.selectedApprovalDetail.set(null);
    this.selectedApprovalInvoicePreview.set(null);
    this.detailError.set(null);
    this.invoicePreviewError.set(null);
    this.actionError.set(null);
    this.actionComment.set('');
    this.rejectReason.set('');
    this.isInspectorDismissed.set(false);
    this.inspectorTab.set('details');
  }

  private loadApprovalDetail(approvalId: string): void {
    const requestSequence = ++this.detailRequestSequence;
    this.isDetailLoading.set(true);

    this.approvalsApi
      .getApprovalDetail(approvalId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          if (requestSequence !== this.detailRequestSequence) {
            return;
          }

          this.isDetailLoading.set(false);

          if (!detail) {
            this.selectedApprovalDetail.set(null);
            this.detailError.set('Approval detail was not returned for the selected request.');
            return;
          }

          const inspectorDetail = this.toApprovalInspectorDetail(detail);
          this.detailCache.set(approvalId, inspectorDetail);
          this.selectedApprovalDetail.set(inspectorDetail);
          this.detailError.set(null);
        },
        error: (error: Error) => {
          if (requestSequence !== this.detailRequestSequence) {
            return;
          }

          this.isDetailLoading.set(false);
          this.selectedApprovalDetail.set(null);
          this.detailError.set(error.message);
        },
      });
  }

  private loadInvoicePreview(approvalId: string): void {
    const cachedPreview = this.invoicePreviewCache.get(approvalId);
    if (cachedPreview) {
      this.selectedApprovalInvoicePreview.set(cachedPreview);
      this.isInvoicePreviewLoading.set(false);
      this.invoicePreviewError.set(null);
      return;
    }

    const requestSequence = ++this.invoicePreviewRequestSequence;
    this.selectedApprovalInvoicePreview.set(null);
    this.isInvoicePreviewLoading.set(true);
    this.invoicePreviewError.set(null);

    this.documentsApi
      .getMySubmittedDocument(approvalId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (document) => {
          if (requestSequence !== this.invoicePreviewRequestSequence) {
            return;
          }

          this.isInvoicePreviewLoading.set(false);
          const preview = this.toInvoicePreview(document);
          this.invoicePreviewCache.set(approvalId, preview);
          this.selectedApprovalInvoicePreview.set(preview);

          this.invoicePreviewError.set(
            preview.previewImageDataUrl
              ? null
              : 'Chứng từ này chưa có bản xem trước đính kèm.',
          );
        },
        error: () => {
          if (requestSequence !== this.invoicePreviewRequestSequence) {
            return;
          }

          this.isInvoicePreviewLoading.set(false);
          this.selectedApprovalInvoicePreview.set(null);
          this.invoicePreviewError.set(
            'API hiện chưa trả file xem trước cho yêu cầu phê duyệt này.',
          );
        },
      });
  }

  private applyActionResponse(response: ReviewedApprovalActionResponse): void {
    const currentRow =
      this.queueSnapshots()
        .all?.items.find((row) => row.id === response.documentId) ?? this.selectedQueueRow();
    if (!currentRow) {
      return;
    }

    const updatedRow: ApprovalRow = {
      ...currentRow,
      status: response.status,
      statusTone: this.normalizeStatusTone(response.status),
    };
    this.queueSnapshots.update((snapshots) => ({
      all: this.replaceQueueRow(snapshots.all, updatedRow),
      pending:
        updatedRow.statusTone === 'pending'
          ? this.replaceQueueRow(snapshots.pending, updatedRow)
          : this.removeQueueRow(snapshots.pending, updatedRow.id),
      approved:
        updatedRow.statusTone === 'approved'
          ? this.upsertQueueRow(snapshots.approved, updatedRow)
          : this.removeQueueRow(snapshots.approved, updatedRow.id),
      rejected:
        updatedRow.statusTone === 'rejected'
          ? this.upsertQueueRow(snapshots.rejected, updatedRow)
          : this.removeQueueRow(snapshots.rejected, updatedRow.id),
      resolved:
        updatedRow.statusTone === 'pending'
          ? this.removeQueueRow(snapshots.resolved, updatedRow.id)
          : this.upsertQueueRow(snapshots.resolved, updatedRow),
    }));

    this.selectedApprovalDetail.update((detail) => {
      if (!detail || detail.id !== response.documentId) {
        return detail;
      }

      const statusTone = updatedRow.statusTone;
      return {
        ...detail,
        status: response.status,
        statusTone,
      };
    });

    this.actionComment.set('');
    this.rejectReason.set('');
    this.syncSelection();
  }

  private replaceQueueRow(
    snapshot: ApprovalQueueSnapshot | null,
    updatedRow: ApprovalRow,
  ): ApprovalQueueSnapshot | null {
    if (!snapshot) {
      return snapshot;
    }

    return {
      ...snapshot,
      items: snapshot.items.map((row) => (row.id === updatedRow.id ? updatedRow : row)),
    };
  }

  private removeQueueRow(
    snapshot: ApprovalQueueSnapshot | null,
    approvalId: string,
  ): ApprovalQueueSnapshot | null {
    if (!snapshot || !snapshot.items.some((row) => row.id === approvalId)) {
      return snapshot;
    }

    return {
      ...snapshot,
      items: snapshot.items.filter((row) => row.id !== approvalId),
      totalCount: Math.max(0, snapshot.totalCount - 1),
    };
  }

  private upsertQueueRow(
    snapshot: ApprovalQueueSnapshot | null,
    updatedRow: ApprovalRow,
  ): ApprovalQueueSnapshot | null {
    if (!snapshot) {
      return snapshot;
    }

    const exists = snapshot.items.some((row) => row.id === updatedRow.id);

    return {
      ...snapshot,
      items: exists
        ? snapshot.items.map((row) => (row.id === updatedRow.id ? updatedRow : row))
        : [updatedRow, ...snapshot.items],
      totalCount: exists ? snapshot.totalCount : snapshot.totalCount + 1,
    };
  }

  private toQueueSnapshot(response: ApprovalQueuePageResponse): ApprovalQueueSnapshot {
    return {
      items: response.items.map((item) => this.toApprovalRow(item)),
      page: response.page,
      pageSize: response.pageSize,
      totalCount: response.totalCount,
      totalPages: response.totalPages,
    };
  }

  private toApprovalRow(item: PendingApprovalItemResponse): ApprovalRow {
    const requestCode = this.normalizeRequestCode(item.title, item.documentId);
    const requestTitle = item.title.trim() || requestCode;
    const rawVendorLabel = item.vendorName.trim();
    const rawRequesterEmail = item.requesterEmail.trim();
    const rawDepartment = item.department.trim();
    const rawPolicySummary = item.policySummary?.trim() ?? '';
    const vendorLabel = rawVendorLabel || 'Chưa có nhà cung cấp';
    const department = rawDepartment || 'Chưa có phòng ban';
    const requesterEmail = rawRequesterEmail || 'Chưa có email người gửi';
    const statusTone = this.normalizeStatusTone(item.status);
    return {
      id: item.documentId,
      requestCode,
      requestTitle,
      requester: item.requester,
      requesterEmail,
      requesterInitials: this.toInitials(item.requester),
      vendorLabel,
      department,
      amountValue: item.amount,
      amountDisplay: this.formatCurrency(item.amount, item.currency),
      currency: item.currency,
      expenseDateValue: item.expenseDate,
      submittedAtValue: item.submittedAt,
      expenseDateLabel: this.formatDate(item.expenseDate),
      submittedLabel: this.formatDateTime(item.submittedAt),
      status: item.status,
      statusTone,
      summary: `Yêu cầu ${requestTitle.toLowerCase()} được gửi bởi ${item.requester}.`,
      policySummary: rawPolicySummary || 'Chưa có tóm tắt chính sách phê duyệt.',
    };
  }

  private toApprovalInspectorDetail(detail: ApprovalDetailResponse): ApprovalInspectorDetail {
    const rawVendorLabel = detail.vendorName.trim();
    const rawRequesterEmail = detail.requesterEmail.trim();
    const rawDepartment = detail.department.trim();
    const rawPolicySummary = detail.policySummary?.trim() ?? '';
    const statusTone = this.normalizeStatusTone(detail.status);
    const lineItems = detail.lineItems.map((lineItem) => {
      const gross = lineItem.quantity * lineItem.unitPrice;
      const discount = Math.max(0, gross - lineItem.total);

      return {
        description: lineItem.description,
        quantityLabel: this.formatNumber(lineItem.quantity),
        unitPriceLabel: this.formatCurrency(lineItem.unitPrice, detail.currency),
        grossLabel: this.formatCurrency(gross, detail.currency),
        discountLabel: discount > 0 ? `-${this.formatCurrency(discount, detail.currency)}` : '—',
        netLabel: this.formatCurrency(lineItem.total, detail.currency),
      };
    });
    const grossSubtotal = detail.lineItems.reduce(
      (sum, lineItem) => sum + lineItem.quantity * lineItem.unitPrice,
      0,
    );
    const netSubtotal = detail.lineItems.reduce((sum, lineItem) => sum + lineItem.total, 0);
    const effectiveGrossSubtotal = grossSubtotal || detail.amount;
    const totalDiscount = Math.max(0, grossSubtotal - netSubtotal);
    const taxableBase = effectiveGrossSubtotal - totalDiscount;
    const vat = Math.max(0, detail.amount - taxableBase);

    return {
      id: detail.documentId,
      requestCode: detail.requestCode,
      title: detail.title.trim() || detail.requestCode,
      vendorLabel: rawVendorLabel || 'Chưa có nhà cung cấp',
      currency: detail.currency,
      priority: this.priorityLabel(detail.priority),
      requester: detail.requesterName,
      requesterInitials: this.toInitials(detail.requesterName),
      requesterEmail: rawRequesterEmail || 'Chưa có email người gửi',
      department: rawDepartment || 'Chưa có phòng ban',
      amountDisplay: this.formatCurrency(detail.amount, detail.currency),
      expenseDateValue: detail.expenseDate,
      expenseDateLabel: this.formatDate(detail.expenseDate),
      submittedAtValue: detail.submittedAt,
      submittedLabel: this.formatDateTime(detail.submittedAt),
      status: detail.status,
      statusTone,
      policySummary: rawPolicySummary || 'Chưa có tóm tắt chính sách phê duyệt.',
      lineItems,
      grossSubtotalDisplay: this.formatCurrency(effectiveGrossSubtotal, detail.currency),
      totalDiscountDisplay: totalDiscount > 0 ? `-${this.formatCurrency(totalDiscount, detail.currency)}` : '—',
      vatDisplay: vat > 0 ? this.formatCurrency(vat, detail.currency) : '—',
      grandTotalDisplay: this.formatCurrency(detail.amount, detail.currency),
      hasDiscount: totalDiscount > 0,
      hasVat: vat > 0,
    };
  }

  private toInvoicePreview(document: SubmittedDocumentDetailResponse): ApprovalInvoicePreview {
    return {
      originalFileName: document.originalFileName || document.reference || document.documentId,
      contentType: document.contentType,
      previewImageDataUrl: document.previewImageDataUrl ?? null,
    };
  }

  private toStatusFilter(tabId: ApprovalTabId): ApprovalStatusFilter {
    if (tabId === 'pending') {
      return 'PENDING';
    }

    if (tabId === 'resolved') {
      return 'APPROVED';
    }

    return 'ALL';
  }

  private loadResolvedQueue(search: string | null, page: number, pageSize: number) {
    const pages = Array.from({ length: page }, (_, index) => index + 1);

    return forkJoin({
      approvedPages: forkJoin(
        pages.map((pageIndex) =>
          this.approvalsApi.getApprovalQueue('APPROVED', search, pageIndex, pageSize),
        ),
      ),
      rejectedPages: forkJoin(
        pages.map((pageIndex) =>
          this.approvalsApi.getApprovalQueue('REJECTED', search, pageIndex, pageSize),
        ),
      ),
    }).pipe(
      map(({ approvedPages, rejectedPages }) => {
        const approvedCurrent = approvedPages[approvedPages.length - 1];
        const rejectedCurrent = rejectedPages[rejectedPages.length - 1];
        const totalCount = (approvedCurrent?.totalCount ?? 0) + (rejectedCurrent?.totalCount ?? 0);
        const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
        const mergedRows = [
          ...approvedPages.flatMap((response) => response.items),
          ...rejectedPages.flatMap((response) => response.items),
        ]
          .map((item) => this.toApprovalRow(item))
          .sort((left, right) => right.submittedAtValue.localeCompare(left.submittedAtValue));
        const startIndex = (page - 1) * pageSize;

        return {
          approved: this.toQueueSnapshot(approvedCurrent),
          rejected: this.toQueueSnapshot(rejectedCurrent),
          combined: {
            items: mergedRows.slice(startIndex, startIndex + pageSize),
            page,
            pageSize,
            totalCount,
            totalPages,
          } satisfies ApprovalQueueSnapshot,
        };
      }),
    );
  }

  private combineExportPayloads(
    approved: ExportApprovalQueueResponse,
    rejected: ExportApprovalQueueResponse,
    search: string | null,
  ): ExportApprovalQueueResponse {
    const approvedCsv = this.decodeDataUrlCsv(approved.downloadUrl);
    const rejectedCsv = this.decodeDataUrlCsv(rejected.downloadUrl);
    const mergedCsv = this.mergeCsvDocuments(approvedCsv, rejectedCsv);
    const fileSuffix = search ? `resolved-${search.toLowerCase().replace(/\s+/g, '-')}` : 'resolved';

    return {
      fileName: `approvals-${fileSuffix}.csv`,
      downloadUrl: `data:text/csv;base64,${this.toBase64(mergedCsv)}`,
    };
  }

  private decodeDataUrlCsv(dataUrl: string): string {
    const [, encoded = ''] = dataUrl.split(',', 2);
    return this.fromBase64(encoded);
  }

  private mergeCsvDocuments(primaryCsv: string, secondaryCsv: string): string {
    const primaryLines = primaryCsv.split(/\r?\n/).filter((line) => line.length > 0);
    const secondaryLines = secondaryCsv.split(/\r?\n/).filter((line) => line.length > 0);

    if (!primaryLines.length) {
      return secondaryLines.join('\n');
    }

    if (!secondaryLines.length) {
      return primaryLines.join('\n');
    }

    return [primaryLines[0], ...primaryLines.slice(1), ...secondaryLines.slice(1)].join('\n');
  }

  private triggerDownload(response: ExportApprovalQueueResponse): void {
    if (typeof document === 'undefined') {
      return;
    }

    if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) {
      return;
    }

    const link = document.createElement('a');
    link.href = response.downloadUrl;
    link.download = response.fileName;
    link.rel = 'noopener';
    link.click();
  }

  private normalizeRequestCode(title: string, documentId: string): string {
    const trimmedTitle = title.trim();
    if (/^[a-z]{2,5}[-\s]?\d{3,}$/i.test(trimmedTitle)) {
      return trimmedTitle.toUpperCase().replace(/\s+/g, '-');
    }

    if (documentId.length > 12) {
      const compact = documentId.replace(/[^a-z0-9]/gi, '').slice(0, 8).toUpperCase();
      return compact ? `APR-${compact}` : 'APR-UNKNOWN';
    }

    return documentId.toUpperCase();
  }

  private toInitials(value: string): string {
    const parts = value
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) {
      return 'NA';
    }

    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
  }

  private priorityLabel(value: string | null | undefined): string {
    const normalized = (value ?? '').trim().toLowerCase();
    if (!normalized) return 'Chưa xác định';
    if (normalized.includes('urgent') || normalized.includes('critical')) return 'Khẩn cấp';
    if (normalized.includes('high')) return 'Cao';
    if (normalized.includes('medium') || normalized.includes('normal')) return 'Trung bình';
    if (normalized.includes('low')) return 'Thấp';
    return value?.trim() || 'Chưa xác định';
  }

  private normalizeStatusTone(status: string): ApprovalStatusTone {
    const normalized = status.trim().toLowerCase();

    if (
      normalized.includes('approved') ||
      normalized.includes('resolved') ||
      normalized.includes('completed')
    ) {
      return 'approved';
    }

    if (
      normalized.includes('reject') ||
      normalized.includes('declin') ||
      normalized.includes('denied')
    ) {
      return 'rejected';
    }

    if (
      normalized.includes('pending') ||
      normalized.includes('review') ||
      normalized.includes('waiting') ||
      normalized.includes('readyforapproval') ||
      normalized.includes('ready for approval')
    ) {
      return 'pending';
    }

    return 'default';
  }

  private normalizeOptionalValue(value: string | null): string | null {
    const normalized = value?.trim() ?? '';
    return normalized ? normalized : null;
  }

  private formatCurrency(value: number, currencyCode: string): string {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode || 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    }
  }

  private formatNumber(value: number): string {
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: 2,
    }).format(value);
  }

  private formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  private toBase64(value: string): string {
    if (typeof btoa === 'function') {
      return btoa(value);
    }

    throw new Error('Base64 encoding is unavailable in the current runtime.');
  }

  private fromBase64(value: string): string {
    if (typeof atob === 'function') {
      return atob(value);
    }

    throw new Error('Base64 decoding is unavailable in the current runtime.');
  }
}
