import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { toUserFacingError } from '../../../core/errors/user-facing-error.util';
import { DocumentsManualLineItemRowComponent } from '../components/documents-manual-line-item-row.component';
import { DocumentActionBarComponent } from '../components/workspace/document-action-bar.component';
import { DocumentSplitWorkspaceComponent } from '../components/workspace/document-split-workspace.component';
import { DocumentSurfaceCardComponent } from '../components/workspace/document-surface-card.component';
import { DocumentUploadZoneComponent } from '../components/workspace/document-upload-zone.component';
import { DocumentReviewDraftResponse, DocumentsApiService } from '../data/documents-api.service';
import { EXPENSE_CATEGORIES } from '../data/expense-categories';
import { LineItem, LineItemType } from './documents-manual-page.models';

interface ManualField {
  key: ManualFieldKey;
  label: string;
  placeholder: string;
  inputType?: 'text' | 'date';
}

interface ManualFormState {
  vendorSupplier: string;
  invoiceNumber: string;
  invoiceDate: string;
  category: string;
  taxId: string;
}

type ManualFieldKey =
  | 'vendor-supplier'
  | 'invoice-number'
  | 'invoice-date'
  | 'category'
  | 'tax-id';

type ManualStateField = keyof ManualFormState;
type LineItemField = keyof LineItem;

