import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import {
  DocumentSummaryBadge,
  DocumentSummaryItem,
  DocumentSummaryStripComponent,
} from '../components/workspace/document-summary-strip.component';
import { DocumentSplitWorkspaceComponent } from '../components/workspace/document-split-workspace.component';
import { DocumentSurfaceCardComponent } from '../components/workspace/document-surface-card.component';
import {
  DocumentsApiService,
  DocumentTaxLine,
  OcrLineItem,
  SubmittedDocumentDetailResponse,
} from '../data/documents-api.service';

@Component({
  selector: 'app-documents-submitted-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    DocumentSummaryStripComponent,
    DocumentSplitWorkspaceComponent,
    DocumentSurfaceCardComponent,
  ],
  templateUrl: './documents-submitted-detail-page.component.html',
  styleUrl: './documents-submitted-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsSubmittedDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly submitted = signal<SubmittedDocumentDetailResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly sourceLabel = computed(() => this.normalizeSource(this.submitted()?.source));
  protected readonly statusTone = computed(() => this.normalizeStatusTone(this.submitted()?.status ?? ''));
  protected readonly currencyCode = computed(() => this.submitted()?.currencyCode || 'USD');
  protected readonly subtotal = computed(() => this.submitted()?.subtotal ?? 0);
  protected readonly vat = computed(() => this.submitted()?.vat ?? 0);
  protected readonly totalAmount = computed(() => this.submitted()?.totalAmount ?? 0);
  protected readonly grossSubtotal = computed(() => {
    const submitted = this.submitted();
    if (!submitted?.lineItems.length) {
      return this.subtotal();
    }

    return submitted.lineItems.reduce((sum, item) => sum + this.lineGross(item), 0);
  });
  protected readonly totalDiscount = computed(() =>
    Math.max(0, this.grossSubtotal() - this.subtotal()),
  );
  protected readonly taxLineRows = computed<DocumentTaxLine[]>(() => {
    const submitted = this.submitted();
    const taxLines = submitted?.taxLines?.filter((line) => line.taxAmount > 0) ?? [];
    if (taxLines.length) {
      return taxLines;
    }

    return this.vat() > 0
      ? [{ taxType: 'VAT', rate: null, taxableAmount: this.subtotal(), taxAmount: this.vat() }]
      : [];
  });
  protected readonly hasPreviewImage = computed(() => !!this.submitted()?.previewImageDataUrl);
  protected readonly hasAttachedFile = computed(() =>
    this.isRealAttachment(this.submitted()?.originalFileName, this.submitted()?.contentType),
  );
  protected readonly attachmentFileName = computed(() =>
    this.hasAttachedFile()
      ? this.submitted()?.originalFileName || 'Tệp đính kèm'
      : 'Không có tệp',
  );
  protected readonly previewPlaceholderTitle = computed(() =>
    this.hasAttachedFile() ? 'Bản xem trước chưa khả dụng' : 'Chưa có tệp đính kèm',
  );
  protected readonly previewPlaceholderHint = computed(() =>
    this.hasAttachedFile()
      ? 'Tệp đã được đính kèm nhưng chưa có dữ liệu preview để hiển thị.'
      : 'Chứng từ nhập tay này không có file đi kèm.',
  );
  protected readonly previewImageUrl = computed(() => {
    const preview = this.submitted()?.previewImageDataUrl;
    if (!preview || this.submitted()?.contentType === 'application/pdf') {
      return null;
    }

    return preview;
  });
  protected readonly previewPdfUrl = computed<SafeResourceUrl | null>(() => {
    const preview = this.submitted()?.previewImageDataUrl;
    if (!preview || this.submitted()?.contentType !== 'application/pdf') {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(preview);
  });
  protected readonly summaryItems = computed<DocumentSummaryItem[]>(() => {
    const submitted = this.submitted();
    if (!submitted) {
      return [];
    }

    return [
      { label: 'Nhà cung cấp', value: submitted.vendorName || 'Chưa có' },
      { label: 'Hạng mục', value: submitted.category || 'Chưa có' },
      { label: 'Ngày hoá đơn', value: submitted.documentDate || 'Chưa có' },
      { label: 'Tiền tệ', value: submitted.currencyCode || 'USD' },
      { label: 'Ngày gửi', value: submitted.submittedAt || 'Chưa có' },
    ];
  });
  protected readonly summaryBadges = computed<DocumentSummaryBadge[]>(() => [
    { label: this.sourceLabel(), tone: this.sourceLabel() === 'OCR' ? 'primary' : 'neutral' },
    { label: this.submitted()?.status ?? 'Đã gửi', tone: this.statusTone() },
  ]);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const documentId = params.get('id');
      if (!documentId) {
        this.loading.set(false);
        this.error.set('Thiếu mã chứng từ đã gửi.');
        return;
      }

      this.loadSubmittedDocument(documentId);
    });
  }

  protected formatAmount(value: number): string {
    const currency = this.currencyCode();
    const fractionDigits = currency === 'VND' ? 0 : 2;

    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
      }).format(value);
    } catch {
      return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value);
    }
  }

  protected lineGross(item: OcrLineItem): number {
    return item.quantity * item.unitPrice;
  }

  protected lineDiscount(item: OcrLineItem): number {
    return Math.max(0, this.lineGross(item) - item.total);
  }

  protected lineNet(item: OcrLineItem): number {
    return item.total;
  }

  protected hasLineDiscount(item: OcrLineItem): boolean {
    return this.lineDiscount(item) > 0;
  }

  protected hasAnyDiscount(): boolean {
    return this.totalDiscount() > 0;
  }

  protected formatDiscount(value: number): string {
    if (!value) {
      return '—';
    }

    return `-${this.formatAmount(value)}`;
  }

  protected formatLineTaxRate(item: OcrLineItem): string {
    return item.taxRate === null || item.taxRate === undefined ? '—' : `${item.taxRate}%`;
  }

  protected formatLineTaxAmount(item: OcrLineItem): string {
    return (item.taxAmount ?? 0) > 0 ? this.formatAmount(item.taxAmount ?? 0) : '—';
  }

  protected formatTaxLineLabel(line: DocumentTaxLine): string {
    const taxType = line.taxType?.trim() || 'VAT';
    const rate = this.formatTaxRate(line.rate);
    return rate ? `${taxType} ${rate}` : `${taxType} / Thuế`;
  }

  protected formatTaxLineHint(line: DocumentTaxLine): string {
    const taxable = this.formatAmount(line.taxableAmount);
    return line.rate === null || line.rate === undefined
      ? `Giá trị tính thuế ${taxable} · chưa có %`
      : `Giá trị tính thuế ${taxable}`;
  }

  private formatTaxRate(rate: number | null | undefined): string | null {
    if (rate === null || rate === undefined || !Number.isFinite(rate)) {
      return null;
    }

    return `${Number.isInteger(rate) ? rate.toFixed(0) : rate.toFixed(2)}%`;
  }

  protected goBack(): void {
    void this.router.navigate(['/app/documents/list'], {
      queryParams: { tab: 'submitted' },
    });
  }

  private loadSubmittedDocument(documentId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.documentsApi
      .getMySubmittedDocument(documentId)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (submitted) => {
          this.submitted.set(submitted);
          this.error.set(null);
          this.loading.set(false);
        },
        error: (error: Error) => {
          this.submitted.set(null);
          this.error.set(error.message);
          this.loading.set(false);
        },
      });
  }

  private normalizeSource(source: string | null | undefined): 'Manual' | 'OCR' {
    return source?.toLowerCase().includes('manual') ? 'Manual' : 'OCR';
  }

  private normalizeStatusTone(
    status: string,
  ): 'warning' | 'success' | 'danger' | 'neutral' {
    const normalized = status.trim().toLowerCase();

    if (normalized.includes('review') || normalized.includes('correction')) {
      return 'warning';
    }

    if (normalized.includes('approved')) {
      return 'success';
    }

    if (normalized.includes('reject')) {
      return 'danger';
    }

    return 'neutral';
  }

  private isRealAttachment(
    originalFileName: string | null | undefined,
    contentType: string | null | undefined,
  ): boolean {
    const normalizedName = originalFileName?.trim().toLowerCase() ?? '';
    const normalizedContentType = contentType?.trim().toLowerCase() ?? '';

    if (!normalizedName || normalizedName === 'manual-entry' || normalizedName === 'document-draft') {
      return false;
    }

    return normalizedContentType !== 'manual-entry';
  }
}
