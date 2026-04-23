import 'zone.js';

import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Router } from '@angular/router';
import { DocumentsApiService } from '../../data/documents.api.service';
import { CreateManualDocumentDraftInput } from '../../data/documents.models';
import { DocumentManualEntryPageComponent } from './document-manual-entry-page.component';

describe('DocumentManualEntryPageComponent', () => {
  const documentsApiService = {
    createManualDraft: vi.fn(),
    submitReviewedDocument: vi.fn(),
    deleteDraft: vi.fn(),
  };
  const router = {
    navigateByUrl: vi.fn(),
  };

  const originalFileReader = globalThis.FileReader;
  const originalCreateObjectUrl = URL.createObjectURL;
  const originalRevokeObjectUrl = URL.revokeObjectURL;

  beforeEach(async () => {
    Object.values(documentsApiService).forEach((mockFn) => mockFn.mockReset());
    router.navigateByUrl.mockReset();
    router.navigateByUrl.mockResolvedValue(true);

    let draftNumber = 0;

    documentsApiService.createManualDraft.mockImplementation(
      (input: CreateManualDocumentDraftInput) => {
        draftNumber += 1;

        return of({
          documentId: `manual-draft-00${draftNumber}`,
          originalFileName: input.imageFileName ?? 'manual-entry',
          contentType: input.imageContentType ?? 'application/json',
          vendorName: input.vendorName,
          reference: input.reference,
          documentDate: input.documentDate,
          dueDate: input.dueDate,
          category: input.category,
          vendorTaxId: input.vendorTaxId ?? null,
          subtotal: input.subtotal,
          vat: input.vat,
          totalAmount: input.totalAmount,
          source: 'Manual',
          reviewedByStaff: 'reviewer@finflow.local',
          confidenceLabel: 'Manual',
          hasImage: !!input.base64ImageContent,
          lineItems: input.lineItems,
        });
      },
    );
    documentsApiService.submitReviewedDocument.mockReturnValue(
      of({
        documentId: 'manual-draft-001',
        status: 'Submitted',
        submittedAt: '2026-04-23T08:00:00Z',
        vendorName: 'Acme Supplies',
        reference: 'INV-2026-0042',
        totalAmount: 1320,
        dueDate: '2026-04-30',
        reviewedByStaff: 'reviewer@finflow.local',
      }),
    );
    documentsApiService.deleteDraft.mockReturnValue(of(true));

    class FileReaderStub {
      result: string | ArrayBuffer | null = null;
      onload: null | (() => void) = null;
      onerror: null | (() => void) = null;

      readAsDataURL(file: File): void {
        const mockBase64 = (file as File & { mockBase64?: string }).mockBase64;

        if (mockBase64) {
          this.result = `data:${file.type || 'application/octet-stream'};base64,${mockBase64}`;
        } else if (file.type === 'image/png') {
          this.result = 'data:image/png;base64,preview-image-content';
        } else {
          this.result = 'data:application/octet-stream;base64,base64-file-content';
        }

        this.onload?.();
      }
    }

    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      value: FileReaderStub,
    });

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((file: File) => `blob:${file.name}`),
    });

    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });

    await TestBed.configureTestingModule({
      imports: [DocumentManualEntryPageComponent],
      providers: [
        {
          provide: DocumentsApiService,
          useValue: documentsApiService,
        },
        {
          provide: Router,
          useValue: router,
        },
      ],
    }).compileComponents();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'FileReader', {
      configurable: true,
      value: originalFileReader,
    });

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: originalCreateObjectUrl,
    });

    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: originalRevokeObjectUrl,
    });
  });

  function setInputValue(
    fixture: ReturnType<typeof TestBed.createComponent<DocumentManualEntryPageComponent>>,
    selector: string,
    value: string,
    index = 0,
  ): void {
    const input = fixture.nativeElement.querySelectorAll(selector).item(index) as
      | HTMLInputElement
      | HTMLSelectElement
      | null;

    expect(input).not.toBeNull();

    input!.value = value;
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    input!.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function selectFile(
    fixture: ReturnType<typeof TestBed.createComponent<DocumentManualEntryPageComponent>>,
    file: File,
  ): Promise<void> {
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement | null;

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

  function createImageFile(
    fileName: string,
    mockBase64: string,
    overrides?: Partial<{ type: string; size: number; lastModified: number }>,
  ): File {
    const file = new File(['x'], fileName, {
      type: overrides?.type ?? 'image/png',
      lastModified: overrides?.lastModified ?? 1713830400000,
    }) as File & { mockBase64?: string };

    file.mockBase64 = mockBase64;

    if (overrides?.size !== undefined) {
      Object.defineProperty(file, 'size', {
        configurable: true,
        value: overrides.size,
      });
    }

    return file;
  }

  async function clickAction(
    fixture: ReturnType<typeof TestBed.createComponent<DocumentManualEntryPageComponent>>,
    label: 'Save Draft' | 'Submit',
  ): Promise<void> {
    const button =
      Array.from<HTMLButtonElement>(
        fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
      ).find((candidate) => candidate.textContent?.includes(label)) ?? null;

    expect(button).not.toBeNull();

    button!.click();
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  }

  async function fillManualEntryForm(
    fixture: ReturnType<typeof TestBed.createComponent<DocumentManualEntryPageComponent>>,
  ): Promise<void> {
    setInputValue(fixture, 'input[formcontrolname="vendorName"]', 'Acme Supplies');
    setInputValue(fixture, 'input[formcontrolname="reference"]', 'INV-2026-0042');
    setInputValue(fixture, 'input[formcontrolname="documentDate"]', '2026-04-10');
    setInputValue(fixture, 'input[formcontrolname="dueDate"]', '2026-04-30');
    setInputValue(fixture, 'input[formcontrolname="category"]', 'Office');
    setInputValue(fixture, 'input[formcontrolname="vendorTaxId"]', 'TAX-9988');
    setInputValue(fixture, 'input[formcontrolname="subtotal"]', '1200');
    setInputValue(fixture, 'input[formcontrolname="vat"]', '120');
    setInputValue(fixture, 'input[formcontrolname="totalAmount"]', '1320');

    const addLineItemButton = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((button) => button.textContent?.includes('Add line item'));

    expect(addLineItemButton).not.toBeNull();

    addLineItemButton!.click();
    fixture.detectChanges();

    setInputValue(fixture, 'input[formcontrolname="itemName"]', 'Printer paper', 0);
    setInputValue(fixture, 'input[formcontrolname="quantity"]', '10', 0);
    setInputValue(fixture, 'input[formcontrolname="unitPrice"]', '12', 0);
    setInputValue(fixture, 'input[formcontrolname="total"]', '120', 0);

    setInputValue(fixture, 'input[formcontrolname="itemName"]', 'Ink cartridge', 1);
    setInputValue(fixture, 'input[formcontrolname="quantity"]', '4', 1);
    setInputValue(fixture, 'input[formcontrolname="unitPrice"]', '75', 1);
    setInputValue(fixture, 'input[formcontrolname="total"]', '300', 1);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders save draft and submit actions', () => {
    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('Save Draft');
    expect(textContent).toContain('Submit');
  });

  it('lets a user add a line item and save a manual draft', async () => {
    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    await fillManualEntryForm(fixture);
    await clickAction(fixture, 'Save Draft');

    expect(documentsApiService.createManualDraft).toHaveBeenCalledWith({
      vendorName: 'Acme Supplies',
      reference: 'INV-2026-0042',
      documentDate: '2026-04-10',
      dueDate: '2026-04-30',
      category: 'Office',
      vendorTaxId: 'TAX-9988',
      subtotal: 1200,
      vat: 120,
      totalAmount: 1320,
      lineItems: [
        {
          itemName: 'Printer paper',
          quantity: 10,
          unitPrice: 12,
          total: 120,
        },
        {
          itemName: 'Ink cartridge',
          quantity: 4,
          unitPrice: 75,
          total: 300,
        },
      ],
      imageFileName: null,
      imageContentType: null,
      base64ImageContent: null,
    });
  });

  it('creates a draft first and then submits the manual entry document', async () => {
    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    await fillManualEntryForm(fixture);
    await clickAction(fixture, 'Submit');

    expect(documentsApiService.createManualDraft).toHaveBeenCalledTimes(1);
    expect(documentsApiService.submitReviewedDocument).toHaveBeenCalledWith({
      documentId: 'manual-draft-001',
      originalFileName: 'manual-entry',
      contentType: 'application/json',
      vendorName: 'Acme Supplies',
      reference: 'INV-2026-0042',
      documentDate: '2026-04-10',
      dueDate: '2026-04-30',
      category: 'Office',
      vendorTaxId: 'TAX-9988',
      subtotal: 1200,
      vat: 120,
      totalAmount: 1320,
      source: 'Manual',
      confidenceLabel: 'Manual',
      lineItems: [
        {
          itemName: 'Printer paper',
          quantity: 10,
          unitPrice: 12,
          total: 120,
        },
        {
          itemName: 'Ink cartridge',
          quantity: 4,
          unitPrice: 75,
          total: 300,
        },
      ],
    });
    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/documents/list');
  });

  it('does not create duplicate drafts when save is clicked again without changes', async () => {
    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    await fillManualEntryForm(fixture);
    await clickAction(fixture, 'Save Draft');
    await clickAction(fixture, 'Save Draft');

    expect(documentsApiService.createManualDraft).toHaveBeenCalledTimes(1);
    expect(documentsApiService.deleteDraft).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Draft already up to date.');
  });

  it('creates a fresh draft before submit when a saved draft becomes dirty', async () => {
    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    await fillManualEntryForm(fixture);
    await clickAction(fixture, 'Save Draft');

    setInputValue(fixture, 'input[formcontrolname="reference"]', 'INV-2026-0043');
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    await clickAction(fixture, 'Submit');

    expect(documentsApiService.createManualDraft).toHaveBeenCalledTimes(2);
    expect(documentsApiService.deleteDraft).toHaveBeenCalledWith('manual-draft-001');
    expect(documentsApiService.submitReviewedDocument).toHaveBeenCalledWith({
      documentId: 'manual-draft-002',
      originalFileName: 'manual-entry',
      contentType: 'application/json',
      vendorName: 'Acme Supplies',
      reference: 'INV-2026-0043',
      documentDate: '2026-04-10',
      dueDate: '2026-04-30',
      category: 'Office',
      vendorTaxId: 'TAX-9988',
      subtotal: 1200,
      vat: 120,
      totalAmount: 1320,
      source: 'Manual',
      confidenceLabel: 'Manual',
      lineItems: [
        {
          itemName: 'Printer paper',
          quantity: 10,
          unitPrice: 12,
          total: 120,
        },
        {
          itemName: 'Ink cartridge',
          quantity: 4,
          unitPrice: 75,
          total: 300,
        },
      ],
    });
    expect(fixture.nativeElement.textContent).toContain(
      'Saved a fresh draft before submit so your latest manual changes were included.',
    );
  });

  it('shows a local image preview and includes the converted image in the saved draft payload', async () => {
    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    await fillManualEntryForm(fixture);
    await selectFile(fixture, new File(['preview'], 'invoice.png', { type: 'image/png' }));
    await clickAction(fixture, 'Save Draft');

    const previewImage = fixture.nativeElement.querySelector(
      '.manual-entry-page__preview img',
    ) as HTMLImageElement | null;

    expect(previewImage?.src).toContain('blob:invoice.png');
    expect(documentsApiService.createManualDraft).toHaveBeenCalledWith({
      vendorName: 'Acme Supplies',
      reference: 'INV-2026-0042',
      documentDate: '2026-04-10',
      dueDate: '2026-04-30',
      category: 'Office',
      vendorTaxId: 'TAX-9988',
      subtotal: 1200,
      vat: 120,
      totalAmount: 1320,
      lineItems: [
        {
          itemName: 'Printer paper',
          quantity: 10,
          unitPrice: 12,
          total: 120,
        },
        {
          itemName: 'Ink cartridge',
          quantity: 4,
          unitPrice: 75,
          total: 300,
        },
      ],
      imageFileName: 'invoice.png',
      imageContentType: 'image/png',
      base64ImageContent: 'preview-image-content',
    });
  });

  it('reuses an unchanged saved draft when submitting with the same attachment', async () => {
    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    await fillManualEntryForm(fixture);
    await selectFile(fixture, new File(['image-a'], 'invoice-a.png', { type: 'image/png' }));
    await clickAction(fixture, 'Save Draft');
    await clickAction(fixture, 'Submit');

    expect(documentsApiService.createManualDraft).toHaveBeenCalledTimes(1);
    expect(documentsApiService.deleteDraft).not.toHaveBeenCalled();
    expect(documentsApiService.submitReviewedDocument).toHaveBeenCalledWith({
      documentId: 'manual-draft-001',
      originalFileName: 'invoice-a.png',
      contentType: 'image/png',
      vendorName: 'Acme Supplies',
      reference: 'INV-2026-0042',
      documentDate: '2026-04-10',
      dueDate: '2026-04-30',
      category: 'Office',
      vendorTaxId: 'TAX-9988',
      subtotal: 1200,
      vat: 120,
      totalAmount: 1320,
      source: 'Manual',
      confidenceLabel: 'Manual',
      lineItems: [
        {
          itemName: 'Printer paper',
          quantity: 10,
          unitPrice: 12,
          total: 120,
        },
        {
          itemName: 'Ink cartridge',
          quantity: 4,
          unitPrice: 75,
          total: 300,
        },
      ],
    });
    expect(fixture.nativeElement.textContent).toContain(
      'Submitted the existing saved draft because nothing changed.',
    );
  });

  it('creates a fresh draft when the attachment changes before submit', async () => {
    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    await fillManualEntryForm(fixture);
    await selectFile(fixture, createImageFile('invoice-a.png', 'image-content-a'));
    await clickAction(fixture, 'Save Draft');
    await selectFile(fixture, createImageFile('invoice-b.png', 'image-content-b'));
    await clickAction(fixture, 'Submit');

    expect(documentsApiService.createManualDraft).toHaveBeenCalledTimes(2);
    expect(documentsApiService.deleteDraft).toHaveBeenCalledWith('manual-draft-001');
    expect(documentsApiService.submitReviewedDocument).toHaveBeenCalledWith({
      documentId: 'manual-draft-002',
      originalFileName: 'invoice-b.png',
      contentType: 'image/png',
      vendorName: 'Acme Supplies',
      reference: 'INV-2026-0042',
      documentDate: '2026-04-10',
      dueDate: '2026-04-30',
      category: 'Office',
      vendorTaxId: 'TAX-9988',
      subtotal: 1200,
      vat: 120,
      totalAmount: 1320,
      source: 'Manual',
      confidenceLabel: 'Manual',
      lineItems: [
        {
          itemName: 'Printer paper',
          quantity: 10,
          unitPrice: 12,
          total: 120,
        },
        {
          itemName: 'Ink cartridge',
          quantity: 4,
          unitPrice: 75,
          total: 300,
        },
      ],
    });
  });

  it('treats an attachment with the same metadata but different content as dirty', async () => {
    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    await fillManualEntryForm(fixture);
    await selectFile(
      fixture,
      createImageFile('invoice.png', 'image-content-a', {
        type: 'image/png',
        size: 2048,
        lastModified: 1713830400000,
      }),
    );
    await clickAction(fixture, 'Save Draft');
    await selectFile(
      fixture,
      createImageFile('invoice.png', 'image-content-b', {
        type: 'image/png',
        size: 2048,
        lastModified: 1713830400000,
      }),
    );
    await clickAction(fixture, 'Submit');

    expect(documentsApiService.createManualDraft).toHaveBeenCalledTimes(2);
    expect(documentsApiService.submitReviewedDocument).toHaveBeenCalledWith(
      expect.objectContaining({
        documentId: 'manual-draft-002',
      }),
    );
  });

  it('surfaces old draft cleanup failure after replacing a saved draft', async () => {
    documentsApiService.deleteDraft.mockReturnValueOnce(of(false));

    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    await fillManualEntryForm(fixture);
    await selectFile(fixture, createImageFile('invoice-a.png', 'image-content-a'));
    await clickAction(fixture, 'Save Draft');
    await selectFile(fixture, createImageFile('invoice-b.png', 'image-content-b'));
    await clickAction(fixture, 'Submit');

    expect(documentsApiService.createManualDraft).toHaveBeenCalledTimes(2);
    expect(documentsApiService.deleteDraft).toHaveBeenCalledWith('manual-draft-001');
    expect(documentsApiService.submitReviewedDocument).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain(
      'The latest draft was saved, but the previous draft could not be cleaned up automatically.',
    );
  });

  it('rejects invalid optional attachment types', async () => {
    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    await selectFile(fixture, new File(['notes'], 'invoice.txt', { type: 'text/plain' }));

    expect(documentsApiService.createManualDraft).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'Unsupported file type. Upload a PNG, JPG, JPEG, or WebP file.',
    );
    expect(fixture.nativeElement.querySelector('.manual-entry-page__preview img')).toBeNull();
  });

  it('rejects oversized optional attachments using the upload size policy', async () => {
    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    await selectFile(
      fixture,
      createImageFile('invoice.png', 'preview-image-content', {
        type: 'image/png',
        size: 10 * 1024 * 1024 + 1,
      }),
    );

    expect(documentsApiService.createManualDraft).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain(
      'File is too large. The maximum upload size is 10 MB.',
    );
  });

  it('shows submit failure feedback when reviewed submission fails', async () => {
    documentsApiService.submitReviewedDocument.mockReturnValueOnce(
      throwError(() => new Error('Submit failed at the API.')),
    );

    const fixture = TestBed.createComponent(DocumentManualEntryPageComponent);
    fixture.detectChanges();

    await fillManualEntryForm(fixture);
    await clickAction(fixture, 'Submit');

    expect(documentsApiService.submitReviewedDocument).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Submit failed at the API.');
  });
});
