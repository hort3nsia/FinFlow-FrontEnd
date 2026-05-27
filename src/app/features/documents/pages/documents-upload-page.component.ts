import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CurrentSubscriptionFacade } from '../../subscription/data/current-subscription.facade';
import {
  DocumentsOcrLineItemRowComponent,
  OcrLineItemKind,
  OcrReviewLineItem,
} from '../components/documents-ocr-line-item-row.component';
import { DocumentActionBarComponent } from '../components/workspace/document-action-bar.component';
import {
  DocumentSummaryBadge,
  DocumentSummaryItem,
  DocumentSummaryStripComponent,
} from '../components/workspace/document-summary-strip.component';
import { DocumentSplitWorkspaceComponent } from '../components/workspace/document-split-workspace.component';
import { DocumentSurfaceCardComponent } from '../components/workspace/document-surface-card.component';
import { DocumentUploadZoneComponent } from '../components/workspace/document-upload-zone.component';
import { DocumentWorkspaceHeaderComponent } from '../components/workspace/document-workspace-header.component';
import { DocumentReviewDraftResponse, DocumentsApiService } from '../data/documents-api.service';

interface ProcessingItem {
  id: 1 | 2 | 3 | 4;
  label: string;
}

interface ReviewFormState {
  vendorName: string;
  reference: string;
  documentDate: string;
  category: string;
  vendorTaxId: string;
}

type UploadPhase = 'upload' | 'processing' | 'review';
type ReviewFieldKey = keyof ReviewFormState;
type ReviewLineItemField = keyof OcrReviewLineItem;

