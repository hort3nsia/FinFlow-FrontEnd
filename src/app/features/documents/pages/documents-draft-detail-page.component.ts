import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { DocumentActionBarComponent } from '../components/workspace/document-action-bar.component';
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
  DocumentReviewDraftResponse,
  OcrLineItem,
} from '../data/documents-api.service';

@Component({
  selector: 'app-documents-draft-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    DocumentActionBarComponent,
    DocumentSummaryStripComponent,
    DocumentSplitWorkspaceComponent,
    DocumentSurfaceCardComponent,
  ],
  templateUrl: './documents-draft-detail-page.component.html',
  styleUrl: './documents-draft-detail-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsDraftDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly draft = signal<DocumentReviewDraftResponse | null>(null);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly sourceLabel = computed(() => this.normalizeSource(this.draft()?.source));
  protected readonly subtotal = computed(() => this.draft()?.subtotal ?? 0);
  protected readonly vat = computed(() => this.draft()?.vat ?? 0);
  protected readonly totalAmount = computed(() => this.draft()?.totalAmount ?? 0);
  protected readonly currencyCode = computed(() => this.draft()?.currencyCode || 'USD');
  protected readonly grossSubtotal = computed(() => {
    const draft = this.draft();
    if (!draft?.lineItems.length) {
      return this.subtotal();
    }

    return draft.lineItems.reduce((sum, item) => sum + this.lineGross(item), 0);
  });
  protected readonly totalDiscount = computed(() =>
    Math.max(0, this.grossSubtotal() - this.subtotal()),
  );
  protected readonly taxLineRows = computed<DocumentTaxLine[]>(() => {
    const draft = this.draft();
    const taxLines = draft?.taxLines?.filter((line) => line.taxAmount > 0) ?? [];
    if (taxLines.length) {
      return taxLines;
    }

    return this.vat() > 0
      ? [{ taxType: 'VAT', rate: null, taxableAmount: this.subtotal(), taxAmount: this.vat() }]
      : [];
  });
  protected readonly hasPreviewImage = computed(() => !!this.draft()?.previewImageDataUrl);
  protected readonly hasAttachedFile = computed(() =>
    this.isRealAttachment(this.draft()?.originalFileName, this.draft()?.contentType),
  );
  protected readonly attachmentFileName = computed(() =>
    this.hasAttachedFile() ? this.draft()?.originalFileName || 'Tệp đính kèm' : 'Không có tệp',
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
    const preview = this.draft()?.previewImageDataUrl;
    if (!preview || this.draft()?.contentType === 'application/pdf') {
      return null;
    }

    return preview;
  });
  protected readonly previewPdfUrl = computed<SafeResourceUrl | null>(() => {
    const preview = this.draft()?.previewImageDataUrl;
    if (!preview || this.draft()?.contentType !== 'application/pdf') {
      return null;
    }

    return this.sanitizer.bypassSecurityTrustResourceUrl(preview);
  });
  protected readonly summaryItems = computed<DocumentSummaryItem[]>(() => {
    const draft = this.draft();
    if (!draft) {
      return [];
    }

    return [
      { label: 'Nhà cung cấp', value: draft.vendorName || 'Chưa có' },
      { label: 'Hạng mục', value: draft.category || 'Chưa có' },
      { label: 'Ngày hoá đơn', value: draft.documentDate || 'Chưa có' },
      { label: 'Tiền tệ', value: draft.currencyCode || 'USD' },
    ];
  });
  protected readonly summaryBadges = computed<DocumentSummaryBadge[]>(() => [
    { label: 'Bản nháp', tone: 'warning' },
    { label: this.sourceLabel(), tone: this.sourceLabel() === 'OCR' ? 'primary' : 'neutral' },
  ]);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const documentId = params.get('id');
      if (!documentId) {
        this.loading.set(false);
        this.error.set('Thiếu mã bản nháp.');
        return;
      }

      this.loadDraft(documentId);
    });
  }

  protected editDraft(): void {
    const draft = this.draft();
    if (!draft) {
      return;
    }

    const target =
      this.normalizeSource(draft.source) === 'Manual'
        ? ['/app/documents/manual']
        : ['/app/documents/upload'];

    void this.router.navigate(target, {
      queryParams: { draftId: draft.documentId },
    });
  }

  protected goBack(): void {
    void this.router.navigate(['/app/documents/list']);
  }

  protected async submitDraft(): Promise<void> {
    const draft = this.draft();
    if (!draft) {
      return;
    }

    this.submitError.set(null);
    this.submitting.set(true);

    try {
      await firstValueFrom(
        this.documentsApi.submitReviewedDocument({
          draftId: draft.documentId,
          originalFileName: draft.originalFileName || 'document-draft',
          vendorName: draft.vendorName,
          reference: draft.reference,
          documentDate: draft.documentDate,
          category: draft.category,
          vendorTaxId: draft.vendorTaxId || null,
          subtotal: draft.subtotal,
          vat: draft.vat,
          totalAmount: draft.totalAmount,
          source: draft.source,
          confidenceLabel: draft.confidenceLabel,
          lineItems: draft.lineItems,
          taxLines: draft.taxLines ?? [],
        }),
      );

      await this.router.navigate(['/app/documents/list'], {
        queryParams: { tab: 'submitted' },
      });
    } catch (error) {
      this.submitError.set(
        error instanceof Error ? error.message : 'Không thể gửi bản nháp phê duyệt.',
      );
    } finally {
      this.submitting.set(false);
    }
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
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
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

  protected hasTaxId(): boolean {
    return !!this.draft()?.vendorTaxId?.trim();
  }

  private loadDraft(documentId: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.documentsApi
      .getMyDocumentDraft(documentId)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (draft) => {
          this.draft.set(draft);
          this.loading.set(false);
        },
        error: (error: Error) => {
          this.draft.set(null);
          this.error.set(error.message);
          this.loading.set(false);
        },
      });
  }

  private normalizeSource(source: string | null | undefined): 'Manual' | 'OCR' {
    return source?.toLowerCase().includes('manual') ? 'Manual' : 'OCR';
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