@Component({
  selector: 'app-documents-manual-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    DocumentsManualLineItemRowComponent,
    DocumentActionBarComponent,
    DocumentSplitWorkspaceComponent,
    DocumentSurfaceCardComponent,
    DocumentUploadZoneComponent,
  ],
  templateUrl: './documents-manual-page.component.html',
  styleUrl: './documents-manual-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsManualPageComponent {
  private readonly documentsApi = inject(DocumentsApiService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly route = inject(ActivatedRoute);
  private previewUrl: string | null = null;

  protected readonly vendorFields: ManualField[] = [
    { key: 'vendor-supplier', label: 'Nhà cung cấp', placeholder: 'VD: BÁCH HÓA XANH', inputType: 'text' },
    { key: 'invoice-number', label: 'Số hoá đơn', placeholder: 'VD: 21070052990051966', inputType: 'text' },
    { key: 'invoice-date', label: 'Ngày hoá đơn', placeholder: 'dd/mm/yyyy', inputType: 'date' },
    { key: 'category', label: 'Hạng mục', placeholder: 'Chọn hạng mục chi phí', inputType: 'text' },
    { key: 'tax-id', label: 'Mã số thuế / VAT', placeholder: 'VD: 0312345678', inputType: 'text' },
  ];
  protected readonly formState = signal<ManualFormState>({
    vendorSupplier: '',
    invoiceNumber: '',
    invoiceDate: '',
    category: '',
    taxId: '',
  });
  protected readonly categoryOptions = signal<string[]>([]);
  protected readonly selectableCategories = computed(() => {
    const currentCategory = this.formState().category.trim();
    const categories = this.categoryOptions();
    if (!currentCategory || categories.includes(currentCategory)) {
      return categories;
    }

    return [currentCategory, ...categories];
  });
  protected readonly lineItems = signal<LineItem[]>([
    {
      type: 'standard',
      description: '',
      quantity: 1,
      grossAmount: 0,
      discountAmount: 0,
      taxRate: null,
      taxableAmount: 0,
      taxAmount: 0,
    },
  ]);
  protected readonly draggedLineItemIndex = signal<number | null>(null);
  protected readonly taxRate = signal<number | null>(null);
  protected readonly taxAmount = signal(0);
  protected readonly selectedFile = signal<File | null>(null);
  protected readonly selectedFileName = signal<string | null>(null);
  protected readonly selectedFileType = signal<string | null>(null);
  protected readonly selectedPreviewUrl = signal<string | null>(null);
  protected readonly selectedPdfPreviewUrl = signal<SafeResourceUrl | null>(null);
  protected readonly dragActive = signal(false);
  protected readonly submitState = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly saveState = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly savingDraft = signal(false);
  private readonly editingDraftId = signal<string | null>(null);
  protected readonly hasPdfPreview = computed(
    () => this.selectedFileType() === 'application/pdf' && !!this.selectedPdfPreviewUrl(),
  );
  protected readonly hasImagePreview = computed(
    () => !!this.selectedPreviewUrl() && !!this.selectedFileType()?.startsWith('image/'),
  );
  protected readonly grossSubtotal = computed(() =>
    this.lineItems().reduce((sum, item) => sum + item.grossAmount, 0),
  );
  protected readonly totalDiscount = computed(() =>
    this.lineItems().reduce((sum, item) => sum + item.discountAmount, 0),
  );
  protected readonly subtotal = computed(() => this.grossSubtotal() - this.totalDiscount());
  protected readonly hasLineVat = computed(() => this.lineItems().some((item) => this.hasLineTax(item)));
  protected readonly groupedLineTaxLines = computed(() => this.groupLineTaxLines(this.lineItems()));
  protected readonly effectiveTaxAmount = computed(() =>
    this.hasLineVat()
      ? this.groupedLineTaxLines().reduce((sum, line) => sum + line.taxAmount, 0)
      : this.taxAmount(),
  );
  protected readonly totalAmount = computed(() => this.subtotal() + this.effectiveTaxAmount());
  protected readonly prettyInvoiceDate = computed(() =>
    this.formatDisplayDate(this.formState().invoiceDate),
  );

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

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    this.setSelectedFile(input?.files?.[0] ?? null);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(true);
  }

  protected onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragActive.set(false);
    this.setSelectedFile(event.dataTransfer?.files?.[0] ?? null);
  }

  protected updateField(field: ManualStateField, value: string): void {
    this.formState.update((state) => ({
      ...state,
      [field]: value,
    }));
  }

  protected addLineItem(): void {
    this.lineItems.update((items) => [
      ...items,
      {
        type: 'standard',
        description: '',
        quantity: 1,
        grossAmount: 0,
        discountAmount: 0,
        taxRate: null,
        taxableAmount: 0,
        taxAmount: 0,
      },
    ]);
  }

  protected removeLineItem(index: number): void {
    this.lineItems.update((items) => {
      if (items.length === 1) {
        return items;
      }

      return items.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  protected updateLineItem(index: number, field: LineItemField, value: string): void {
    this.lineItems.update((items) =>
      items.map((item, itemIndex) => {
        if (itemIndex !== index) {
          return item;
        }

        if (field === 'description') {
          return { ...item, description: value };
        }

        if (field === 'type') {
          return { ...item, type: value as LineItemType };
        }

        if (field === 'taxRate' && !value.trim()) {
          return {
            ...item,
            taxRate: null,
            taxableAmount: 0,
            taxAmount: 0,
          };
        }

        const normalizedNumber = Number(value);
        if (!Number.isFinite(normalizedNumber)) {
          return {
            ...item,
            [field]: 0,
          };
        }

        if (field === 'quantity') {
          return {
            ...item,
            quantity: Math.max(1, Math.trunc(normalizedNumber) || 1),
          };
        }

        const nextItem = {
          ...item,
          [field]: field === 'taxRate'
            ? Math.min(100, Math.max(0, normalizedNumber))
            : Math.max(0, normalizedNumber),
        };

        return {
          ...nextItem,
          ...this.calculateLineTaxFields(nextItem),
        };
      }),
    );
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
    const normalizedNumber = Number(value);
    this.taxAmount.set(Number.isFinite(normalizedNumber) ? normalizedNumber : 0);
  }

  protected updateTaxRate(value: string): void {
    if (!value.trim()) {
      this.taxRate.set(null);
      return;
    }

    const normalizedNumber = Number(value);
    if (!Number.isFinite(normalizedNumber)) {
      this.taxRate.set(null);
      return;
    }

    const nextRate = Math.min(100, Math.max(0, normalizedNumber));
    this.taxRate.set(nextRate);
    this.taxAmount.set(this.roundMoney((this.subtotal() * nextRate) / 100));
  }

  protected formatMoney(value: number): string {
    return value.toFixed(2);
  }

  protected async submitManualExpense(): Promise<void> {
    const file = this.selectedFile();
    this.submitError.set(null);
    this.submitState.set(null);
    this.saveError.set(null);
    this.saveState.set(null);
    this.submitting.set(true);

    try {
      const { draftId, originalFileName } = await this.resolveDraftForSubmit(file);
      const payload = this.buildDocumentPayload();

      const submitted = await firstValueFrom(
        this.documentsApi.submitReviewedDocument({
          draftId,
          originalFileName,
          source: 'manual-entry',
          confidenceLabel: 'Manual entry',
          ...payload,
        }),
      );

      this.submitState.set(`${submitted.status} · ${submitted.reference}`);
    } catch (error) {
      this.submitError.set(
        error instanceof Error ? toUserFacingError(error.message) : 'Không thể gửi chứng từ thủ công.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  protected async saveDraft(): Promise<void> {
    this.saveError.set(null);
    this.saveState.set(null);
    this.submitError.set(null);
    this.savingDraft.set(true);

    try {
      const file = this.selectedFile();
      const existingDraftId = this.editingDraftId();
      const payload = this.buildDocumentPayload();
      let draftId: string;

      if (file) {
        const resolved = await this.resolveDraftForSubmit(file);
        draftId = await this.saveReviewedDraftWithManualData(resolved.draftId, payload);
        this.editingDraftId.set(draftId);
      } else if (existingDraftId) {
        draftId = await this.saveReviewedDraftWithManualData(existingDraftId, payload);
      } else {
        draftId = await firstValueFrom(
          this.documentsApi.saveManualDraft({
            originalFileName: this.selectedFileName() ?? 'manual-entry',
            ...payload,
          }),
        );
        this.editingDraftId.set(draftId);
      }

      this.saveState.set(`Đã lưu nháp · ${draftId}`);
    } catch (error) {
      this.saveError.set(
        error instanceof Error ? toUserFacingError(error.message) : 'Không thể lưu bản nháp.',
      );
    } finally {
      this.savingDraft.set(false);
    }
  }

  private setSelectedFile(file: File | null): void {
    if (!file) {
      this.clearSelectedFile();
      return;
    }

    this.selectedFile.set(file);
    this.selectedFileName.set(file.name);
    this.selectedFileType.set(file.type || null);
    this.submitState.set(null);
    this.submitError.set(null);

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

  private clearSelectedFile(): void {
    this.selectedFile.set(null);
    this.selectedFileName.set(null);
    this.selectedFileType.set(null);
    this.selectedPreviewUrl.set(null);
    this.selectedPdfPreviewUrl.set(null);

    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }
  }

  private buildDocumentPayload() {
    const state = this.formState();
    const lineItems = this.lineItems().map((item) => ({
      itemName: item.description,
      quantity: item.quantity,
      unitPrice: item.quantity > 0 ? item.grossAmount / item.quantity : item.grossAmount,
      total: item.grossAmount - item.discountAmount,
      taxRate: item.taxRate ?? null,
      taxableAmount: item.taxableAmount ?? 0,
      taxAmount: item.taxAmount ?? 0,
    }));

    return {
      vendorName: state.vendorSupplier,
      reference: state.invoiceNumber,
      documentDate: state.invoiceDate,
      category: state.category,
      vendorTaxId: state.taxId,
      subtotal: this.subtotal(),
      vat: this.effectiveTaxAmount(),
      totalAmount: this.totalAmount(),
      taxLines: this.buildTaxLines(),
      lineItems,
    };
  }

  private loadDraft(draftId: string): void {
    this.editingDraftId.set(draftId);
    this.submitError.set(null);
    this.saveError.set(null);
    this.submitState.set(null);
    this.saveState.set(null);

    this.documentsApi
      .getMyDocumentDraft(draftId)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (draft) => {
          this.applyDraft(draft);
        },
        error: (error: Error) => {
          this.submitError.set(toUserFacingError(error.message));
        },
      });
  }

  private loadCategories(): void {
    this.categoryOptions.set([...EXPENSE_CATEGORIES]);
  }

  private applyDraft(draft: DocumentReviewDraftResponse): void {
    this.editingDraftId.set(draft.documentId);
    this.selectedFileName.set(draft.originalFileName);
    this.selectedFileType.set(draft.contentType || null);
    this.selectedFile.set(null);
    this.applyDraftPreview(draft);
    this.formState.set({
      vendorSupplier: draft.vendorName,
      invoiceNumber: draft.reference,
      invoiceDate: draft.documentDate,
      category: draft.category,
      taxId: draft.vendorTaxId ?? '',
    });
    this.lineItems.set(
      draft.lineItems.length
        ? draft.lineItems.map((item) => ({
            type: 'standard' as LineItemType,
            description: item.itemName,
            quantity: item.quantity,
            grossAmount: item.total,
            discountAmount: 0,
            taxRate: item.taxRate ?? null,
            taxableAmount: item.taxableAmount ?? item.total,
            taxAmount: item.taxAmount ?? 0,
          }))
        : [
            {
              type: 'standard' as LineItemType,
              description: '',
              quantity: 1,
              grossAmount: 0,
              discountAmount: 0,
              taxRate: null,
              taxableAmount: 0,
              taxAmount: 0,
            },
          ],
    );
    const primaryTaxLine = draft.taxLines?.[0];
    this.taxRate.set(primaryTaxLine?.rate ?? null);
    this.taxAmount.set(primaryTaxLine?.taxAmount ?? draft.vat);
  }

  private buildTaxLines() {
    const groupedTaxLines = this.groupedLineTaxLines();
    if (groupedTaxLines.length) {
      return groupedTaxLines;
    }

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

  private moveLineItem(items: LineItem[], fromIndex: number, toIndex: number): LineItem[] {
    const nextItems = [...items];
    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem);
    return nextItems;
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }

  private calculateLineTaxFields(item: LineItem): Pick<LineItem, 'taxableAmount' | 'taxAmount'> {
    const taxRate = item.taxRate ?? null;
    if (taxRate === null) {
      return {
        taxableAmount: 0,
        taxAmount: 0,
      };
    }

    const taxableAmount = this.roundMoney(item.grossAmount - item.discountAmount);

    return {
      taxableAmount,
      taxAmount: this.roundMoney((taxableAmount * taxRate) / 100),
    };
  }

  private groupLineTaxLines(items: LineItem[]) {
    const groups = new Map<string, { taxType: string; rate: number | null; taxableAmount: number; taxAmount: number }>();

    for (const item of items) {
      if (!this.hasLineTax(item)) {
        continue;
      }

      const taxRate = item.taxRate ?? null;
      const taxableAmount = item.taxableAmount ?? 0;
      const taxAmount = item.taxAmount ?? 0;
      const key = taxRate === null ? 'null' : taxRate.toFixed(2);
      const current = groups.get(key) ?? {
        taxType: 'VAT',
        rate: taxRate,
        taxableAmount: 0,
        taxAmount: 0,
      };

      current.taxableAmount = this.roundMoney(current.taxableAmount + taxableAmount);
      current.taxAmount = this.roundMoney(current.taxAmount + taxAmount);
      groups.set(key, current);
    }

    return Array.from(groups.values()).filter((line) => line.taxAmount > 0 || line.rate !== null);
  }

  private hasLineTax(item: Pick<LineItem, 'taxRate' | 'taxableAmount' | 'taxAmount'>): boolean {
    return (item.taxRate ?? null) !== null || (item.taxableAmount ?? 0) > 0 || (item.taxAmount ?? 0) > 0;
  }

  private async resolveDraftForSubmit(file: File | null): Promise<{
    draftId: string | null;
    originalFileName: string;
  }> {
    let draftId: string | null = null;
    let originalFileName = this.selectedFileName() ?? 'manual-entry';

    if (!file) {
      return { draftId, originalFileName };
    }

    const base64Content = await this.toBase64(file);
    const uploadDraft = await firstValueFrom(
      this.documentsApi.uploadManualAttachmentDraft(file.name, file.type, base64Content),
    );
    draftId = uploadDraft.documentId;
    originalFileName = file.name;

    return { draftId, originalFileName };
  }

  private async saveReviewedDraftWithManualData(
    draftId: string | null,
    payload: ReturnType<DocumentsManualPageComponent['buildDocumentPayload']>,
  ): Promise<string> {
    if (!draftId) {
      throw new Error('Không thể lưu tệp đính kèm vì chưa tạo được bản nháp chứng từ.');
    }

    return firstValueFrom(
      this.documentsApi.saveReviewedOcrDraft({
        draftId,
        confidenceLabel: 'Manual entry',
        ...payload,
      }),
    );
  }

  private applyDraftPreview(draft: DocumentReviewDraftResponse): void {
    if (this.previewUrl) {
      URL.revokeObjectURL(this.previewUrl);
      this.previewUrl = null;
    }

    const preview = draft.previewImageDataUrl;
    if (!preview) {
      this.selectedPreviewUrl.set(null);
      this.selectedPdfPreviewUrl.set(null);
      return;
    }

    if (draft.contentType === 'application/pdf') {
      this.selectedPreviewUrl.set(null);
      this.selectedPdfPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(preview));
      return;
    }

    this.selectedPreviewUrl.set(preview);
    this.selectedPdfPreviewUrl.set(null);
  }

  private async toBase64(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (const byte of bytes) {
      binary += String.fromCharCode(byte);
    }

    return btoa(binary);
  }

  private formatDisplayDate(rawValue: string): string {
    if (!rawValue) {
      return '';
    }

    const date = new Date(`${rawValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return '';
    }

    return new Intl.DateTimeFormat('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }
}
