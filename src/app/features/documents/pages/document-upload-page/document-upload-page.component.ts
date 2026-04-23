import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  ReactiveFormsModule,
  UntypedFormArray,
  UntypedFormBuilder,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { DocumentDraftDetail, DocumentLineItem, SubmitReviewedDocumentInput } from '../../data/documents.models';
import { DocumentsApiService } from '../../data/documents.api.service';
import { toBase64 } from '../../data/to-base64';
import { DocumentLineItemsEditorComponent } from '../../ui/document-line-items-editor/document-line-items-editor.component';
import { FileDropzoneComponent } from '../../ui/file-dropzone/file-dropzone.component';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_FILE_TYPES = new Map<string, string>([
  ['.pdf', 'application/pdf'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.webp', 'image/webp'],
]);
const SUPPORTED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

@Component({
  selector: 'app-document-upload-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    FileDropzoneComponent,
    DocumentLineItemsEditorComponent,
  ],
  templateUrl: './document-upload-page.component.html',
  styleUrl: './document-upload-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentUploadPageComponent {
  private readonly formBuilder = inject(UntypedFormBuilder);
  private readonly documentsApiService = inject(DocumentsApiService);
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
    lineItems: this.formBuilder.array([]),
  });

  protected readonly selectedFileName = signal<string | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly uploadError = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly reviewError = signal<string | null>(null);
  protected readonly isUploading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly draft = signal<DocumentDraftDetail | null>(null);
  protected readonly lineItems = this.form.controls['lineItems'] as UntypedFormArray;
  protected readonly isBusy = computed(() => this.isUploading() || this.isSubmitting());

  protected async onFileSelected(file: File): Promise<void> {
    this.fileError.set(null);
    this.uploadError.set(null);
    this.submitError.set(null);
    this.reviewError.set(null);

    const resolvedContentType = this.resolveContentType(file);
    const validationMessage = this.validateFile(file, resolvedContentType);
    if (validationMessage) {
      this.selectedFileName.set(null);
      this.draft.set(null);
      this.form.reset();
      this.lineItems.clear();
      this.fileError.set(validationMessage);
      return;
    }

    this.selectedFileName.set(file.name);
    this.isUploading.set(true);
    this.draft.set(null);

    try {
      const base64Content = await toBase64(file);
      const draft = await firstValueFrom(
        this.documentsApiService.uploadForReview({
          fileName: file.name,
          contentType: resolvedContentType!,
          base64Content,
        }),
      );

      this.draft.set(draft);
      this.populateForm(draft);
    } catch (error: unknown) {
      this.draft.set(null);
      this.uploadError.set(this.toErrorMessage(error, 'Unable to upload this document for OCR review.'));
    } finally {
      this.isUploading.set(false);
    }
  }

  protected async submitForReview(): Promise<void> {
    this.submitError.set(null);
    this.reviewError.set(null);
    this.form.markAllAsTouched();

    const draft = this.draft();
    if (!draft || this.isBusy()) {
      return;
    }

    if (this.form.invalid) {
      this.reviewError.set('Please fix the highlighted review fields before submitting.');
      return;
    }

    this.isSubmitting.set(true);

    try {
      await firstValueFrom(
        this.documentsApiService.submitReviewedDocument(this.mapDraftToSubmitInput(draft)),
      );
      await this.router.navigateByUrl('/app/documents/list');
    } catch (error: unknown) {
      this.submitError.set(this.toErrorMessage(error, 'Unable to submit this reviewed document.'));
    } finally {
      this.isSubmitting.set(false);
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

  private validateFile(file: File, resolvedContentType: string | null): string | null {
    if (!resolvedContentType) {
      return 'Unsupported file type. Upload a PDF, PNG, JPG, JPEG, or WebP file.';
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      return 'File is too large. The maximum upload size is 10 MB.';
    }

    return null;
  }

  private populateForm(draft: DocumentDraftDetail): void {
    this.form.patchValue({
      vendorName: draft.vendorName,
      reference: draft.reference,
      documentDate: draft.documentDate,
      dueDate: draft.dueDate,
      category: draft.category,
      vendorTaxId: draft.vendorTaxId ?? '',
      subtotal: draft.subtotal,
      vat: draft.vat,
      totalAmount: draft.totalAmount,
    });

    this.lineItems.clear();
    draft.lineItems.forEach((lineItem) => {
      this.lineItems.push(this.createLineItemGroup(lineItem));
    });
  }

  private createLineItemGroup(lineItem: DocumentLineItem) {
    return this.formBuilder.group({
      itemName: [lineItem.itemName, Validators.required],
      quantity: [lineItem.quantity, [Validators.required, Validators.min(0.01)]],
      unitPrice: [lineItem.unitPrice, [Validators.required, Validators.min(0)]],
      total: [lineItem.total, [Validators.required, Validators.min(0)]],
    });
  }

  private mapDraftToSubmitInput(draft: DocumentDraftDetail): SubmitReviewedDocumentInput {
    const formValue = this.form.getRawValue();

    return {
      documentId: draft.documentId,
      originalFileName: draft.originalFileName,
      contentType: draft.contentType,
      vendorName: formValue.vendorName ?? '',
      reference: formValue.reference ?? '',
      documentDate: formValue.documentDate ?? '',
      dueDate: formValue.dueDate ?? '',
      category: formValue.category ?? '',
      vendorTaxId: formValue.vendorTaxId ? formValue.vendorTaxId : null,
      subtotal: Number(formValue.subtotal ?? 0),
      vat: Number(formValue.vat ?? 0),
      totalAmount: Number(formValue.totalAmount ?? 0),
      source: draft.source,
      confidenceLabel: draft.confidenceLabel,
      lineItems: ((formValue.lineItems ?? []) as Array<Record<string, unknown>>).map((lineItem) => ({
        itemName: String(lineItem['itemName'] ?? ''),
        quantity: Number(lineItem['quantity'] ?? 0),
        unitPrice: Number(lineItem['unitPrice'] ?? 0),
        total: Number(lineItem['total'] ?? 0),
      })),
    };
  }

  private toErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error) {
      return error.message;
    }

    return fallback;
  }

  private resolveContentType(file: File): string | null {
    if (SUPPORTED_CONTENT_TYPES.has(file.type)) {
      return file.type;
    }

    const extension = this.getFileExtension(file.name);
    if (!extension) {
      return null;
    }

    return SUPPORTED_FILE_TYPES.get(extension) ?? null;
  }

  private getFileExtension(fileName: string): string | null {
    const extensionIndex = fileName.lastIndexOf('.');
    if (extensionIndex < 0) {
      return null;
    }

    return fileName.slice(extensionIndex).toLowerCase();
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

  protected hasInvalidField(controlName: string): boolean {
    const control = this.form.get(controlName);
    return this.isInvalidControl(control);
  }

  private isInvalidControl(control: AbstractControl | null): boolean {
    return !!control && control.invalid && control.touched;
  }
}
