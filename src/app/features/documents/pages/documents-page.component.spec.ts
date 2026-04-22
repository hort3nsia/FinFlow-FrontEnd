import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentsApiService } from '../data/documents-api.service';
import { DocumentsPageComponent } from './documents-page.component';

describe('DocumentsPageComponent', () => {
  const queryText = (fixture: { nativeElement: HTMLElement }, selector: string) =>
    fixture.nativeElement.querySelector(selector)?.textContent?.trim();

  const documentsApi = {
    getMyDocumentDrafts: vi.fn(),
    getMyDocumentDraft: vi.fn(),
    getMySubmittedDocuments: vi.fn(),
    uploadDocumentForReview: vi.fn(),
    submitReviewedDocument: vi.fn(),
  };

  beforeEach(async () => {
    documentsApi.getMyDocumentDrafts.mockReset();
    documentsApi.getMyDocumentDraft.mockReset();
    documentsApi.getMySubmittedDocuments.mockReset();
    documentsApi.uploadDocumentForReview.mockReset();
    documentsApi.submitReviewedDocument.mockReset();

    documentsApi.getMyDocumentDrafts.mockReturnValue(of([]));
    documentsApi.getMyDocumentDraft.mockReturnValue(of(null));
    documentsApi.getMySubmittedDocuments.mockReturnValue(of([]));

    vi.stubGlobal(
      'URL',
      Object.assign(URL, {
        createObjectURL: vi.fn(() => 'blob:mock-preview'),
        revokeObjectURL: vi.fn(),
      }),
    );

    await TestBed.configureTestingModule({
      imports: [DocumentsPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: DocumentsApiService,
          useValue: documentsApi,
        },
      ],
    }).compileComponents();
  });

  it('renders a personal documents workspace with my drafts and my submitted sections', () => {
    documentsApi.getMyDocumentDrafts.mockReturnValue(
      of([
        {
          documentId: 'draft-1',
          originalFileName: 'invoice.pdf',
          vendorName: 'Amazon Web Services, Inc.',
          reference: 'INV-2026-0101',
          totalAmount: 1450,
          confidenceLabel: 'High precision',
          ownerEmail: 'staff.one@finflow.test',
          uploadedAt: '2026-04-19T08:30:00Z',
        },
      ]),
    );
    documentsApi.getMySubmittedDocuments.mockReturnValue(
      of([
        {
          documentId: 'submitted-1',
          originalFileName: 'invoice.pdf',
          vendorName: 'Amazon Web Services, Inc.',
          reference: 'INV-2026-0101',
          totalAmount: 1450,
          status: 'Submitted',
          submittedByEmail: 'staff.one@finflow.test',
          submittedAt: '2026-04-19T09:00:00Z',
          lastUpdatedAt: '2026-04-19T09:00:00Z',
          rejectionReason: null,
        },
      ]),
    );

    const fixture = TestBed.createComponent(DocumentsPageComponent);
    fixture.detectChanges();

    expect(queryText(fixture, '[data-testid="documents-copy"]')).toContain('personal OCR workspace');
    expect(queryText(fixture, '[data-testid="documents-drafts-title"]')).toBe('My Drafts');
    expect(queryText(fixture, '[data-testid="documents-submitted-title"]')).toBe('My Submitted');
    expect(fixture.nativeElement.textContent).toContain('Amazon Web Services, Inc.');
    expect(fixture.nativeElement.textContent).toContain('Submitted');
    expect(fixture.nativeElement.textContent).not.toContain('Incoming Documents Queue');
    expect(fixture.nativeElement.textContent).not.toContain('Ready to publish');
  });

  it('uploads a document through the API and opens the OCR review surface with editable draft data', async () => {
    const fixture = TestBed.createComponent(DocumentsPageComponent);
    const component = fixture.componentInstance as any;
    component.readFileAsBase64 = vi.fn().mockResolvedValue('cGRmLWNvbnRlbnQ=');
    documentsApi.uploadDocumentForReview.mockReturnValue(
      of({
        documentId: 'doc-123',
        originalFileName: 'invoice-9941.pdf',
        contentType: 'application/pdf',
        vendorName: 'Amazon Web Services, Inc.',
        reference: 'INV-2023-9941',
        documentDate: '10/25/2023',
        dueDate: '11/25/2023',
        category: 'Software & SaaS',
        vendorTaxId: 'TX-990-2134',
        subtotal: 1200,
        vat: 250,
        totalAmount: 1450,
        source: 'finance-inbox@finflow',
        reviewedByStaff: 'staff.one@finflow.test',
        confidenceLabel: 'High precision',
        lineItems: [
          {
            itemName: 'Cloud Compute Instance - t3.large',
            quantity: 1,
            unitPrice: 850,
            total: 850,
          },
        ],
      }),
    );

    fixture.detectChanges();

    const fileInput = fixture.nativeElement.querySelector(
      '[data-testid="documents-file-input"]',
    ) as HTMLInputElement;
    const file = new File(['fake-pdf'], 'invoice-9941.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    fileInput.dispatchEvent(new Event('change'));
    await Promise.resolve();
    fixture.detectChanges();

    expect(documentsApi.uploadDocumentForReview).toHaveBeenCalledWith(
      'invoice-9941.pdf',
      'application/pdf',
      'cGRmLWNvbnRlbnQ=',
    );
    expect(queryText(fixture, '[data-testid="documents-review-title"]')).toBe(
      'Invoice Intelligence',
    );
    expect(fixture.nativeElement.textContent).toContain('invoice-9941.pdf');
    expect(
      fixture.nativeElement.querySelector('[data-testid="documents-uploaded-preview"] iframe'),
    ).not.toBeNull();

    const vendorInput = fixture.nativeElement.querySelector(
      '[data-testid="review-vendor-input"]',
    ) as HTMLInputElement;
    const categoryInput = fixture.nativeElement.querySelector('#review-category') as HTMLInputElement;
    const totalAmountInput = fixture.nativeElement.querySelector(
      '#review-total-amount',
    ) as HTMLInputElement;

    expect(vendorInput.value).toBe('Amazon Web Services, Inc.');
    expect(categoryInput.value).toBe('Software & SaaS');
    expect(totalAmountInput.value).toBe('$1,450.00');
  });

  it('resumes a server-backed draft in the OCR review editor', () => {
    documentsApi.getMyDocumentDrafts.mockReturnValue(
      of([
        {
          documentId: 'draft-1',
          originalFileName: 'invoice.pdf',
          vendorName: 'Amazon Web Services, Inc.',
          reference: 'INV-2026-0101',
          totalAmount: 1450,
          confidenceLabel: 'High precision',
          ownerEmail: 'staff.one@finflow.test',
          uploadedAt: '2026-04-19T08:30:00Z',
        },
      ]),
    );
    documentsApi.getMyDocumentDraft.mockReturnValue(
      of({
        documentId: 'draft-1',
        originalFileName: 'invoice.pdf',
        contentType: 'application/pdf',
        vendorName: 'Amazon Web Services, Inc.',
        reference: 'INV-2026-0101',
        documentDate: '2026-04-19',
        dueDate: '2026-05-19',
        category: 'Software & SaaS',
        vendorTaxId: 'TX-990-2134',
        subtotal: 1200,
        vat: 250,
        totalAmount: 1450,
        source: 'finance-inbox@finflow',
        reviewedByStaff: 'staff.one@finflow.test',
        confidenceLabel: 'High precision',
        lineItems: [
          {
            itemName: 'Cloud Compute Instance - t3.large',
            quantity: 1,
            unitPrice: 850,
            total: 850,
          },
        ],
      }),
    );

    const fixture = TestBed.createComponent(DocumentsPageComponent);
    fixture.detectChanges();

    const continueButton = fixture.nativeElement.querySelector(
      '[data-testid="documents-continue-draft"]',
    ) as HTMLButtonElement;
    continueButton.click();
    fixture.detectChanges();

    expect(documentsApi.getMyDocumentDraft).toHaveBeenCalledWith('draft-1');
    expect(queryText(fixture, '[data-testid="documents-review-title"]')).toBe(
      'Invoice Intelligence',
    );
    expect(fixture.nativeElement.textContent).toContain('Resume your personal draft');

    const vendorInput = fixture.nativeElement.querySelector(
      '[data-testid="review-vendor-input"]',
    ) as HTMLInputElement;
    const totalAmountInput = fixture.nativeElement.querySelector(
      '#review-total-amount',
    ) as HTMLInputElement;

    expect(vendorInput.value).toBe('Amazon Web Services, Inc.');
    expect(totalAmountInput.value).toBe('$1,450.00');
  });

  it('refreshes the personal workspace after submit so the item leaves drafts and appears in submitted history', async () => {
    documentsApi.getMyDocumentDrafts
      .mockReturnValueOnce(
        of([
          {
            documentId: 'draft-1',
            originalFileName: 'invoice.pdf',
            vendorName: 'Amazon Web Services, Inc.',
            reference: 'INV-2026-0101',
            totalAmount: 1450,
            confidenceLabel: 'High precision',
            ownerEmail: 'staff.one@finflow.test',
            uploadedAt: '2026-04-19T08:30:00Z',
          },
        ]),
      )
      .mockReturnValueOnce(
        of([
          {
            documentId: 'draft-1',
            originalFileName: 'invoice.pdf',
            vendorName: 'Amazon Web Services, Inc.',
            reference: 'INV-2026-0101',
            totalAmount: 1450,
            confidenceLabel: 'High precision',
            ownerEmail: 'staff.one@finflow.test',
            uploadedAt: '2026-04-19T08:30:00Z',
          },
        ]),
      )
      .mockReturnValueOnce(of([]));
    documentsApi.getMySubmittedDocuments
      .mockReturnValueOnce(of([]))
      .mockReturnValueOnce(of([]))
      .mockReturnValueOnce(
        of([
          {
            documentId: 'submitted-1',
            originalFileName: 'invoice.pdf',
            vendorName: 'Amazon Web Services, Inc.',
            reference: 'INV-2026-0101',
            totalAmount: 1450,
            status: 'Submitted',
            submittedByEmail: 'staff.one@finflow.test',
            submittedAt: '2026-04-19T09:00:00Z',
            lastUpdatedAt: '2026-04-19T09:00:00Z',
            rejectionReason: null,
          },
        ]),
      );
    documentsApi.uploadDocumentForReview.mockReturnValue(
      of({
        documentId: 'draft-1',
        originalFileName: 'invoice.pdf',
        contentType: 'application/pdf',
        vendorName: 'Amazon Web Services, Inc.',
        reference: 'INV-2026-0101',
        documentDate: '2026-04-19',
        dueDate: '2026-05-19',
        category: 'Software & SaaS',
        vendorTaxId: 'TX-990-2134',
        subtotal: 1200,
        vat: 250,
        totalAmount: 1450,
        source: 'finance-inbox@finflow',
        reviewedByStaff: 'staff.one@finflow.test',
        confidenceLabel: 'High precision',
        lineItems: [
          {
            itemName: 'Cloud Compute Instance - t3.large',
            quantity: 1,
            unitPrice: 850,
            total: 850,
          },
          {
            itemName: 'Storage Block (EBS) - 2TB',
            quantity: 1,
            unitPrice: 300,
            total: 300,
          },
          {
            itemName: 'Support Plan - Business',
            quantity: 1,
            unitPrice: 300,
            total: 300,
          },
        ],
      }),
    );
    documentsApi.submitReviewedDocument.mockReturnValue(
      of({
        documentId: 'submitted-1',
        status: 'ReadyForApproval',
        submittedAt: '2026-04-19T09:00:00Z',
        vendorName: 'Amazon Web Services, Inc.',
        reference: 'INV-2026-0101',
        totalAmount: 1450,
        dueDate: '2026-05-19',
        reviewedByStaff: 'staff.one@finflow.test',
      }),
    );

    const fixture = TestBed.createComponent(DocumentsPageComponent);
    const component = fixture.componentInstance as any;
    component.readFileAsBase64 = vi.fn().mockResolvedValue('cGRmLWNvbnRlbnQ=');
    fixture.detectChanges();

    const fileInput = fixture.nativeElement.querySelector(
      '[data-testid="documents-file-input"]',
    ) as HTMLInputElement;
    const file = new File(['fake-pdf'], 'invoice.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    fileInput.dispatchEvent(new Event('change'));
    await Promise.resolve();
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector(
      '[data-testid="documents-submit-review"]',
    ) as HTMLButtonElement;
    submitButton.click();
    fixture.detectChanges();

    expect(documentsApi.submitReviewedDocument).toHaveBeenCalledTimes(1);
    expect(documentsApi.getMyDocumentDrafts).toHaveBeenCalledTimes(3);
    expect(documentsApi.getMySubmittedDocuments).toHaveBeenCalledTimes(3);
    expect(queryText(fixture, '[data-testid="documents-submit-banner"]')).toContain('INV-2026-0101');
    expect(queryText(fixture, '[data-testid="documents-empty-drafts"]')).toContain(
      'No drafts in progress',
    );
    expect(fixture.nativeElement.textContent).toContain('Submitted');
    expect(
      fixture.nativeElement.querySelector('[data-testid="documents-review-surface"]'),
    ).toBeNull();
  });

  it('shows submitted history as read-only tracking with rejection reasons', () => {
    documentsApi.getMySubmittedDocuments.mockReturnValue(
      of([
        {
          documentId: 'submitted-1',
          originalFileName: 'invoice.pdf',
          vendorName: 'Amazon Web Services, Inc.',
          reference: 'INV-2026-0101',
          totalAmount: 1450,
          status: 'Rejected',
          submittedByEmail: 'staff.one@finflow.test',
          submittedAt: '2026-04-19T09:00:00Z',
          lastUpdatedAt: '2026-04-19T10:15:00Z',
          rejectionReason: 'Duplicate invoice submitted',
        },
      ]),
    );

    const fixture = TestBed.createComponent(DocumentsPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Rejected');
    expect(fixture.nativeElement.textContent).toContain('Duplicate invoice submitted');
    expect(fixture.nativeElement.textContent).toContain('read-only status tracking');
    expect(fixture.nativeElement.textContent).not.toContain('Publish approved invoices into Approvals');
  });

  it('blocks submit when a numeric review field is invalid instead of coercing it to zero', async () => {
    const fixture = TestBed.createComponent(DocumentsPageComponent);
    const component = fixture.componentInstance as any;
    component.readFileAsBase64 = vi.fn().mockResolvedValue('cGRmLWNvbnRlbnQ=');
    documentsApi.uploadDocumentForReview.mockReturnValue(
      of({
        documentId: 'doc-123',
        originalFileName: 'invoice-9941.pdf',
        contentType: 'application/pdf',
        vendorName: 'Amazon Web Services, Inc.',
        reference: 'INV-2023-9941',
        documentDate: '10/25/2023',
        dueDate: '11/25/2023',
        category: 'Software & SaaS',
        vendorTaxId: 'TX-990-2134',
        subtotal: 1200,
        vat: 250,
        totalAmount: 1450,
        source: 'finance-inbox@finflow',
        reviewedByStaff: 'staff.one@finflow.test',
        confidenceLabel: 'High precision',
        lineItems: [
          {
            itemName: 'Cloud Compute Instance - t3.large',
            quantity: 1,
            unitPrice: 850,
            total: 850,
          },
        ],
      }),
    );

    fixture.detectChanges();

    const fileInput = fixture.nativeElement.querySelector(
      '[data-testid="documents-file-input"]',
    ) as HTMLInputElement;
    const file = new File(['fake-pdf'], 'invoice-9941.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    fileInput.dispatchEvent(new Event('change'));
    await Promise.resolve();
    fixture.detectChanges();

    const totalAmountInput = fixture.nativeElement.querySelector(
      '#review-total-amount',
    ) as HTMLInputElement;
    totalAmountInput.value = 'not-a-number';
    totalAmountInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector(
      '[data-testid="documents-submit-review"]',
    ) as HTMLButtonElement;
    submitButton.click();
    fixture.detectChanges();

    expect(documentsApi.submitReviewedDocument).not.toHaveBeenCalled();
    expect(queryText(fixture, '[data-testid="documents-review-error"]')).toBe(
      'Enter a valid number for Total amount (USD) before submitting.',
    );
  });

  it('rejects malformed numeric strings instead of partially parsing them', async () => {
    const fixture = TestBed.createComponent(DocumentsPageComponent);
    const component = fixture.componentInstance as any;
    component.readFileAsBase64 = vi.fn().mockResolvedValue('cGRmLWNvbnRlbnQ=');
    documentsApi.uploadDocumentForReview.mockReturnValue(
      of({
        documentId: 'doc-123',
        originalFileName: 'invoice-9941.pdf',
        contentType: 'application/pdf',
        vendorName: 'Amazon Web Services, Inc.',
        reference: 'INV-2023-9941',
        documentDate: '10/25/2023',
        dueDate: '11/25/2023',
        category: 'Software & SaaS',
        vendorTaxId: 'TX-990-2134',
        subtotal: 1200,
        vat: 250,
        totalAmount: 1450,
        source: 'finance-inbox@finflow',
        reviewedByStaff: 'staff.one@finflow.test',
        confidenceLabel: 'High precision',
        lineItems: [
          {
            itemName: 'Cloud Compute Instance - t3.large',
            quantity: 1,
            unitPrice: 850,
            total: 850,
          },
        ],
      }),
    );

    fixture.detectChanges();

    const fileInput = fixture.nativeElement.querySelector(
      '[data-testid="documents-file-input"]',
    ) as HTMLInputElement;
    const file = new File(['fake-pdf'], 'invoice-9941.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    fileInput.dispatchEvent(new Event('change'));
    await Promise.resolve();
    fixture.detectChanges();

    const totalAmountInput = fixture.nativeElement.querySelector(
      '#review-total-amount',
    ) as HTMLInputElement;
    totalAmountInput.value = '1.2.3';
    totalAmountInput.dispatchEvent(new Event('input'));

    const quantityInput = fixture.nativeElement.querySelectorAll(
      '.documents-page__line-item-input',
    )[1] as HTMLInputElement;
    quantityInput.value = '12abc34';
    quantityInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector(
      '[data-testid="documents-submit-review"]',
    ) as HTMLButtonElement;
    submitButton.click();
    fixture.detectChanges();

    expect(documentsApi.submitReviewedDocument).not.toHaveBeenCalled();
    expect(queryText(fixture, '[data-testid="documents-review-error"]')).toBe(
      'Enter a valid number for Total amount (USD) before submitting.',
    );
  });

  it('rejects negative line item quantities before submit', async () => {
    const fixture = TestBed.createComponent(DocumentsPageComponent);
    const component = fixture.componentInstance as any;
    component.readFileAsBase64 = vi.fn().mockResolvedValue('cGRmLWNvbnRlbnQ=');
    documentsApi.uploadDocumentForReview.mockReturnValue(
      of({
        documentId: 'doc-123',
        originalFileName: 'invoice-9941.pdf',
        contentType: 'application/pdf',
        vendorName: 'Amazon Web Services, Inc.',
        reference: 'INV-2023-9941',
        documentDate: '10/25/2023',
        dueDate: '11/25/2023',
        category: 'Software & SaaS',
        vendorTaxId: 'TX-990-2134',
        subtotal: 1200,
        vat: 250,
        totalAmount: 1450,
        source: 'finance-inbox@finflow',
        reviewedByStaff: 'staff.one@finflow.test',
        confidenceLabel: 'High precision',
        lineItems: [
          {
            itemName: 'Cloud Compute Instance - t3.large',
            quantity: 1,
            unitPrice: 850,
            total: 850,
          },
        ],
      }),
    );

    fixture.detectChanges();

    const fileInput = fixture.nativeElement.querySelector(
      '[data-testid="documents-file-input"]',
    ) as HTMLInputElement;
    const file = new File(['fake-pdf'], 'invoice-9941.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    fileInput.dispatchEvent(new Event('change'));
    await Promise.resolve();
    fixture.detectChanges();

    const quantityInput = fixture.nativeElement.querySelectorAll(
      '.documents-page__line-item-input',
    )[1] as HTMLInputElement;
    quantityInput.value = '-1';
    quantityInput.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector(
      '[data-testid="documents-submit-review"]',
    ) as HTMLButtonElement;
    submitButton.click();
    fixture.detectChanges();

    expect(documentsApi.submitReviewedDocument).not.toHaveBeenCalled();
    expect(queryText(fixture, '[data-testid="documents-review-error"]')).toBe(
      'Enter a valid number for line item 1 Qty before submitting.',
    );
  });

  it('rejects mismatched line item totals before submit', async () => {
    const fixture = TestBed.createComponent(DocumentsPageComponent);
    const component = fixture.componentInstance as any;
    component.readFileAsBase64 = vi.fn().mockResolvedValue('cGRmLWNvbnRlbnQ=');
    documentsApi.uploadDocumentForReview.mockReturnValue(
      of({
        documentId: 'doc-123',
        originalFileName: 'invoice-9941.pdf',
        contentType: 'application/pdf',
        vendorName: 'Amazon Web Services, Inc.',
        reference: 'INV-2023-9941',
        documentDate: '10/25/2023',
        dueDate: '11/25/2023',
        category: 'Software & SaaS',
        vendorTaxId: 'TX-990-2134',
        subtotal: 1200,
        vat: 250,
        totalAmount: 1450,
        source: 'finance-inbox@finflow',
        reviewedByStaff: 'staff.one@finflow.test',
        confidenceLabel: 'High precision',
        lineItems: [
          {
            itemName: 'Cloud Compute Instance - t3.large',
            quantity: 1,
            unitPrice: 850,
            total: 850,
          },
          {
            itemName: 'Storage Block (EBS) - 2TB',
            quantity: 1,
            unitPrice: 300,
            total: 300,
          },
        ],
      }),
    );

    fixture.detectChanges();

    const fileInput = fixture.nativeElement.querySelector(
      '[data-testid="documents-file-input"]',
    ) as HTMLInputElement;
    const file = new File(['fake-pdf'], 'invoice-9941.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    fileInput.dispatchEvent(new Event('change'));
    await Promise.resolve();
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector(
      '[data-testid="documents-submit-review"]',
    ) as HTMLButtonElement;
    submitButton.click();
    fixture.detectChanges();

    expect(documentsApi.submitReviewedDocument).not.toHaveBeenCalled();
    expect(queryText(fixture, '[data-testid="documents-review-error"]')).toBe(
      'Line item totals must match Total amount (USD) before submitting.',
    );
  });

  it('keeps drafts usable when submitted history fails to load', () => {
    documentsApi.getMyDocumentDrafts.mockReturnValue(
      of([
        {
          documentId: 'draft-1',
          originalFileName: 'invoice.pdf',
          vendorName: 'Amazon Web Services, Inc.',
          reference: 'INV-2026-0101',
          totalAmount: 1450,
          confidenceLabel: 'High precision',
          ownerEmail: 'staff.one@finflow.test',
          uploadedAt: '2026-04-19T08:30:00Z',
        },
      ]),
    );
    documentsApi.getMySubmittedDocuments.mockReturnValue(
      throwError(() => new Error('Submitted history failed.')),
    );

    const fixture = TestBed.createComponent(DocumentsPageComponent);
    fixture.detectChanges();

    expect(queryText(fixture, '[data-testid="documents-error-banner"]')).toContain(
      'Submitted history failed.',
    );
    expect(fixture.nativeElement.textContent).toContain('Amazon Web Services, Inc.');
    expect(queryText(fixture, '[data-testid="documents-continue-draft"]')).toBe('Continue editing');
    expect(queryText(fixture, '[data-testid="documents-submitted-error"]')).toContain(
      'Submitted history failed.',
    );
  });

  it('shows an error banner when OCR upload fails', async () => {
    const fixture = TestBed.createComponent(DocumentsPageComponent);
    const component = fixture.componentInstance as any;
    component.readFileAsBase64 = vi.fn().mockResolvedValue('cGRmLWNvbnRlbnQ=');
    documentsApi.uploadDocumentForReview.mockReturnValue(
      throwError(() => new Error('OCR upload failed.')),
    );

    fixture.detectChanges();

    const fileInput = fixture.nativeElement.querySelector(
      '[data-testid="documents-file-input"]',
    ) as HTMLInputElement;
    const file = new File(['fake-pdf'], 'invoice-9941.pdf', { type: 'application/pdf' });
    Object.defineProperty(fileInput, 'files', {
      configurable: true,
      value: [file],
    });

    fileInput.dispatchEvent(new Event('change'));
    await Promise.resolve();
    fixture.detectChanges();

    expect(queryText(fixture, '[data-testid="documents-error-banner"]')).toBe('OCR upload failed.');
  });
});
