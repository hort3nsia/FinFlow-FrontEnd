import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnDestroy,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
  CreateManualDocumentDraftInput,
  DocumentDraftDetail,
  DocumentLineItem,
  SubmitReviewedDocumentInput,
} from '../../data/documents.models';
import { DocumentsApiService } from '../../data/documents.api.service';
import { toBase64 } from '../../data/to-base64';
import { DocumentLineItemsEditorComponent } from '../../ui/document-line-items-editor/document-line-items-editor.component';

interface ImageSelection {
  file: File;
  previewUrl: string;
  base64Content: string;
  contentType: string;
  signature: string;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_IMAGE_FILE_TYPES = new Map<string, string>([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
]);
const SUPPORTED_IMAGE_CONTENT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

@Component({
  selector: 'app-document-manual-entry-page',
  standalone: true,
  imports: [ReactiveFormsModule, DocumentLineItemsEditorComponent],
  templateUrl: './document-manual-entry-page.component.html',
  styleUrl: './document-manual-entry-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentManualEntryPageComponent implements OnDestroy {
  private readonly formBuilder = inject(UntypedFormBuilder);
  private readonly documentsApiService = inject(DocumentsApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  protected readonly form = this.formBuilder.group({
    vendorName: ['', Validators.required],
    reference: ['', Validators.required],
    documentDate: ['', Validators.required],
    dueDate: ['', Validators.required],
    category: ['', Validators.required],
    vendorTaxId: [''],
    subtotal: [0, [Validators.required, Validators.min(0)]],
    vat: [0, [Validators.required, Validators.min(0)]],
    totalAmount: [0, [Validators.required, Validators.min(0)]],
    lineItems: this.formBuilder.array([this.createLineItemGroup()]),
  });

  protected readonly lineItems = this.form.controls['lineItems'] as UntypedFormArray;
  protected readonly selectedImage = signal<ImageSelection | null>(null);
  protected readonly selectedImageName = computed(() => this.selectedImage()?.file.name ?? null);
  protected readonly imagePreviewUrl = computed(() => this.selectedImage()?.previewUrl ?? null);
  protected readonly imageError = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly saveSuccess = signal<string | null>(null);
  protected readonly submitSuccess = signal<string | null>(null);
  protected readonly draftLifecycleMessage = signal<string | null>(null);
  protected readonly cleanupWarning = signal<string | null>(null);
  protected readonly isSaving = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly draft = signal<DocumentDraftDetail | null>(null);
  private readonly currentSnapshot = signal('');
  private readonly lastPersistedSnapshot = signal<string | null>(null);
  protected readonly isBusy = computed(() => this.isSaving() || this.isSubmitting());
  protected readonly hasSavedDraft = computed(() => this.draft() !== null);
  protected readonly isDraftDirty = computed(() => {
    const draft = this.draft();
    const lastSnapshot = this.lastPersistedSnapshot();
    return !!draft && !!lastSnapshot && lastSnapshot !== this.currentSnapshot();
  });

  constructor() {
    this.refreshCurrentSnapshot();

    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.refreshCurrentSnapshot();
      });
  }

  ngOnDestroy(): void {
    this.revokePreviewUrl(this.selectedImage()?.previewUrl ?? null);
  }

  protected async saveDraft(): Promise<void> {
    this.clearFeedback();
    this.form.markAllAsTouched();

    if (this.form.invalid || this.isBusy()) {
      if (this.form.invalid) {
        this.saveError.set('Please fix the highlighted fields before saving.');
      }
      return;
    }

    const existingDraft = this.draft();
    if (existingDraft && !this.isDraftDirty()) {
      this.saveSuccess.set('Draft already up to date.');
      this.draftLifecycleMessage.set('Reused the existing saved draft because nothing changed.');
      return;
    }

    this.isSaving.set(true);

    try {
      const result = await this.createDraftFromCurrentState(existingDraft);
      this.draft.set(result.draft);
      this.lastPersistedSnapshot.set(this.currentSnapshot());
      this.saveSuccess.set('Draft saved successfully.');
      this.cleanupWarning.set(result.cleanupWarning);
      this.draftLifecycleMessage.set(
        existingDraft
          ? 'Saved a fresh draft because the manual entry changed.'
          : 'Saved a new draft for this manual entry.',
      );
    } catch (error: unknown) {
      this.saveError.set(this.toErrorMessage(error, 'Unable to save this draft.'));
    } finally {
      this.isSaving.set(false);
    }
  }

  protected async submit(): Promise<void> {
    this.clearFeedback();
    this.form.markAllAsTouched();

    if (this.form.invalid || this.isBusy()) {
      if (this.form.invalid) {
        this.submitError.set('Please fix the highlighted fields before submitting.');
      }
      return;
    }

    this.isSubmitting.set(true);

    try {
      const existingDraft = this.draft();
      const shouldReuseDraft = !!existingDraft && !this.isDraftDirty();
      const result = shouldReuseDraft
        ? { draft: existingDraft, cleanupWarning: null }
        : await this.createDraftFromCurrentState(existingDraft);
      const draft = result.draft;

      this.draft.set(draft);
      this.lastPersistedSnapshot.set(this.currentSnapshot());
      this.cleanupWarning.set(result.cleanupWarning);

      await firstValueFrom(
        this.documentsApiService.submitReviewedDocument(this.mapDraftToSubmitInput(draft)),
      );
      await this.router.navigateByUrl('/app/documents/list');

      this.submitSuccess.set('Document submitted successfully.');
      this.draftLifecycleMessage.set(
        shouldReuseDraft
          ? 'Submitted the existing saved draft because nothing changed.'
          : 'Saved a fresh draft before submit so your latest manual changes were included.',
      );
    } catch (error: unknown) {
      this.submitError.set(this.toErrorMessage(error, 'Unable to submit this document.'));
    } finally {
      this.isSubmitting.set(false);
    }
  }

  protected async onImageSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement | null;
    const files = input?.files;
    const file =
      files && typeof files.item === 'function' ? files.item(0) : (files?.[0] ?? null);

    this.clearFeedback();

    if (!file) {
      this.clearSelectedImage();
      this.refreshCurrentSnapshot();
      return;
    }

    const resolvedContentType = this.resolveImageContentType(file);
    const validationMessage = this.validateImageFile(file, resolvedContentType);
    if (validationMessage) {
      this.clearSelectedImage();
      this.imageError.set(validationMessage);
      this.refreshCurrentSnapshot();
      if (input) {
        input.value = '';
      }
      return;
    }

    try {
      const base64Content = await toBase64(file);
      this.setSelectedImage(file, resolvedContentType!, base64Content);
      this.refreshCurrentSnapshot();
    } catch (error: unknown) {
      this.clearSelectedImage();
      this.imageError.set(this.toErrorMessage(error, 'Unable to read the selected image.'));
      this.refreshCurrentSnapshot();
    }
  }

