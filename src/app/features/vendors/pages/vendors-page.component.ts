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
import { toUserFacingError } from '../../../core/errors/user-facing-error.util';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import {
  CreateVendorInput,
  VendorDetailResponse,
  VendorResponse,
  VendorsApiService,
  VerifyVendorInput,
} from '../data/vendors-api.service';

type VerificationFilter = 'all' | 'verified' | 'unverified';
type InspectorTab = 'identity' | 'documents' | 'audit';

interface VendorRow {
  id: string;
  name: string;
  taxCode: string;
  taxCodeMasked: string;
  isVerified: boolean;
  verifiedAt: string | null;
  verifiedAtLabel: string;
  createdAtLabel: string;
  category: string;
  linkedDocumentsCount: number;
  detail: VendorResponse;
}

interface VendorKpi {
  id: 'total' | 'verified' | 'unverified' | 'recent';
  label: string;
  value: string;
}

interface VendorAuditEvent {
  id: string;
  label: string;
  actor: string;
  timestamp: string;
  note: string;
  tone: 'created' | 'verified';
}

const VND_TAX_CODE_REGEX = /^\d{10,14}$/;

@Component({
  selector: 'app-vendors-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vendors-page.component.html',
  styleUrl: './vendors-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VendorsPageComponent {
  private readonly vendorsApi = inject(VendorsApiService);
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly workspaceState = this.currentWorkspaceFacade.state;

  // ─── State signals ─────────────────────────────────────────────
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  private readonly vendorRowsSignal = signal<VendorRow[]>([]);
  protected readonly searchQuery = signal('');
  protected readonly filter = signal<VerificationFilter>('all');
  protected readonly selectedVendorIdSignal = signal<string | null>(null);
  protected readonly inspectorTab = signal<InspectorTab>('identity');
  protected readonly vendorDetail = signal<VendorDetailResponse | null>(null);
  protected readonly isDetailLoading = signal(false);
  protected readonly detailError = signal<string | null>(null);
  private detailRequestId: string | null = null;
  private readonly detailCache = new Map<string, VendorDetailResponse>();

  // Add Vendor modal
  protected readonly isAddModalOpen = signal(false);
  protected readonly addName = signal('');
  protected readonly addTaxCode = signal('');
  protected readonly addError = signal<string | null>(null);
  protected readonly isSubmittingAdd = signal(false);

  // Verify Vendor modal
  protected readonly verifyTargetId = signal<string | null>(null);
  protected readonly verifyError = signal<string | null>(null);
  protected readonly isSubmittingVerify = signal(false);

  // ─── Derived state ─────────────────────────────────────────────
  protected readonly vendorRows = computed(() => this.vendorRowsSignal());

  protected readonly filteredRows = computed(() => {
    const rows = this.vendorRowsSignal();
    const query = this.searchQuery().trim().toLowerCase();
    const filter = this.filter();

    return rows.filter((row) => {
      // Verification filter
      if (filter === 'verified' && !row.isVerified) return false;
      if (filter === 'unverified' && row.isVerified) return false;

      // Search query
      if (query) {
        const haystack = `${row.name} ${row.taxCode}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  });

  protected readonly kpis = computed<VendorKpi[]>(() => {
    const rows = this.vendorRowsSignal();
    const now = Date.now();
    const monthAgo = now - 30 * 24 * 60 * 60 * 1000;

    return [
      {
        id: 'total',
        label: 'Tổng nhà cung cấp',
        value: rows.length.toString(),
      },
      {
        id: 'verified',
        label: 'Đã xác thực',
        value: rows.filter((r) => r.isVerified).length.toString(),
      },
      {
        id: 'unverified',
        label: 'Chưa xác thực',
        value: rows.filter((r) => !r.isVerified).length.toString(),
      },
      {
        id: 'recent',
        label: 'Mới (30 ngày)',
        value: rows
          .filter((r) => new Date(r.detail.createdAt).getTime() >= monthAgo)
          .length.toString(),
      },
    ];
  });

  protected readonly selectedVendor = computed<VendorRow | null>(() => {
    const id = this.selectedVendorIdSignal();
    if (!id) return null;
    return this.vendorRowsSignal().find((r) => r.id === id) ?? null;
  });

  protected readonly emptyStateCopy = computed(() => {
    const filter = this.filter();
    if (filter === 'verified') return 'Chưa có nhà cung cấp nào được xác thực.';
    if (filter === 'unverified') return 'Chưa có nhà cung cấp nào chưa xác thực.';
    if (this.searchQuery()) return `Không tìm thấy nhà cung cấp khớp với "${this.searchQuery()}".`;
    return 'Chưa có nhà cung cấp. Nhấn "Thêm nhà cung cấp" để tạo mới.';
  });

  // VND tax code regex hint for the form
  protected readonly addTaxCodeValid = computed(() => {
    const code = this.addTaxCode().trim();
    if (!code) return false;
    return VND_TAX_CODE_REGEX.test(code);
  });

  protected readonly addFormValid = computed(
    () => this.addName().trim().length > 0 && this.addTaxCodeValid(),
  );

  constructor() {
    // Refresh whenever current tenant changes.
    effect(() => {
      const tenantId = this.workspaceState().workspace?.tenantId;
      if (tenantId) {
        this.refresh();
      }
    });
  }

  // ─── Actions ────────────────────────────────────────────────────
  protected refresh(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.vendorsApi
      .getMyVendors(null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (vendors) => {
          this.vendorRowsSignal.set(vendors.map((v) => this.toRow(v)));
          this.isLoading.set(false);
          this.syncSelection();
        },
        error: (err: Error) => {
          this.loadError.set(toUserFacingError(err.message));
          this.isLoading.set(false);
        },
      });
  }

  protected setFilter(filter: VerificationFilter): void {
    this.filter.set(filter);
    this.syncSelection();
  }

  protected onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.syncSelection();
  }

  protected selectVendor(id: string | null): void {
    this.selectedVendorIdSignal.set(id);
    this.inspectorTab.set('identity');
    if (id) {
      this.loadVendorDetail(id);
    } else {
      this.resetDetail();
    }
  }

  protected closeInspector(): void {
    this.selectedVendorIdSignal.set(null);
    this.resetDetail();
  }

  protected setInspectorTab(tab: InspectorTab): void {
    this.inspectorTab.set(tab);
  }

  protected exportVisibleRows(): void {
    const rows = this.filteredRows();
    if (!rows.length) return;

    const values = [
      ['Nhà cung cấp', 'Mã số thuế', 'Xác thực', 'Danh mục', 'Ngày tạo'],
      ...rows.map((row) => [
        row.name,
        row.taxCode,
        row.isVerified ? 'Đã xác thực' : 'Chưa xác thực',
        row.category,
        row.createdAtLabel,
      ]),
    ];
    const csv = values
      .map((cells) => cells.map((value) => `"${value.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `finflow-vendors-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected merchantCode(row: VendorRow): string {
    return `MCH-${row.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  protected auditHistory(row: VendorRow): VendorAuditEvent[] {
    const events: VendorAuditEvent[] = [
      {
        id: `${row.id}-created`,
        label: 'Đã tạo nhà cung cấp',
        actor: 'Hệ thống',
        timestamp: row.createdAtLabel,
        note: 'Hồ sơ nhà cung cấp đã được tạo trong workspace.',
        tone: 'created',
      },
    ];

    if (row.isVerified && row.verifiedAt) {
      events.push({
        id: `${row.id}-verified`,
        label: 'Đã xác thực nhà cung cấp',
        actor: row.detail.verifiedByMembershipId ?? 'Người xác thực',
        timestamp: row.verifiedAtLabel,
        note: 'Thông tin doanh nghiệp đã được xác thực.',
        tone: 'verified',
      });
    }

    return events;
  }

  protected formatCurrency(value: number, currencyCode: string): string {
    if (currencyCode === 'VND') {
      return `₫${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value)}`;
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  }

  // ─── Add Vendor modal ──────────────────────────────────────────
  protected openAddModal(): void {
    this.addName.set('');
    this.addTaxCode.set('');
    this.addError.set(null);
    this.isAddModalOpen.set(true);
  }

  protected closeAddModal(): void {
    this.isAddModalOpen.set(false);
  }

  protected submitAdd(): void {
    if (!this.addFormValid() || this.isSubmittingAdd()) return;

    const input: CreateVendorInput = {
      name: this.addName().trim(),
      taxCode: this.addTaxCode().trim(),
    };

    this.isSubmittingAdd.set(true);
    this.addError.set(null);

    this.vendorsApi
      .createVendor(input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (vendor) => {
          this.vendorRowsSignal.update((rows) => [this.toRow(vendor), ...rows]);
          this.isSubmittingAdd.set(false);
          this.selectVendor(vendor.vendorId);
          this.closeAddModal();
        },
        error: (err: Error) => {
          this.addError.set(toUserFacingError(err.message));
          this.isSubmittingAdd.set(false);
        },
      });
  }

  // ─── Verify Vendor ──────────────────────────────────────────────
  protected openVerifyModal(vendorId: string): void {
    this.verifyTargetId.set(vendorId);
    this.verifyError.set(null);
  }

  protected closeVerifyModal(): void {
    this.verifyTargetId.set(null);
  }

  protected confirmVerify(): void {
    const vendorId = this.verifyTargetId();
    if (!vendorId || this.isSubmittingVerify()) return;

    const input: VerifyVendorInput = { vendorId };

    this.isSubmittingVerify.set(true);
    this.verifyError.set(null);

    this.vendorsApi
      .verifyVendor(input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (vendor) => {
          this.vendorRowsSignal.update((rows) =>
            rows.map((r) => (r.id === vendor.vendorId ? this.toRow(vendor) : r)),
          );
          this.isSubmittingVerify.set(false);
          this.closeVerifyModal();
        },
        error: (err: Error) => {
          this.verifyError.set(toUserFacingError(err.message));
          this.isSubmittingVerify.set(false);
        },
      });
  }

  // ─── Helpers ────────────────────────────────────────────────────
  private syncSelection(): void {
    const rows = this.filteredRows();
    const selectedId = this.selectedVendorIdSignal();
    if (!rows.length) {
      this.selectedVendorIdSignal.set(null);
      this.resetDetail();
      return;
    }

    if (!selectedId || !rows.some((row) => row.id === selectedId)) {
      this.selectedVendorIdSignal.set(rows[0].id);
      this.inspectorTab.set('identity');
      this.loadVendorDetail(rows[0].id);
    }
  }

  private loadVendorDetail(vendorId: string): void {
    this.detailRequestId = vendorId;
    this.detailError.set(null);

    const cachedDetail = this.detailCache.get(vendorId);
    if (cachedDetail) {
      this.vendorDetail.set(cachedDetail);
      this.isDetailLoading.set(false);
      return;
    }

    this.vendorDetail.set(null);
    this.isDetailLoading.set(true);

    this.vendorsApi
      .getVendorDetail(vendorId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (detail) => {
          if (this.detailRequestId !== vendorId) return;
          this.detailCache.set(vendorId, detail);
          this.vendorDetail.set(detail);
          this.isDetailLoading.set(false);
        },
        error: (error: Error) => {
          if (this.detailRequestId !== vendorId) return;
          this.detailError.set(toUserFacingError(error.message));
          this.isDetailLoading.set(false);
        },
      });
  }

  private resetDetail(): void {
    this.detailRequestId = null;
    this.vendorDetail.set(null);
    this.detailError.set(null);
    this.isDetailLoading.set(false);
  }

  private toRow(vendor: VendorResponse): VendorRow {
    const taxCode = vendor.taxCode ?? '';
    const taxCodeMasked = taxCode.length >= 4
      ? `${taxCode.slice(0, taxCode.length - 4).replace(/\d/g, '•')}${taxCode.slice(-4)}`
      : taxCode;

    return {
      id: vendor.vendorId,
      name: vendor.name,
      taxCode,
      taxCodeMasked,
      isVerified: vendor.isVerified,
      verifiedAt: vendor.verifiedAt,
      verifiedAtLabel: vendor.verifiedAt
        ? this.formatDate(vendor.verifiedAt)
        : '—',
      createdAtLabel: this.formatDate(vendor.createdAt),
      category: this.guessCategory(vendor.name),
      linkedDocumentsCount: vendor.linkedDocumentsCount ?? 0,
      detail: vendor,
    };
  }

  protected formatDate(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private guessCategory(name: string): string {
    const lower = name.toLowerCase();
    if (/(coffee|café|nhà hàng|restaurant|highlands|starbucks|lotteria)/.test(lower))
      return 'Ăn uống & Café';
    if (/(grab|taxi|vinasun|airline|hàng không|airways)/.test(lower)) return 'Vận chuyển';
    if (/(circle k|familymart|gs25|văn phòng|office)/.test(lower))
      return 'Văn phòng phẩm';
    if (/(cloud|microsoft|aws|azure|google)/.test(lower)) return 'Hạ tầng đám mây';
    if (/(hotel|khách sạn|resort)/.test(lower)) return 'Công tác phí';
    return 'Khác';
  }
}
