import 'zone.js';

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentsApiService } from '../../data/documents.api.service';
import { DocumentUploadPageComponent } from './document-upload-page.component';

describe('DocumentUploadPageComponent', () => {
  const documentsApiService = {
    uploadForReview: vi.fn(),
    submitReviewedDocument: vi.fn(),
  };
  const originalFileReader = globalThis.FileReader;

  beforeEach(async () => {
    Object.values(documentsApiService).forEach((mockFn) => mockFn.mockReset());

    class FileReaderStub {
      result: string | ArrayBuffer | null = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      readAsDataURL(): void {
        this.result = 'data:application/pdf;base64,base64-pdf-content';
        this.onload?.();
      }
    }

    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      value: FileReaderStub,
    });

    documentsApiService.uploadForReview.mockReturnValue(
      of({
        documentId: 'draft-ocr-001',
        originalFileName: 'invoice.pdf',
        contentType: 'application/pdf',
        vendorName: 'Acme Supplies',
        reference: 'INV-2026-0042',
        documentDate: '2026-04-10',
        dueDate: '2026-04-30',
        category: 'Office',
        vendorTaxId: 'TAX-9988',
        subtotal: 1200,
        vat: 120,
        totalAmount: 1320,
        source: 'Upload',
        reviewedByStaff: 'reviewer@finflow.local',
        confidenceLabel: 'High',
        hasImage: true,
        lineItems: [
          {
            itemName: 'Printer paper',
            quantity: 10,
            unitPrice: 12,
            total: 120,
          },
        ],
      }),
    );
    documentsApiService.submitReviewedDocument.mockReturnValue(
      of({
        documentId: 'draft-ocr-001',
        status: 'Submitted',
        submittedAt: '2026-04-23T08:00:00Z',
        vendorName: 'Acme Supplies',
        reference: 'INV-2026-0042',
        totalAmount: 1320,
        dueDate: '2026-04-30',
        reviewedByStaff: 'reviewer@finflow.local',
      }),
    );

    await TestBed.configureTestingModule({
      imports: [DocumentUploadPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: DocumentsApiService,
          useValue: documentsApiService,
        },
      ],
    }).compileComponents();
  });

  function createFile(fileName: string, type: string, size = 11): File {
    const file = new File(['x'.repeat(Math.max(size, 1))], fileName, {
      type,
    });

    if (file.size !== size) {
      Object.defineProperty(file, 'size', {
        configurable: true,
        value: size,
      });
    }

    return file;
  }

  async function selectFile(
    fixture: ReturnType<typeof TestBed.createComponent<DocumentUploadPageComponent>>,
    file: File,
  ) {
    const input: HTMLInputElement | null = fixture.nativeElement.querySelector('input[type="file"]');

    expect(input).not.toBeNull();

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    });

    input!.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  afterEach(() => {
    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      value: originalFileReader,
    });
  });

  it('uploads a supported pdf and renders the OCR review form', async () => {
    const fixture = TestBed.createComponent(DocumentUploadPageComponent);
    fixture.detectChanges();

    await selectFile(fixture, createFile('invoice.pdf', 'application/pdf'));

    expect(documentsApiService.uploadForReview).toHaveBeenCalledWith({
      fileName: 'invoice.pdf',
      contentType: 'application/pdf',
      base64Content: 'base64-pdf-content',
    });

    const textContent = fixture.nativeElement.textContent;
    const vendorNameInput = fixture.nativeElement.querySelector(
      'input[formcontrolname="vendorName"]',
    ) as HTMLInputElement | null;

    expect(textContent).toContain('OCR review');
    expect(vendorNameInput?.value).toBe('Acme Supplies');
    expect(textContent).toContain('Submit for Review');
  });

  it('submits the reviewed OCR draft with backend-aligned values', async () => {
    const fixture = TestBed.createComponent(DocumentUploadPageComponent);
    fixture.detectChanges();

    await selectFile(fixture, createFile('invoice.pdf', 'application/pdf'));

    const submitButton =
      Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((button: HTMLButtonElement) => button.textContent?.includes('Submit for Review')) ??
      null;

    expect(submitButton).not.toBeNull();

    submitButton!.click();
    fixture.detectChanges();

    expect(documentsApiService.submitReviewedDocument).toHaveBeenCalledWith({
      documentId: 'draft-ocr-001',
      originalFileName: 'invoice.pdf',
      contentType: 'application/pdf',
      vendorName: 'Acme Supplies',
      reference: 'INV-2026-0042',
      documentDate: '2026-04-10',
      dueDate: '2026-04-30',
      category: 'Office',
      vendorTaxId: 'TAX-9988',
      subtotal: 1200,
      vat: 120,
      totalAmount: 1320,
      source: 'Upload',
      confidenceLabel: 'High',
      lineItems: [
        {
          itemName: 'Printer paper',
          quantity: 10,
          unitPrice: 12,
          total: 120,
        },
      ],
    });
  });

  it('accepts a supported extension when the browser does not provide a file type', async () => {
    const fixture = TestBed.createComponent(DocumentUploadPageComponent);
    fixture.detectChanges();

    await selectFile(fixture, createFile('invoice.pdf', ''));

    expect(documentsApiService.uploadForReview).toHaveBeenCalledWith({
      fileName: 'invoice.pdf',
      contentType: 'application/pdf',
      base64Content: 'base64-pdf-content',
    });
  });

  it('shows a validation message for unsupported file types', async () => {
    const fixture = TestBed.createComponent(DocumentUploadPageComponent);
    fixture.detectChanges();

    await selectFile(fixture, createFile('invoice.txt', 'text/plain'));

    expect(documentsApiService.uploadForReview).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Unsupported file type. Upload a PDF, PNG, JPG, JPEG, or WebP file.',
    );
  });

  it('shows a validation message for oversized files', async () => {
    const fixture = TestBed.createComponent(DocumentUploadPageComponent);
    fixture.detectChanges();

    await selectFile(fixture, createFile('invoice.pdf', 'application/pdf', 10 * 1024 * 1024 + 1));

    expect(documentsApiService.uploadForReview).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'File is too large. The maximum upload size is 10 MB.',
    );
  });

  it('shows an upload error when OCR draft creation fails', async () => {
    documentsApiService.uploadForReview.mockReturnValueOnce(
      throwError(() => new Error('Upload failed at the API.')),
    );

    const fixture = TestBed.createComponent(DocumentUploadPageComponent);
    fixture.detectChanges();

    await selectFile(fixture, createFile('invoice.pdf', 'application/pdf'));

    expect(fixture.nativeElement.textContent).toContain('Upload failed at the API.');
    expect(fixture.nativeElement.textContent).not.toContain('OCR review');
  });

  it('shows submit failure feedback when reviewed submission fails', async () => {
    documentsApiService.submitReviewedDocument.mockReturnValueOnce(
      throwError(() => new Error('Submit failed at the API.')),
    );

    const fixture = TestBed.createComponent(DocumentUploadPageComponent);
    fixture.detectChanges();

    await selectFile(fixture, createFile('invoice.pdf', 'application/pdf'));

    const submitButton = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;

    expect(submitButton).not.toBeNull();

    submitButton!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(documentsApiService.submitReviewedDocument).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Submit failed at the API.');
  });

  it('shows field guidance when OCR draft values are invalid for review submission', async () => {
    documentsApiService.uploadForReview.mockReturnValueOnce(
      of({
        documentId: 'draft-ocr-002',
        originalFileName: 'invalid-invoice.pdf',
        contentType: 'application/pdf',
        vendorName: '',
        reference: '',
        documentDate: '2026-04-10',
        dueDate: '2026-04-30',
        category: '',
        vendorTaxId: null,
        subtotal: 1200,
        vat: 120,
        totalAmount: 1320,
        source: 'Upload',
        reviewedByStaff: 'reviewer@finflow.local',
        confidenceLabel: 'Medium',
        hasImage: true,
        lineItems: [
          {
            itemName: '',
            quantity: 0,
            unitPrice: 12,
            total: 120,
          },
        ],
      }),
    );

    const fixture = TestBed.createComponent(DocumentUploadPageComponent);
    fixture.detectChanges();

    await selectFile(fixture, createFile('invalid-invoice.pdf', 'application/pdf'));

    const submitButton = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement | null;

    expect(submitButton?.disabled).toBe(false);

    submitButton!.click();
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(documentsApiService.submitReviewedDocument).not.toHaveBeenCalled();
    expect(textContent).toContain('Please fix the highlighted review fields before submitting.');
    expect(textContent).toContain('Vendor name is required.');
    expect(textContent).toContain('Reference is required.');
    expect(textContent).toContain('Category is required.');
    expect(textContent).toContain('Line item name is required.');
    expect(textContent).toContain('Line item quantity must be greater than 0.');
  });
});