  protected getFieldError(controlName: string): string | null {
    const control = this.form.get(controlName);
    if (!control || !control.touched || !control.errors) {
      return null;
    }

    if (control.errors['required']) {
      return `${this.getFieldLabel(controlName)} is required.`;
    }

    if (control.errors['min']) {
      return `${this.getFieldLabel(controlName)} must be 0 or more.`;
    }

    return 'Please review this field.';
  }

  protected hasInvalidField(controlName: string): boolean {
    const control = this.form.get(controlName);
    return !!control && control.invalid && control.touched;
  }

  private async createDraftFromCurrentState(
    previousDraft: DocumentDraftDetail | null,
  ): Promise<{ draft: DocumentDraftDetail; cleanupWarning: string | null }> {
    const input = await this.buildDraftInput();
    const newDraft = await firstValueFrom(this.documentsApiService.createManualDraft(input));
    let cleanupWarning: string | null = null;

    if (previousDraft && previousDraft.documentId !== newDraft.documentId) {
      const wasDeleted = await firstValueFrom(
        this.documentsApiService.deleteDraft(previousDraft.documentId).pipe(
          catchError(() => of(false)),
        ),
      );

      if (!wasDeleted) {
        cleanupWarning =
          'The latest draft was saved, but the previous draft could not be cleaned up automatically.';
      }
    }

    return { draft: newDraft, cleanupWarning };
  }

  private async buildDraftInput(): Promise<CreateManualDocumentDraftInput> {
    const formValue = this.form.getRawValue();
    const selectedImage = this.selectedImage();

    let imageFileName: string | null = null;
    let imageContentType: string | null = null;
    let base64ImageContent: string | null = null;

    if (selectedImage) {
      imageFileName = selectedImage.file.name;
      imageContentType = selectedImage.contentType;
      base64ImageContent = selectedImage.base64Content;
    }

    return {
      vendorName: String(formValue.vendorName ?? ''),
      reference: String(formValue.reference ?? ''),
      documentDate: String(formValue.documentDate ?? ''),
      dueDate: String(formValue.dueDate ?? ''),
      category: String(formValue.category ?? ''),
      vendorTaxId: formValue.vendorTaxId ? String(formValue.vendorTaxId) : null,
      subtotal: Number(formValue.subtotal ?? 0),
      vat: Number(formValue.vat ?? 0),
      totalAmount: Number(formValue.totalAmount ?? 0),
      lineItems: ((formValue.lineItems ?? []) as Array<Record<string, unknown>>).map((lineItem) =>
        this.mapLineItem(lineItem),
      ),
      imageFileName,
      imageContentType,
      base64ImageContent,
    };
  }