@Component({
  selector: 'app-documents-upload-page',
  standalone: true,
  imports: [
    CommonModule,
    DocumentsOcrLineItemRowComponent,
    DocumentActionBarComponent,
    DocumentSummaryStripComponent,
    DocumentSplitWorkspaceComponent,
    DocumentSurfaceCardComponent,
    DocumentUploadZoneComponent,
    DocumentWorkspaceHeaderComponent,
  ],
  templateUrl: './documents-upload-page.component.html',
  styleUrl: './documents-upload-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsUploadPageComponent {
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly currentSubscriptionFacade = inject(CurrentSubscriptionFacade);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private previewUrl: string | null = null;

  protected readonly processingItems: ProcessingItem[] = [
    { id: 1, label: 'Nhận diện loại chứng từ' },
    { id: 2, label: 'Trích xuất nhà cung cấp và tham chiếu' },
    { id: 3, label: 'Đọc dòng chi phí và dữ liệu tài chính' },
    { id: 4, label: 'Đánh giá độ tin cậy OCR' },
  ];
  protected readonly phase = signal<UploadPhase>('upload');
  protected readonly reviewState = signal<ReviewFormState>({
    vendorName: '',
    reference: '',
    documentDate: '',
    category: '',
    vendorTaxId: '',
  });
  protected readonly categoryOptions = signal<string[]>([]);
  protected readonly selectableCategories = computed(() => {
    const currentCategory = this.reviewState().category.trim();
    const categories = this.categoryOptions();
    if (!currentCategory || categories.includes(currentCategory)) {
      return categories;
    }

    return [currentCategory, ...categories];
  });
  protected readonly lineItems = signal<OcrReviewLineItem[]>([]);
  protected readonly taxRate = signal<number | null>(null);
  protected readonly taxAmount = signal(0);
  protected readonly selectedFileName = signal<string | null>(null);
  protected readonly selectedFileType = signal<string | null>(null);
  protected readonly selectedFileMeta = signal('1 trang · 0 KB');
  protected readonly selectedDraftId = signal<string | null>(null);
  protected readonly selectedPreviewUrl = signal<string | null>(null);
  protected readonly selectedPdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  protected readonly confidenceLabel = signal<string>('OCR draft');
  protected readonly uploadError = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitState = signal<string | null>(null);
  protected readonly saveState = signal<string | null>(null);
  protected readonly uploading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly draggedLineItemIndex = signal<number | null>(null);
  protected readonly grossSubtotal = computed(() =>
    this.lineItems().reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
  );
  protected readonly totalDiscount = computed(() =>
    this.lineItems().reduce((sum, item) => sum + item.discountAmount, 0),
  );
  protected readonly subtotal = computed(() => this.grossSubtotal() - this.totalDiscount());
  protected readonly totalAmount = computed(() => this.subtotal() + this.taxAmount());
  protected readonly hasPdfPreview = computed(
    () => this.selectedFileType() === 'application/pdf' && !!this.selectedPdfPreviewUrl(),
  );
  protected readonly hasImagePreview = computed(
    () => !!this.selectedPreviewUrl() && !!this.selectedFileType()?.startsWith('image/'),
  );
  protected readonly summaryItems = computed<DocumentSummaryItem[]>(() => [
    { label: 'Nhà cung cấp', value: this.reviewState().vendorName || 'Chưa có' },
    { label: 'Số hoá đơn', value: this.reviewState().reference || 'Chưa có' },
    { label: 'Hạng mục', value: this.reviewState().category || 'Chưa có' },
    { label: 'Ngày hoá đơn', value: this.reviewState().documentDate || 'Chưa có' },
  ]);
  protected readonly summaryBadges = computed<DocumentSummaryBadge[]>(() => [
    { label: 'OCR', tone: 'primary' },
    { label: this.confidenceLabel(), tone: this.confidenceTone() },
  ]);

  constructor() {
    this.loadCategories();

    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const draftId = params.get('draftId');
      if (!draftId) {
        return;
      }

      this.loadDraft(draftId);
    });
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];

    if (!file) {
      return;
    }

    await this.handleSelectedFile(file);
  }

  protected updateField(field: ReviewFieldKey, value: string): void {
    this.reviewState.update((state) => ({
      ...state,
      [field]: value,
    }));
  }

  protected updateLineItem(index: number, field: ReviewLineItemField, value: string): void {
    this.lineItems.update((items) =>
      items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (field === 'itemName') {
          const nextItem = { ...item, itemName: value };
          return {
            ...nextItem,
            kind: this.inferOcrLineItemKind(nextItem),
          };
        }

        const normalized = Number(value);
        const nextValue = Number.isFinite(normalized) ? Math.max(0, normalized) : 0;
        const nextItem = {
          ...item,
          [field]: nextValue,
        };

        return {
          ...nextItem,
          total: this.calculateLineNet(nextItem),
          kind: this.inferOcrLineItemKind(nextItem),
        };
      }),
    );
  }

  protected addLineItem(): void {
    this.lineItems.update((items) => [
      ...items,
      {
        itemName: '',
        quantity: 1,
        unitPrice: 0,
        discountAmount: 0,
        total: 0,
        kind: 'standard',
      },
    ]);
  }

  protected removeLineItem(index: number): void {
    if (index === 0) {
      return;
    }

    this.lineItems.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
  }

  protected moveLineItemUp(index: number): void {
    if (index <= 0) {
      return;
    }

    this.lineItems.update((items) => this.moveLineItem(items, index, index - 1));
  }

  protected moveLineItemDown(index: number): void {
    this.lineItems.update((items) => {
      if (index >= items.length - 1) {
        return items;
      }

      return this.moveLineItem(items, index, index + 1);
    });
  }

  protected startDragLineItem(index: number): void {
    this.draggedLineItemIndex.set(index);
  }

  protected endDragLineItem(): void {
    this.draggedLineItemIndex.set(null);
  }

  protected allowLineItemDrop(event: DragEvent): void {
    event.preventDefault();
  }

  protected dropLineItem(targetIndex: number): void {
    const draggedIndex = this.draggedLineItemIndex();
    this.draggedLineItemIndex.set(null);

    if (draggedIndex === null || draggedIndex === targetIndex) {
      return;
    }

    this.lineItems.update((items) => this.moveLineItem(items, draggedIndex, targetIndex));
  }

  protected updateTaxAmount(value: string): void {
    const normalized = Number(value);
    this.taxAmount.set(Number.isFinite(normalized) ? normalized : 0);
  }

  protected updateTaxRate(value: string): void {
    if (!value.trim()) {
      this.taxRate.set(null);
      return;
    }

    const normalized = Number(value);
    if (!Number.isFinite(normalized)) {
      this.taxRate.set(null);
      return;
    }

    const nextRate = Math.min(100, Math.max(0, normalized));
    this.taxRate.set(nextRate);
    this.taxAmount.set(this.roundMoney((this.subtotal() * nextRate) / 100));
  }

  protected formatMoney(value: number): string {
    return value.toFixed(2);
  }

  protected async saveDraft(): Promise<void> {
    this.submitError.set(null);
    this.saveState.set(null);
    const draftId = this.selectedDraftId();

    if (!draftId) {
      this.saveState.set('Bản nháp OCR chưa sẵn sàng để lưu.');
      return;
    }

    try {
      const savedDraftId = await firstValueFrom(
        this.documentsApi.saveReviewedOcrDraft({
          draftId,
          ...this.buildReviewedOcrDraftPayload('Staff corrected'),
        }),
      );

      this.saveState.set(`Đã lưu nháp · ${savedDraftId}`);
      await this.router.navigate(['/app/documents/list'], {
        queryParams: { tab: 'drafts' },
      });
    } catch (error) {
      this.submitError.set(
        error instanceof Error ? error.message : 'Không thể lưu bản nháp OCR.',
      );
    }
  }

  protected async submitReview(): Promise<void> {
    const draftId = this.selectedDraftId();
    if (!draftId) {
      this.submitError.set('Bản nháp OCR chưa sẵn sàng để gửi phê duyệt.');
      return;
    }

    this.submitError.set(null);
    this.submitState.set(null);
    this.saveState.set(null);
    this.submitting.set(true);

    try {
      const submitted = await firstValueFrom(
        this.documentsApi.submitReviewedDocument({
          draftId,
          originalFileName: this.selectedFileName() ?? 'uploaded-document',
          ...this.buildReviewedOcrDraftPayload(this.confidenceLabel()),
          source: 'OCR',
        }),
      );

      this.submitState.set(`${submitted.status} · ${submitted.reference}`);
      await this.router.navigate(['/app/documents/list'], {
        queryParams: { tab: 'submitted' },
      });
    } catch (error) {
      this.submitError.set(
        error instanceof Error ? error.message : 'Không thể gửi bản duyệt OCR.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  private async handleSelectedFile(file: File): Promise<void> {
    this.setSelectedFile(file);
    this.selectedFileName.set(file.name);
    this.selectedFileMeta.set(this.formatFileMeta(file));
    this.selectedDraftId.set(null);
    this.uploadError.set(null);
    this.submitError.set(null);
    this.submitState.set(null);
    this.saveState.set(null);
    this.phase.set('processing');
    this.uploading.set(true);

    try {
      const base64Content = await this.toBase64(file);
      const draft = await firstValueFrom(
        this.documentsApi.uploadDocumentForReview(file.name, file.type, base64Content),
      );

      this.currentSubscriptionFacade.recordOcrUsage(draft.processedPageCount ?? 1);
      this.currentSubscriptionFacade.refresh({ silent: true });
      this.applyDraft(draft);
      this.phase.set('review');
    } catch (error) {
      this.phase.set('upload');
      this.uploadError.set(
        error instanceof Error ? error.message : 'Không thể xử lý tệp đã tải lên.',
      );
    } finally {
      this.uploading.set(false);
    }
  }

  private loadDraft(draftId: string): void {
    this.uploadError.set(null);
    this.submitError.set(null);
    this.submitState.set(null);
    this.saveState.set(null);
    this.phase.set('processing');

    this.documentsApi
      .getMyDocumentDraft(draftId)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (draft) => {
          this.selectedFileType.set(draft.contentType || null);
          this.selectedPreviewUrl.set(null);
          this.selectedPdfPreviewUrl.set(null);
          this.selectedFileMeta.set('Đang tiếp tục bản nháp');
          this.applyDraft(draft);
          this.phase.set('review');
        },
        error: (error: Error) => {
          this.phase.set('upload');
          this.uploadError.set(error.message);
        },
      });
  }

  private loadCategories(): void {
    this.documentsApi
      .getMyCategories()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (categories) => {
          this.categoryOptions.set(
            categories
              .filter((category) => category.isActive)
              .sort((left, right) => left.displayOrder - right.displayOrder)
              .map((category) => category.name),
          );
        },
        error: () => {
          this.categoryOptions.set([]);
        },
      });
  }

  private applyDraft(draft: DocumentReviewDraftResponse): void {
    this.selectedDraftId.set(draft.documentId);
    this.selectedFileName.set(draft.originalFileName);
    this.reviewState.set({
      vendorName: draft.vendorName,
      reference: draft.reference,
      documentDate: draft.documentDate,
      category: draft.category,
      vendorTaxId: draft.vendorTaxId,
    });
    this.lineItems.set(
      draft.lineItems.length
        ? draft.lineItems.map((item) => ({
            itemName: item.itemName,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            discountAmount: 0,
            total: item.total,
            kind: this.inferOcrLineItemKind(item),
          }))
        : [
            {
              itemName: '',
              quantity: 1,
              unitPrice: 0,
              discountAmount: 0,
              total: 0,
              kind: 'standard',
            },
          ],
    );
    const primaryTaxLine = draft.taxLines?.[0];
    this.taxRate.set(primaryTaxLine?.rate ?? null);
    this.taxAmount.set(primaryTaxLine?.taxAmount ?? draft.vat);
    this.confidenceLabel.set(draft.confidenceLabel || 'OCR draft');
  }

  private formatFileMeta(file: File): string {
    const kiloBytes = Math.max(1, Math.round(file.size / 1024));
    return `1 trang · ${kiloBytes} KB`;
  }

  private setSelectedFile(file: File): void {
    this.selectedFileType.set(file.type || null);

    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }

    this.previewUrl = URL.createObjectURL(file);
    if (file.type === 'application/pdf') {
      this.selectedPreviewUrl.set(null);
      this.selectedPdfPreviewUrl.set(
        this.sanitizer.bypassSecurityTrustResourceUrl(this.previewUrl),
      );
      return;
    }

    this.selectedPreviewUrl.set(this.previewUrl);
    this.selectedPdfPreviewUrl.set(null);
  }

  private buildReviewedOcrDraftPayload(confidenceLabel: string) {
    const state = this.reviewState();

    return {
      vendorName: state.vendorName,
      reference: state.reference,
      documentDate: state.documentDate,
      category: state.category,
      vendorTaxId: state.vendorTaxId,
      subtotal: this.subtotal(),
      vat: this.taxAmount(),
      totalAmount: this.totalAmount(),
      confidenceLabel,
      taxLines: this.buildTaxLines(),
      lineItems: this.lineItems().map((item) => ({
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: this.calculateLineNet(item),
      })),
    };
  }

  private buildTaxLines() {
    const taxAmount = this.taxAmount();
    if (taxAmount <= 0 && this.taxRate() === null) {
      return [];
    }

    return [
      {
        taxType: 'VAT',
        rate: this.taxRate(),
        taxableAmount: this.subtotal(),
        taxAmount,
      },
    ];
  }

  private calculateLineNet(
    item: Pick<OcrReviewLineItem, 'quantity' | 'unitPrice' | 'discountAmount'>,
  ): number {
    return item.quantity * item.unitPrice - item.discountAmount;
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private moveLineItem(
    items: OcrReviewLineItem[],
    fromIndex: number,
    toIndex: number,
  ): OcrReviewLineItem[] {
    const nextItems = [...items];
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem);
    return nextItems;
  }

  private inferOcrLineItemKind(
    item: Pick<OcrReviewLineItem, 'itemName' | 'unitPrice' | 'total'>,
  ): OcrLineItemKind {
    const normalizedName = item.itemName.trim().toLowerCase();
    const isDiscountByName =
      /discount|promo|coupon|voucher|rebate|markdown|credit|giảm giá|khuyến mãi/.test(normalizedName);
    const isAdjustmentByName =
      /adjustment|rounding|round off|round-off|adjust\b/.test(normalizedName);

    if (item.total < 0 || item.unitPrice < 0 || isDiscountByName) {
      return 'discount';
    }

    if (isAdjustmentByName) {
      return 'adjustment';
    }

    return 'standard';
  }

  private async toBase64(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    if (typeof globalThis.btoa === 'function') {
      return globalThis.btoa(binary);
    }

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let result = '';
    let index = 0;

    while (index < binary.length) {
      const char1 = binary.charCodeAt(index++);
      const char2 = binary.charCodeAt(index++);
      const char3 = binary.charCodeAt(index++);

      const enc1 = char1 >> 2;
      const enc2 = ((char1 & 3) << 4) | (char2 >> 4);
      let enc3 = ((char2 & 15) << 2) | (char3 >> 6);
      let enc4 = char3 & 63;

      if (Number.isNaN(char2)) {
        enc3 = 64;
        enc4 = 64;
      } else if (Number.isNaN(char3)) {
        enc4 = 64;
      }

      result +=
        chars.charAt(enc1) +
        chars.charAt(enc2) +
        chars.charAt(enc3) +
        chars.charAt(enc4);
    }

    return result;
  }

  private confidenceTone(): DocumentSummaryBadge['tone'] {
    const normalized = this.confidenceLabel().toLowerCase();
    if (normalized.includes('low')) {
      return 'danger';
    }
    if (normalized.includes('medium')) {
      return 'warning';
    }
    return 'success';
  }
}
