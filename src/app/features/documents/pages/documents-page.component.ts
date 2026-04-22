import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import {
  DocumentReviewDraftResponse,
  DocumentsApiService,
  MyDocumentDraftResponse,
  MySubmittedDocumentResponse,
  OcrLineItem,
  SubmitReviewedDocumentDraft,
} from '../data/documents-api.service';
import { ReviewedDocumentDraft, ReviewedLineItem } from '../data/documents-review.models';

interface DocumentsKpi {
  label: string;
  value: string;
  accent?: string;
}

interface ReviewPresentation {
  helper: string;
  precision: string;
  source: string;
}

@Component({
  selector: 'app-documents-page',
  standalone: true,
  templateUrl: './documents-page.component.html',
  styleUrl: './documents-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPageComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly documentsApi = inject(DocumentsApiService);

  protected readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');
  protected readonly pageCopy =
    'Your personal OCR workspace for uploading documents, correcting AI suggestions, and tracking manager decisions after submission.';

  protected readonly myDrafts = signal<MyDocumentDraftResponse[]>([]);
  protected readonly mySubmitted = signal<MySubmittedDocumentResponse[]>([]);
  protected readonly isDraftsLoading = signal(true);
  protected readonly isSubmittedLoading = signal(true);
  protected readonly draftsLoadError = signal<string | null>(null);
  protected readonly submittedLoadError = signal<string | null>(null);
  protected readonly isWorkspaceLoading = computed(
    () => this.isDraftsLoading() || this.isSubmittedLoading(),
  );
  protected readonly workspaceError = computed(() => {
    const messages = [this.draftsLoadError(), this.submittedLoadError()].filter(
      (message): message is string => Boolean(message),
    );
    return messages.length > 0 ? messages.join(' ') : null;
  });
  protected readonly isReviewOpen = signal(false);
  protected readonly isUploading = signal(false);
  protected readonly openingDraftId = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly reviewError = signal<string | null>(null);
  protected readonly reviewDraft = signal<ReviewedDocumentDraft | null>(null);
  protected readonly reviewPresentation = signal<ReviewPresentation | null>(null);
  protected readonly lastSubmittedReference = signal<string | null>(null);
  protected readonly uploadedFileName = signal<string | null>(null);
  protected readonly uploadedFileType = signal<string | null>(null);
  protected readonly uploadedPreviewKind = signal<'pdf' | 'image' | 'other' | null>(null);
  protected readonly uploadedPreviewUrl = signal<SafeResourceUrl | string | null>(null);
  protected readonly kpis = computed<DocumentsKpi[]>(() => {
    const drafts = this.myDrafts();
    const submitted = this.mySubmitted();
    const rejected = submitted.filter((item) => item.status === 'Rejected').length;
    const approved = submitted.filter((item) => item.status === 'Approved').length;

    return [
      { label: 'My drafts', value: String(drafts.length), accent: 'Server-backed OCR items' },
      { label: 'Submitted history', value: String(submitted.length), accent: 'Read-only tracking' },
      { label: 'Needs attention', value: String(rejected), accent: rejected > 0 ? 'Review rejection notes' : 'No returned items' },
      { label: 'Approved', value: String(approved), accent: approved > 0 ? 'Completed decisions' : 'Awaiting manager action' },
    ];
  });

  private uploadedObjectUrl: string | null = null;

  constructor() {
    this.loadWorkspace();
  }

  protected triggerUploadPicker(): void {
    if (this.isUploading()) {
      return;
    }

    this.fileInput()?.nativeElement.click();
  }

  protected handleFileSelection(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }

    this.reviewError.set(null);
    this.clearWorkspaceLoadErrors();
    this.lastSubmittedReference.set(null);
    this.openingDraftId.set(null);
    this.prepareUploadedPreview(file);
    this.isUploading.set(true);

    this.readFileAsBase64(file)
      .then((base64Content) => {
        this.documentsApi
          .uploadDocumentForReview(file.name, file.type || 'application/octet-stream', base64Content)
          .subscribe({
            next: (draft) => {
              this.reviewDraft.set(this.mapUploadResponseToDraft(draft));
              this.reviewPresentation.set(this.createPresentation(draft, false));
              this.isReviewOpen.set(true);
              this.isUploading.set(false);
              this.loadWorkspace();
            },
            error: (error: Error) => {
              this.reviewError.set(error.message);
              this.clearUploadedFileState();
              this.isUploading.set(false);
            },
          });
      })
      .catch(() => {
        this.reviewError.set('Unable to read the selected file for OCR review.');
        this.clearUploadedFileState();
        this.isUploading.set(false);
      })
      .finally(() => {
        if (input) {
          input.value = '';
        }
      });
  }

  protected closeReview(): void {
    this.isReviewOpen.set(false);
    this.isSubmitting.set(false);
    this.openingDraftId.set(null);
    this.reviewError.set(null);
    this.reviewDraft.set(null);
    this.reviewPresentation.set(null);
    this.clearUploadedFileState();
  }

  protected updateDraft<K extends keyof ReviewedDocumentDraft>(
    key: K,
    value: ReviewedDocumentDraft[K],
  ): void {
    const draft = this.reviewDraft();
    if (!draft) {
      return;
    }

    this.reviewDraft.set({
      ...draft,
      [key]: value,
    });
  }

  protected updateDraftLineItem(index: number, key: keyof ReviewedLineItem, value: string): void {
    const draft = this.reviewDraft();
    if (!draft) {
      return;
    }

    this.reviewDraft.set({
      ...draft,
      lineItems: draft.lineItems.map((item, currentIndex) =>
        currentIndex === index
          ? {
              ...item,
              [key]: value,
            }
          : item,
      ),
    });
  }

  protected submitReview(): void {
    const draft = this.reviewDraft();
    if (!draft) {
      return;
    }

    const numericError = this.validateNumericFields(draft);
    if (numericError) {
      this.reviewError.set(numericError);
      return;
    }

    this.reviewError.set(null);
    this.isSubmitting.set(true);

    this.documentsApi.submitReviewedDocument(this.mapDraftToSubmitInput(draft)).subscribe({
      next: (submitted) => {
        this.lastSubmittedReference.set(submitted.reference);
        this.closeReview();
        this.loadWorkspace();
      },
      error: (error: Error) => {
        this.reviewError.set(error.message);
        this.isSubmitting.set(false);
      },
      complete: () => {
        this.isSubmitting.set(false);
      },
    });
  }

  protected resumeDraft(documentId: string): void {
    if (this.openingDraftId()) {
      return;
    }

    this.reviewError.set(null);
    this.clearWorkspaceLoadErrors();
    this.lastSubmittedReference.set(null);
    this.isSubmitting.set(false);
    this.openingDraftId.set(documentId);

    this.documentsApi
      .getMyDocumentDraft(documentId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (draft) => {
          this.clearUploadedFileState();
          this.reviewDraft.set(this.mapUploadResponseToDraft(draft));
          this.reviewPresentation.set(this.createPresentation(draft, true));
          this.isReviewOpen.set(true);
          this.openingDraftId.set(null);
        },
        error: (error: Error) => {
          this.reviewError.set(error.message);
          this.isReviewOpen.set(false);
          this.openingDraftId.set(null);
        },
      });
  }

  protected trackByDocumentId(_: number, item: { documentId: string }): string {
    return item.documentId;
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  }

  protected formatDateTime(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(parsed);
  }

  private loadWorkspace(): void {
    this.loadDrafts();
    this.loadSubmittedHistory();
  }

  private loadDrafts(): void {
    this.isDraftsLoading.set(true);
    this.draftsLoadError.set(null);

    this.documentsApi
      .getMyDocumentDrafts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (drafts) => {
          this.myDrafts.set(drafts);
          this.isDraftsLoading.set(false);
        },
        error: (error: Error) => {
          this.myDrafts.set([]);
          this.draftsLoadError.set(error.message);
          this.isDraftsLoading.set(false);
        },
      });
  }

  private loadSubmittedHistory(): void {
    this.isSubmittedLoading.set(true);
    this.submittedLoadError.set(null);

    this.documentsApi
      .getMySubmittedDocuments()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (submitted) => {
          this.mySubmitted.set(submitted);
          this.isSubmittedLoading.set(false);
        },
        error: (error: Error) => {
          this.mySubmitted.set([]);
          this.submittedLoadError.set(error.message);
          this.isSubmittedLoading.set(false);
        },
      });
  }

  private mapUploadResponseToDraft(draft: DocumentReviewDraftResponse): ReviewedDocumentDraft {
    return {
      documentId: draft.documentId,
      vendor: draft.vendorName,
      reference: draft.reference,
      documentDate: draft.documentDate,
      dueDate: draft.dueDate,
      category: draft.category,
      vendorTaxId: draft.vendorTaxId,
      subtotal: this.formatCurrency(draft.subtotal),
      vat: this.formatCurrency(draft.vat),
      totalAmount: this.formatCurrency(draft.totalAmount),
      source: draft.source,
      originalFileName: draft.originalFileName,
      contentType: draft.contentType,
      ocrPrecision: draft.confidenceLabel,
      lineItems: draft.lineItems.map((item) => this.mapLineItemFromApi(item)),
      reviewedByStaffEmail: draft.reviewedByStaff,
    };
  }

  private mapLineItemFromApi(item: OcrLineItem): ReviewedLineItem {
    return {
      name: item.itemName,
      qty: String(item.quantity),
      unitPrice: this.formatCurrency(item.unitPrice),
      total: this.formatCurrency(item.total),
    };
  }

  private mapDraftToSubmitInput(draft: ReviewedDocumentDraft): SubmitReviewedDocumentDraft {
    return {
      documentId: draft.documentId,
      originalFileName: draft.originalFileName,
      contentType: draft.contentType,
      vendorName: draft.vendor,
      reference: draft.reference,
      documentDate: draft.documentDate,
      dueDate: draft.dueDate,
      category: draft.category,
      vendorTaxId: draft.vendorTaxId,
      subtotal: this.requireNumericValue(draft.subtotal, 'Subtotal'),
      vat: this.requireNumericValue(draft.vat, 'Tax (VAT)'),
      totalAmount: this.requireNumericValue(draft.totalAmount, 'Total amount (USD)'),
      source: draft.source,
      confidenceLabel: draft.ocrPrecision,
      lineItems: draft.lineItems.map((item, index) => ({
        itemName: item.name,
        quantity: this.requireNumericValue(item.qty, `line item ${index + 1} Qty`),
        unitPrice: this.requireNumericValue(item.unitPrice, `line item ${index + 1} Unit price`),
        total: this.requireNumericValue(item.total, `line item ${index + 1} Total`),
      })),
    };
  }

  private createPresentation(
    draft: DocumentReviewDraftResponse,
    isResumedDraft: boolean,
  ): ReviewPresentation {
    return {
      helper: isResumedDraft
        ? 'Resume your personal draft from the server and finish correcting OCR fields before submission.'
        : 'AI extracted fields from the uploaded source file. Staff can correct any field before submission.',
      precision: draft.confidenceLabel,
      source: draft.source,
    };
  }

  private prepareUploadedPreview(file: File): void {
    this.releaseUploadedPreview();
    this.uploadedFileName.set(file.name);
    this.uploadedFileType.set(file.type || null);
    this.setUploadedPreview(file);
  }

  private setUploadedPreview(file: File): void {
    const lowerName = file.name.toLowerCase();
    const isPdf = file.type.includes('pdf') || lowerName.endsWith('.pdf');
    const isImage = file.type.startsWith('image/');

    if (!isPdf && !isImage) {
      this.uploadedPreviewKind.set('other');
      return;
    }

    this.uploadedObjectUrl = URL.createObjectURL(file);
    this.uploadedPreviewKind.set(isPdf ? 'pdf' : 'image');
    this.uploadedPreviewUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.uploadedObjectUrl));
  }

  private clearUploadedFileState(): void {
    this.uploadedFileName.set(null);
    this.uploadedFileType.set(null);
    this.uploadedPreviewKind.set(null);
    this.uploadedPreviewUrl.set(null);
    this.releaseUploadedPreview();
  }

  private releaseUploadedPreview(): void {
    if (this.uploadedObjectUrl) {
      URL.revokeObjectURL(this.uploadedObjectUrl);
      this.uploadedObjectUrl = null;
    }
  }

  private readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const base64 = result.includes(',') ? result.split(',')[1] : result;
        if (!base64) {
          reject(new Error('Unable to read selected file.'));
          return;
        }

        resolve(base64);
      };
      reader.onerror = () => reject(reader.error ?? new Error('Unable to read selected file.'));
      reader.readAsDataURL(file);
    });
  }

  private validateNumericFields(draft: ReviewedDocumentDraft): string | null {
    const fieldChecks = [
      { label: 'Subtotal', value: draft.subtotal, requiresPositive: true },
      { label: 'Tax (VAT)', value: draft.vat, requiresPositive: false },
      { label: 'Total amount (USD)', value: draft.totalAmount, requiresPositive: true },
    ];

    for (const field of fieldChecks) {
      const parsed = this.parseNumericValue(field.value);
      if (parsed === null) {
        return `Enter a valid number for ${field.label} before submitting.`;
      }

      if (field.requiresPositive && parsed <= 0) {
        return `Enter a value greater than 0 for ${field.label} before submitting.`;
      }
    }

    for (const [index, item] of draft.lineItems.entries()) {
      const lineItemChecks = [
        { label: `line item ${index + 1} Qty`, value: item.qty },
        { label: `line item ${index + 1} Unit price`, value: item.unitPrice },
        { label: `line item ${index + 1} Total`, value: item.total },
      ];

      for (const field of lineItemChecks) {
        const parsed = this.parseNumericValue(field.value);
        if (parsed === null) {
          return `Enter a valid number for ${field.label} before submitting.`;
        }

        if (parsed <= 0) {
          return `Enter a value greater than 0 for ${field.label} before submitting.`;
        }
      }
    }

    const subtotal = this.parseNumericValue(draft.subtotal);
    const vat = this.parseNumericValue(draft.vat);
    const totalAmount = this.parseNumericValue(draft.totalAmount);
    if (subtotal === null || vat === null || totalAmount === null) {
      return 'Enter valid totals before submitting.';
    }

    if (!this.areCurrencyValuesEqual(subtotal + vat, totalAmount)) {
      return 'Subtotal plus Tax (VAT) must match Total amount (USD) before submitting.';
    }

    const lineItemTotal = draft.lineItems.reduce((sum, item) => {
      const parsed = this.parseNumericValue(item.total);
      return sum + (parsed ?? 0);
    }, 0);

    if (!this.areCurrencyValuesEqual(lineItemTotal, totalAmount)) {
      return 'Line item totals must match Total amount (USD) before submitting.';
    }

    return null;
  }

  private requireNumericValue(value: string, label: string): number {
    const parsed = this.parseNumericValue(value);
    if (parsed === null) {
      throw new Error(`Enter a valid number for ${label} before submitting.`);
    }

    return parsed;
  }

  private parseNumericValue(value: string): number | null {
    const normalized = value.trim();
    if (!normalized) {
      return null;
    }

    const strictNumericPattern = /^\$?(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?$/;
    if (!strictNumericPattern.test(normalized)) {
      return null;
    }

    const parsed = Number(normalized.replace('$', '').replaceAll(',', ''));
    return Number.isFinite(parsed) ? parsed : null;
  }

  private areCurrencyValuesEqual(left: number, right: number): boolean {
    return Math.abs(left - right) < 0.005;
  }

  private clearWorkspaceLoadErrors(): void {
    this.draftsLoadError.set(null);
    this.submittedLoadError.set(null);
  }
}
