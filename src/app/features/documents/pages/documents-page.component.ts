import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DocumentSurfaceCardComponent } from '../components/workspace/document-surface-card.component';
import { DocumentWorkspaceHeaderComponent } from '../components/workspace/document-workspace-header.component';
import {
  DocumentsApiService,
  MyDocumentDraftResponse,
  MySubmittedDocumentResponse,
} from '../data/documents-api.service';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { CurrentSubscriptionFacade } from '../../subscription/data/current-subscription.facade';

interface DocumentsTab {
  id: 'drafts' | 'submitted';
  label: string;
}

interface DocumentsRow {
  documentId: string;
  reference: string;
  vendor: string;
  category: string;
  source: 'Manual' | 'OCR';
  amount: string;
  status: string;
  statusTone: 'draft' | 'review' | 'approved' | 'rejected' | 'correction' | 'default';
  updated: string;
  actionMode: 'resume' | 'view' | null;
}

@Component({
  selector: 'app-documents-page',
  standalone: true,
  imports: [CommonModule, RouterLink, DocumentWorkspaceHeaderComponent, DocumentSurfaceCardComponent],
  templateUrl: './documents-page.component.html',
  styleUrl: './documents-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPageComponent {
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);
  private readonly currentSubscriptionFacade = inject(CurrentSubscriptionFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly pageCopy =
    'Theo dõi các chứng từ chi phí, bản nháp đang xử lý và hồ sơ đã gửi phê duyệt trong cùng một workspace.';
  protected readonly activeTab = signal<'drafts' | 'submitted'>('drafts');
  protected readonly searchQuery = signal('');
  protected readonly sourceFilter = signal('');
  protected readonly statusFilter = signal('');
  protected readonly categoryFilter = signal('');
  protected readonly workspaceState = this.currentWorkspaceFacade.state;
  protected readonly subscriptionState = this.currentSubscriptionFacade.state;
  protected readonly draftRows = signal<DocumentsRow[]>([]);
  protected readonly submittedRows = signal<DocumentsRow[]>([]);
  protected readonly draftsLoading = signal(true);
  protected readonly submittedLoading = signal(true);
  protected readonly draftsError = signal<string | null>(null);
  protected readonly submittedError = signal<string | null>(null);
  protected readonly tabs = computed<DocumentsTab[]>(() => [
    { id: 'drafts', label: `Bản nháp (${this.draftRows().length})` },
    { id: 'submitted', label: `Đã trình (${this.submittedRows().length})` },
  ]);
  protected readonly totalDocumentCount = computed(
    () => this.draftRows().length + this.submittedRows().length,
  );
  protected readonly baseRows = computed(() =>
    this.activeTab() === 'drafts' ? this.draftRows() : this.submittedRows(),
  );
  protected readonly rows = computed(() => {
    const searchQuery = this.searchQuery().trim().toLowerCase();
    const sourceFilter = this.sourceFilter();
    const statusFilter = this.statusFilter();
    const categoryFilter = this.categoryFilter();

    return this.baseRows().filter((row) => {
      const matchesSearch =
        !searchQuery ||
        row.reference.toLowerCase().includes(searchQuery) ||
        row.vendor.toLowerCase().includes(searchQuery);
      const matchesSource = !sourceFilter || row.source === sourceFilter;
      const matchesStatus = !statusFilter || row.status === statusFilter;
      const matchesCategory = !categoryFilter || row.category === categoryFilter;

      return matchesSearch && matchesSource && matchesStatus && matchesCategory;
    });
  });
  protected readonly statusBanner = computed(() =>
    this.activeTab() === 'drafts'
      ? 'Giai đoạn 1/3: Tạo và hoàn thiện chứng từ chi phí. Khi sẵn sàng, hồ sơ sẽ chuyển sang hàng chờ phê duyệt.'
      : 'Giai đoạn 2/3: Theo dõi hồ sơ đã gửi, phản hồi từ quản lý và các trường hợp cần bổ sung thông tin.',
  );
  protected readonly activeError = computed(() =>
    this.activeTab() === 'drafts' ? this.draftsError() : this.submittedError(),
  );
  protected readonly activeLoading = computed(() =>
    this.activeTab() === 'drafts' ? this.draftsLoading() : this.submittedLoading(),
  );
  protected readonly categoryOptions = computed(() =>
    Array.from(new Set([...this.draftRows(), ...this.submittedRows()].map((row) => row.category))).sort(),
  );
  protected readonly statusOptions = computed(() =>
    Array.from(new Set(this.baseRows().map((row) => row.status))).sort(),
  );
  protected readonly hasActiveFilters = computed(
    () =>
      !!this.searchQuery().trim() ||
      !!this.sourceFilter() ||
      !!this.statusFilter() ||
      !!this.categoryFilter(),
  );
  protected readonly emptyStateCopy = computed(() =>
    this.hasActiveFilters() && this.baseRows().length
      ? 'Không có chứng từ nào khớp với bộ lọc hiện tại.'
      : this.activeTab() === 'drafts'
        ? 'Chưa có bản nháp nào.'
        : 'Chưa có chứng từ nào được gửi.',
  );
  protected readonly submittedWarning = computed(() => {
    if (this.activeTab() !== 'submitted') {
      return null;
    }

    const needsAttention = this.rows().some(
      (row) => row.statusTone === 'rejected' || row.statusTone === 'correction',
    );

    return needsAttention
      ? 'Cần chú ý: Có chứng từ bị từ chối hoặc yêu cầu bổ sung. Mở chi tiết để kiểm tra và gửi lại.'
      : null;
  });
  protected readonly canUploadWithOcr = computed(() => {
    const subscription = this.subscriptionState().subscription;
    if (!subscription?.entitlements.documentsOcrEnabled) {
      return false;
    }

    return subscription.currentMemberUsage.remainingOcrPages > 0 ||
      subscription.entitlements.memberMonthlyOcrPages <= 0;
  });
  protected readonly canCreateManualDocument = computed(
    () => this.subscriptionState().subscription?.entitlements.documentsManualEntryEnabled ?? true,
  );

  constructor() {
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const tab = params.get('tab');
      if (tab === 'drafts' || tab === 'submitted') {
        this.activeTab.set(tab);
      }

      this.searchQuery.set(params.get('q') ?? '');
      this.sourceFilter.set(params.get('source') ?? '');
      this.statusFilter.set(params.get('status') ?? '');
      this.categoryFilter.set(params.get('category') ?? '');
    });

    this.loadDrafts();
    this.loadSubmittedDocuments();
    effect(() => {
      this.currentSubscriptionFacade.ensureLoaded(
        this.workspaceState().workspace?.tenantId ?? null,
      );
    });
  }

  protected setActiveTab(tabId: 'drafts' | 'submitted'): void {
    this.activeTab.set(tabId);
    this.syncQueryParams();
  }

  protected updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
    this.syncQueryParams();
  }

  protected updateSourceFilter(value: string): void {
    this.sourceFilter.set(value);
    this.syncQueryParams();
  }

  protected updateStatusFilter(value: string): void {
    this.statusFilter.set(value);
    this.syncQueryParams();
  }

  protected updateCategoryFilter(value: string): void {
    this.categoryFilter.set(value);
    this.syncQueryParams();
  }

  protected handleRowAction(row: DocumentsRow, event?: Event): void {
    event?.stopPropagation();

    if (row.actionMode === 'view') {
      void this.router.navigate(['/app/documents/submitted', row.documentId]);
      return;
    }

    if (row.actionMode !== 'resume') {
      return;
    }

    void this.router.navigate(['/app/documents', row.documentId]);
  }

  protected badgeClass(tone: DocumentsRow['statusTone']): string {
    switch (tone) {
      case 'review':
      case 'correction':
        return 'bg-amber-50 text-amber-700 ring-amber-100';
      case 'approved':
        return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
      case 'rejected':
        return 'bg-rose-50 text-rose-700 ring-rose-100';
      default:
        return 'bg-slate-100 text-slate-700 ring-slate-200';
    }
  }

  protected sourceBadgeClass(source: DocumentsRow['source']): string {
    return source === 'OCR'
      ? 'bg-violet-50 text-violet-700 ring-violet-100'
      : 'bg-slate-100 text-slate-700 ring-slate-200';
  }

  private syncQueryParams(): void {
    const queryParams: Record<string, string> = {
      tab: this.activeTab(),
    };

    if (this.searchQuery().trim()) {
      queryParams['q'] = this.searchQuery().trim();
    }

    if (this.sourceFilter()) {
      queryParams['source'] = this.sourceFilter();
    }

    if (this.statusFilter()) {
      queryParams['status'] = this.statusFilter();
    }

    if (this.categoryFilter()) {
      queryParams['category'] = this.categoryFilter();
    }

    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams,
      replaceUrl: true,
    });
  }

  private loadDrafts(): void {
    this.draftsLoading.set(true);
    this.draftsError.set(null);

    this.documentsApi
      .getMyDocumentDrafts()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (drafts) => {
          this.draftRows.set(drafts.map((draft) => this.mapDraftRow(draft)));
          this.draftsLoading.set(false);
        },
        error: (error: Error) => {
          this.draftRows.set([]);
          this.draftsError.set(error.message);
          this.draftsLoading.set(false);
        },
      });
  }

  private loadSubmittedDocuments(): void {
    this.submittedLoading.set(true);
    this.submittedError.set(null);

    this.documentsApi
      .getMySubmittedDocuments()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (items) => {
          this.submittedRows.set(items.map((item) => this.mapSubmittedRow(item)));
          this.submittedLoading.set(false);
        },
        error: (error: Error) => {
          this.submittedRows.set([]);
          this.submittedError.set(error.message);
          this.submittedLoading.set(false);
        },
      });
  }

  private mapDraftRow(draft: MyDocumentDraftResponse): DocumentsRow {
    return {
      documentId: draft.documentId,
      reference: draft.reference,
      vendor: draft.vendorName,
      category: draft.category,
      source: this.normalizeSource(draft.source),
      amount: this.formatAmount(draft.totalAmount),
      status: 'Bản nháp',
      statusTone: 'draft',
      updated: this.formatUpdatedAt(draft.uploadedAt),
      actionMode: 'resume',
    };
  }

  private mapSubmittedRow(item: MySubmittedDocumentResponse): DocumentsRow {
    return {
      documentId: item.documentId,
      reference: item.reference,
      vendor: item.vendorName,
      category: item.category,
      source: this.normalizeSource(item.source),
      amount: this.formatAmount(item.totalAmount),
      status: item.status,
      statusTone: this.normalizeStatusTone(item.status),
      updated: this.formatSubmittedAt(item.submittedAt),
      actionMode: 'view',
    };
  }

  private normalizeSource(source: string): 'Manual' | 'OCR' {
    return source.toLowerCase().includes('manual') ? 'Manual' : 'OCR';
  }

  private formatAmount(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private formatUpdatedAt(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Vừa cập nhật';
    }

    const diffMs = Date.now() - parsed.getTime();
    if (diffMs <= 0) {
      return 'Vừa xong';
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours < 1) {
      return 'Vừa xong';
    }

    if (diffHours < 24) {
      return `${diffHours} giờ trước`;
    }

    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) {
      return 'Hôm qua';
    }

    if (diffDays < 7) {
      return `${diffDays} ngày trước`;
    }

    return parsed.toLocaleDateString('vi-VN');
  }

  private formatSubmittedAt(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Vừa gửi';
    }

    return parsed.toLocaleDateString('vi-VN', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
    });
  }

  private normalizeStatusTone(status: string): DocumentsRow['statusTone'] {
    const normalized = status.trim().toLowerCase();

    if (normalized.includes('review')) {
      return 'review';
    }

    if (normalized.includes('approved')) {
      return 'approved';
    }

    if (normalized.includes('reject')) {
      return 'rejected';
    }

    if (normalized.includes('correction')) {
      return 'correction';
    }

    if (normalized.includes('draft')) {
      return 'draft';
    }

    return 'default';
  }
}