  private mapDraftToSubmitInput(draft: DocumentDraftDetail): SubmitReviewedDocumentInput {
    const formValue = this.form.getRawValue();

    return {
      documentId: draft.documentId,
      originalFileName: draft.originalFileName,
      contentType: draft.contentType,
      vendorName: String(formValue.vendorName ?? ''),
      reference: String(formValue.reference ?? ''),
      documentDate: String(formValue.documentDate ?? ''),
      dueDate: String(formValue.dueDate ?? ''),
      category: String(formValue.category ?? ''),
      vendorTaxId: formValue.vendorTaxId ? String(formValue.vendorTaxId) : null,
      subtotal: Number(formValue.subtotal ?? 0),
      vat: Number(formValue.vat ?? 0),
      totalAmount: Number(formValue.totalAmount ?? 0),
      source: draft.source,
      confidenceLabel: draft.confidenceLabel,
      lineItems: ((formValue.lineItems ?? []) as Array<Record<string, unknown>>).map((lineItem) =>
        this.mapLineItem(lineItem),
      ),
    };
  }

  private mapLineItem(lineItem: Record<string, unknown>): DocumentLineItem {
    return {
      itemName: String(lineItem['itemName'] ?? ''),
      quantity: Number(lineItem['quantity'] ?? 0),
      unitPrice: Number(lineItem['unitPrice'] ?? 0),
      total: Number(lineItem['total'] ?? 0),
    };
  }

  private clearFeedback(): void {
    this.imageError.set(null);
    this.saveError.set(null);
    this.submitError.set(null);
    this.saveSuccess.set(null);
    this.submitSuccess.set(null);
    this.draftLifecycleMessage.set(null);
    this.cleanupWarning.set(null);
  }

  private createLineItemGroup() {
    return this.formBuilder.group({
      itemName: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(0.01)]],
      unitPrice: [0, [Validators.required, Validators.min(0)]],
      total: [0, [Validators.required, Validators.min(0)]],
    });
  }

  private getFieldLabel(controlName: string): string {
    switch (controlName) {
      case 'vendorName':
        return 'Vendor name';
      case 'reference':
        return 'Reference';
      case 'documentDate':
        return 'Document date';
      case 'dueDate':
        return 'Due date';
      case 'category':
        return 'Category';
      case 'subtotal':
        return 'Subtotal';
      case 'vat':
        return 'VAT';
      case 'totalAmount':
        return 'Total amount';
      default:
        return 'Field';
    }
  }

  private validateImageFile(file: File, resolvedContentType: string | null): string | null {
    if (!resolvedContentType) {
      return 'Unsupported file type. Upload a PNG, JPG, JPEG, or WebP file.';
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'File is too large. The maximum upload size is 10 MB.';
    }

    return null;
  }

  private resolveImageContentType(file: File): string | null {
    if (SUPPORTED_IMAGE_CONTENT_TYPES.has(file.type)) {
      return file.type;
    }

    const extension = this.getFileExtension(file.name);
    if (!extension) {
      return null;
    }

    return SUPPORTED_IMAGE_FILE_TYPES.get(extension) ?? null;
  }

  private getFileExtension(fileName: string): string | null {
    const extensionIndex = fileName.lastIndexOf('.');
    if (extensionIndex < 0) {
      return null;
    }

    return fileName.slice(extensionIndex).toLowerCase();
  }

  private setSelectedImage(file: File, contentType: string, base64Content: string): void {
    this.revokePreviewUrl(this.selectedImage()?.previewUrl ?? null);

    this.selectedImage.set({
      file,
      previewUrl: URL.createObjectURL(file),
      base64Content,
      contentType,
      signature: this.createFileSignature(base64Content),
    });
  }

  private clearSelectedImage(): void {
    this.revokePreviewUrl(this.selectedImage()?.previewUrl ?? null);
    this.selectedImage.set(null);
  }

  private revokePreviewUrl(previewUrl: string | null): void {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
  }

  private createFileSignature(base64Content: string): string {
    return base64Content;
  }

  private refreshCurrentSnapshot(): void {
    this.currentSnapshot.set(this.serializeCurrentState());
  }

  private serializeCurrentState(): string {
    const formValue = this.form.getRawValue();

    return JSON.stringify({
      vendorName: String(formValue.vendorName ?? ''),
      reference: String(formValue.reference ?? ''),
      documentDate: String(formValue.documentDate ?? ''),
      dueDate: String(formValue.dueDate ?? ''),
      category: String(formValue.category ?? ''),
      vendorTaxId: formValue.vendorTaxId ? String(formValue.vendorTaxId) : null,
      subtotal: Number(formValue.subtotal ?? 0),
      vat: Number(formValue.vat ?? 0),
      totalAmount: Number(formValue.totalAmount ?? 0),
      lineItems: ((formValue.lineItems ?? []) as Array<Record<string, unknown>>).map((lineItem) =>
        this.mapLineItem(lineItem),
      ),
      imageSignature: this.selectedImage()?.signature ?? null,
    });
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message;
    }

    return fallback;
  }

}
