import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  DocumentsApiService,
  SaveReviewedOcrDraftInput,
  SubmitReviewedDocumentInput,
} from './documents-api.service';

describe('DocumentsApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('uploads a document for review and returns OCR draft data', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service
      .uploadDocumentForReview('invoice.pdf', 'application/pdf', 'cGRmLWNvbnRlbnQ=')
      .subscribe((value) => {
        result = value;
      });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('uploadDocumentForReview');
    expect(request.request.body.query).toContain('taxLines');
    expect(request.request.body.variables).toEqual({
      input: {
        fileName: 'invoice.pdf',
        contentType: 'application/pdf',
        base64Content: 'cGRmLWNvbnRlbnQ=',
      },
    });

    request.flush({
      data: {
        uploadDocumentForReview: {
          documentId: 'doc-123',
          originalFileName: 'invoice.pdf',
          contentType: 'application/pdf',
          vendorName: 'Amazon Web Services, Inc.',
          reference: 'INV-123',
          documentDate: '2024-10-12',
          category: 'Software & SaaS',
          vendorTaxId: 'TX-990-2134',
          subtotal: 1200,
          vat: 250,
          totalAmount: 1450,
          source: 'finance-inbox@finflow',
          reviewedByStaff: 'staff.one@finflow.test',
          confidenceLabel: 'High precision',
          processedPageCount: 3,
          lineItems: [
            {
              itemName: 'Cloud Compute Instance',
              quantity: 1,
              unitPrice: 850,
              total: 850,
            },
          ],
          taxLines: [
            {
              taxType: 'VAT',
              rate: 20.83,
              taxableAmount: 1200,
              taxAmount: 250,
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      documentId: 'doc-123',
      originalFileName: 'invoice.pdf',
      contentType: 'application/pdf',
      vendorName: 'Amazon Web Services, Inc.',
      reference: 'INV-123',
      documentDate: '2024-10-12',
      category: 'Software & SaaS',
      vendorTaxId: 'TX-990-2134',
      subtotal: 1200,
      vat: 250,
      totalAmount: 1450,
      source: 'finance-inbox@finflow',
      reviewedByStaff: 'staff.one@finflow.test',
      confidenceLabel: 'High precision',
      processedPageCount: 3,
      lineItems: [
        {
          itemName: 'Cloud Compute Instance',
          quantity: 1,
          unitPrice: 850,
          total: 850,
        },
      ],
      taxLines: [
        {
          taxType: 'VAT',
          rate: 20.83,
          taxableAmount: 1200,
          taxAmount: 250,
        },
      ],
    });
    httpTesting.verify();
  });

  it('queries my personal document drafts', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getMyDocumentDrafts().subscribe((drafts) => {
      result = drafts;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('myDocumentDrafts');
    request.flush({
      data: {
        myDocumentDrafts: [
          {
            documentId: 'draft-1',
            originalFileName: 'invoice.pdf',
            vendorName: 'Amazon Web Services, Inc.',
            reference: 'INV-2026-0101',
            totalAmount: 1450,
            category: 'Software & SaaS',
            source: 'OCR',
            confidenceLabel: 'High precision',
            ownerEmail: 'staff.one@finflow.test',
            uploadedAt: '2026-04-19T08:30:00Z',
          },
        ],
      },
    });

    expect(result).toEqual([
      {
        documentId: 'draft-1',
        originalFileName: 'invoice.pdf',
        vendorName: 'Amazon Web Services, Inc.',
        reference: 'INV-2026-0101',
        totalAmount: 1450,
        category: 'Software & SaaS',
        source: 'OCR',
        confidenceLabel: 'High precision',
        ownerEmail: 'staff.one@finflow.test',
        uploadedAt: '2026-04-19T08:30:00Z',
      },
    ]);
    httpTesting.verify();
  });

  it('queries a personal document draft detail by id', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getMyDocumentDraft('draft-1').subscribe((draft) => {
      result = draft;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('myDocumentDraft');
    expect(request.request.body.query).toContain('taxLines');
    expect(request.request.body.variables).toEqual({ documentId: 'draft-1' });
    request.flush({
      data: {
        myDocumentDraft: {
          documentId: 'draft-1',
          originalFileName: 'invoice.pdf',
          contentType: 'application/pdf',
          vendorName: 'Amazon Web Services, Inc.',
          reference: 'INV-2026-0101',
          documentDate: '2026-04-19',
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
              itemName: 'Cloud Compute Instance',
              quantity: 1,
              unitPrice: 850,
              total: 850,
            },
          ],
          taxLines: [
            {
              taxType: 'VAT',
              rate: 20.83,
              taxableAmount: 1200,
              taxAmount: 250,
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      documentId: 'draft-1',
      originalFileName: 'invoice.pdf',
      contentType: 'application/pdf',
      vendorName: 'Amazon Web Services, Inc.',
      reference: 'INV-2026-0101',
      documentDate: '2026-04-19',
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
          itemName: 'Cloud Compute Instance',
          quantity: 1,
          unitPrice: 850,
          total: 850,
        },
      ],
      taxLines: [
        {
          taxType: 'VAT',
          rate: 20.83,
          taxableAmount: 1200,
          taxAmount: 250,
        },
      ],
    });
    httpTesting.verify();
  });

  it('queries my submitted document history', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getMySubmittedDocuments().subscribe((items) => {
      result = items;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('mySubmittedDocuments');
    request.flush({
      data: {
        mySubmittedDocuments: [
          {
            documentId: 'submitted-1',
            originalFileName: 'invoice.pdf',
            vendorName: 'Amazon Web Services, Inc.',
            reference: 'INV-2026-0101',
            totalAmount: 1450,
            category: 'Software & SaaS',
            source: 'OCR',
            status: 'Submitted',
            submittedByEmail: 'staff.one@finflow.test',
            submittedAt: '2026-04-19T09:00:00Z',
            lastUpdatedAt: '2026-04-19T09:00:00Z',
            rejectionReason: null,
          },
        ],
      },
    });

    expect(result).toEqual([
      {
        documentId: 'submitted-1',
        originalFileName: 'invoice.pdf',
        vendorName: 'Amazon Web Services, Inc.',
        reference: 'INV-2026-0101',
        totalAmount: 1450,
        category: 'Software & SaaS',
        source: 'OCR',
        status: 'Submitted',
        submittedByEmail: 'staff.one@finflow.test',
        submittedAt: '2026-04-19T09:00:00Z',
        lastUpdatedAt: '2026-04-19T09:00:00Z',
        rejectionReason: null,
      },
    ]);
    httpTesting.verify();
  });

  it('uploads a manual attachment draft without invoking OCR review mutation', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service
      .uploadManualAttachmentDraft('manual-receipt.jpg', 'image/jpeg', 'ZmFrZS1pbWFnZQ==')
      .subscribe((value) => {
        result = value;
      });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('uploadManualAttachmentDraft');
    expect(request.request.body.query).not.toContain('uploadDocumentForReview');
    expect(request.request.body.variables).toEqual({
      input: {
        fileName: 'manual-receipt.jpg',
        contentType: 'image/jpeg',
        base64Content: 'ZmFrZS1pbWFnZQ==',
      },
    });

    request.flush({
      data: {
        uploadManualAttachmentDraft: {
          documentId: 'manual-draft-1',
          originalFileName: 'manual-receipt.jpg',
          contentType: 'image/jpeg',
          hasPreviewImage: true,
          previewImageDataUrl: 'data:image/jpeg;base64,ZmFrZS1pbWFnZQ==',
          vendorName: '',
          reference: '',
          documentDate: '2026-05-01',
          category: '',
          vendorTaxId: '',
          subtotal: 0,
          vat: 0,
          totalAmount: 0,
          source: 'manual-attachment',
          reviewedByStaff: 'staff.one@finflow.test',
          confidenceLabel: 'Manual attachment',
          processedPageCount: null,
          lineItems: [],
          taxLines: [],
        },
      },
    });

    expect(result).toEqual({
      documentId: 'manual-draft-1',
      originalFileName: 'manual-receipt.jpg',
      contentType: 'image/jpeg',
      hasPreviewImage: true,
      previewImageDataUrl: 'data:image/jpeg;base64,ZmFrZS1pbWFnZQ==',
      vendorName: '',
      reference: '',
      documentDate: '2026-05-01',
      category: '',
      vendorTaxId: '',
      subtotal: 0,
      vat: 0,
      totalAmount: 0,
      source: 'manual-attachment',
      reviewedByStaff: 'staff.one@finflow.test',
      confidenceLabel: 'Manual attachment',
      processedPageCount: null,
      lineItems: [],
      taxLines: [],
    });
    httpTesting.verify();
  });

  it('queries workspace expense categories for document selection controls', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getMyCategories().subscribe((categories) => {
      result = categories;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('myCategories');
    expect(request.request.body.variables).toEqual({ includeInactive: false });
    request.flush({
      data: {
        myCategories: [
          {
            id: 'cat-1',
            name: 'Office Supplies',
            categoryType: 'OfficeSupplies',
            isActive: true,
            displayOrder: 1,
          },
        ],
      },
    });

    expect(result).toEqual([
      {
        id: 'cat-1',
        name: 'Office Supplies',
        categoryType: 'OfficeSupplies',
        isActive: true,
        displayOrder: 1,
      },
    ]);
    httpTesting.verify();
  });

  it('queries a submitted document detail by id', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getMySubmittedDocument('submitted-1').subscribe((item) => {
      result = item;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('mySubmittedDocument');
    expect(request.request.body.query).toContain('taxLines');
    expect(request.request.body.variables).toEqual({ documentId: 'submitted-1' });
    request.flush({
      data: {
        mySubmittedDocument: {
          documentId: 'submitted-1',
          originalFileName: 'invoice.pdf',
          contentType: 'application/pdf',
          vendorName: 'Precision Tools Corp',
          reference: 'INV-2024-0037',
          documentDate: '2024-11-15',
          category: 'Equipment',
          vendorTaxId: 'TX-123',
          subtotal: 2850,
          vat: 350,
          totalAmount: 3200,
          source: 'Manual',
          status: 'Approved',
          submittedByEmail: 'staff@finflow.test',
          submittedAt: '2024-11-15T01:00:00Z',
          lastUpdatedAt: '2024-11-15T03:00:00Z',
          rejectionReason: null,
          lineItems: [
            {
              itemName: 'Office Chair Pro',
              quantity: 5,
              unitPrice: 600,
              total: 3000,
            },
          ],
          taxLines: [
            {
              taxType: 'VAT',
              rate: 12.28,
              taxableAmount: 2850,
              taxAmount: 350,
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      documentId: 'submitted-1',
      originalFileName: 'invoice.pdf',
      contentType: 'application/pdf',
      vendorName: 'Precision Tools Corp',
      reference: 'INV-2024-0037',
      documentDate: '2024-11-15',
      category: 'Equipment',
      vendorTaxId: 'TX-123',
      subtotal: 2850,
      vat: 350,
      totalAmount: 3200,
      source: 'Manual',
      status: 'Approved',
      submittedByEmail: 'staff@finflow.test',
      submittedAt: '2024-11-15T01:00:00Z',
      lastUpdatedAt: '2024-11-15T03:00:00Z',
      rejectionReason: null,
      lineItems: [
        {
          itemName: 'Office Chair Pro',
          quantity: 5,
          unitPrice: 600,
          total: 3000,
        },
      ],
      taxLines: [
        {
          taxType: 'VAT',
          rate: 12.28,
          taxableAmount: 2850,
          taxAmount: 350,
        },
      ],
    });
    httpTesting.verify();
  });

  it('repairs mojibake document strings from OCR and submitted document responses', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    const results: unknown[] = [];

    service
      .uploadDocumentForReview('hoadon.jpg', 'image/jpeg', 'ZmFrZS1pbWFnZQ==')
      .subscribe((draft) => {
        results.push(draft);
      });

    let request = httpTesting.expectOne('/graphql');
    request.flush({
      data: {
        uploadDocumentForReview: {
          documentId: 'doc-vn-1',
          originalFileName: 'hoadon.jpg',
          contentType: 'image/jpeg',
          vendorName: 'BÃ\u0081CH HÃ\u0093A XANH',
          reference: '21070052990051966',
          documentDate: '2021-07-16',
          category: 'Táº¡p hÃ³a',
          vendorTaxId: null,
          subtotal: 187954,
          vat: 0,
          totalAmount: 187954,
          source: 'openrouter',
          reviewedByStaff: 'staff.one@finflow.test',
          confidenceLabel: 'AI extracted',
          lineItems: [
            {
              itemName: 'KhÄ\u0083n giáº¥y',
              quantity: 1,
              unitPrice: 25000,
              total: 25000,
            },
          ],
        },
      },
    });

    service.getMySubmittedDocuments().subscribe((items) => {
      results.push(items);
    });

    request = httpTesting.expectOne('/graphql');
    request.flush({
      data: {
        mySubmittedDocuments: [
          {
            documentId: 'submitted-vn-1',
            originalFileName: 'hoadon.jpg',
            vendorName: 'BÃ\u0081CH HÃ\u0093A XANH',
            reference: '21070052990051966',
            totalAmount: 187954,
            category: 'Táº¡p hÃ³a',
            source: 'OCR',
            status: 'Submitted',
            submittedByEmail: 'staff.one@finflow.test',
            submittedAt: '2026-04-24T09:46:04.512Z',
            lastUpdatedAt: '2026-04-24T09:46:04.512Z',
            rejectionReason: null,
          },
        ],
      },
    });

    expect(results).toEqual([
      {
        documentId: 'doc-vn-1',
        originalFileName: 'hoadon.jpg',
        contentType: 'image/jpeg',
        vendorName: 'BÁCH HÓA XANH',
        reference: '21070052990051966',
        documentDate: '2021-07-16',
        category: 'Tạp hóa',
        vendorTaxId: null,
        subtotal: 187954,
        vat: 0,
        totalAmount: 187954,
        source: 'openrouter',
        reviewedByStaff: 'staff.one@finflow.test',
        confidenceLabel: 'AI extracted',
        lineItems: [
          {
            itemName: 'Khăn giấy',
            quantity: 1,
            unitPrice: 25000,
            total: 25000,
          },
        ],
      },
      [
        {
          documentId: 'submitted-vn-1',
          originalFileName: 'hoadon.jpg',
          vendorName: 'BÁCH HÓA XANH',
          reference: '21070052990051966',
          totalAmount: 187954,
          category: 'Tạp hóa',
          source: 'OCR',
          status: 'Submitted',
          submittedByEmail: 'staff.one@finflow.test',
          submittedAt: '2026-04-24T09:46:04.512Z',
          lastUpdatedAt: '2026-04-24T09:46:04.512Z',
          rejectionReason: null,
        },
      ],
    ]);
    httpTesting.verify();
  });

  it('saves a manual draft and returns the new draft id', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service
      .saveManualDraft({
        originalFileName: 'invoice.pdf',
        vendorName: 'Vendor Co',
        reference: 'INV-001',
        documentDate: '2026-04-01',
        category: 'Office Supplies',
        vendorTaxId: 'TX-123',
        subtotal: 100,
        vat: 10,
        totalAmount: 110,
        lineItems: [
          {
            itemName: 'Item 1',
            quantity: 1,
            unitPrice: 100,
            total: 100,
          },
        ],
      })
      .subscribe((draftId: string) => {
        result = draftId;
      });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('saveManualDraft');
    expect(request.request.body.variables).toEqual({
      input: {
        originalFileName: 'invoice.pdf',
        vendorName: 'Vendor Co',
        reference: 'INV-001',
        documentDate: '2026-04-01',
        category: 'Office Supplies',
        vendorTaxId: 'TX-123',
        subtotal: 100,
        vat: 10,
        totalAmount: 110,
        lineItems: [
          {
            itemName: 'Item 1',
            quantity: 1,
            unitPrice: 100,
            total: 100,
          },
        ],
      },
    });

    request.flush({
      data: {
        saveManualDraft: {
          draftId: 'draft-555',
        },
      },
    });

    expect(result).toBe('draft-555');
    httpTesting.verify();
  });

  it('saves a reviewed OCR draft and returns the persisted draft id', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    const input: SaveReviewedOcrDraftInput = {
      draftId: 'draft-ocr-1',
      vendorName: 'Vendor Co',
      reference: 'INV-001',
      documentDate: '2026-04-01',
      category: 'Office Supplies',
      vendorTaxId: 'TX-123',
      subtotal: 100,
      vat: 10,
      totalAmount: 110,
      confidenceLabel: 'Staff corrected',
      lineItems: [
        {
          itemName: 'Item 1',
          quantity: 1,
          unitPrice: 100,
          total: 100,
        },
      ],
    };

    service.saveReviewedOcrDraft(input).subscribe((draftId) => {
      result = draftId;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('saveReviewedOcrDraft');
    expect(request.request.body.variables).toEqual({ input });

    request.flush({
      data: {
        saveReviewedOcrDraft: {
          draftId: 'draft-ocr-1',
        },
      },
    });

    expect(result).toBe('draft-ocr-1');
    httpTesting.verify();
  });

  it('submits a reviewed document draft with nullable draft id support', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    const draft: SubmitReviewedDocumentInput = {
      draftId: 'doc-123',
      originalFileName: 'invoice.pdf',
      vendorName: 'Amazon Web Services, Inc.',
      reference: 'INV-123',
      documentDate: '2024-10-12',
      category: 'Software & SaaS',
      vendorTaxId: 'TX-990-2134',
      subtotal: 1200,
      vat: 250,
      totalAmount: 1450,
      source: 'finance-inbox@finflow',
      confidenceLabel: 'High precision',
      lineItems: [
        {
          itemName: 'Cloud Compute Instance',
          quantity: 1,
          unitPrice: 850,
          total: 850,
        },
      ],
    };

    service.submitReviewedDocument(draft).subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('submitReviewedDocument');
    expect(request.request.body.variables).toEqual({ input: draft });

    request.flush({
      data: {
        submitReviewedDocument: {
          documentId: 'doc-123',
          status: 'ReadyForApproval',
          submittedAt: '2026-04-18T09:30:00Z',
          vendorName: 'Amazon Web Services, Inc.',
          reference: 'INV-123',
          totalAmount: 1450,
          reviewedByStaff: 'staff.one@finflow.test',
        },
      },
    });

    expect(result).toEqual({
      documentId: 'doc-123',
      status: 'ReadyForApproval',
      submittedAt: '2026-04-18T09:30:00Z',
      vendorName: 'Amazon Web Services, Inc.',
      reference: 'INV-123',
      totalAmount: 1450,
      reviewedByStaff: 'staff.one@finflow.test',
    });
    httpTesting.verify();
  });

  it('surfaces graphql errors from drafts, upload, submit, and submitted history responses', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    const messages: string[] = [];

    service.getMyDocumentDrafts().subscribe({
      error: (error: Error) => {
        messages.push(error.message);
      },
    });

    let request = httpTesting.expectOne('/graphql');
    request.flush({ errors: [{ message: 'Drafts failed.' }] });

    service.uploadDocumentForReview('invoice.pdf', 'application/pdf', 'ZmFrZQ==').subscribe({
      error: (error: Error) => {
        messages.push(error.message);
      },
    });

    request = httpTesting.expectOne('/graphql');
    request.flush({ errors: [{ message: 'Upload failed.' }] });

    service.getMyDocumentDraft('draft-1').subscribe({
      error: (error: Error) => {
        messages.push(error.message);
      },
    });

    request = httpTesting.expectOne('/graphql');
    request.flush({ errors: [{ message: 'Draft detail failed.' }] });

    service
      .submitReviewedDocument({
        draftId: null,
        originalFileName: 'invoice.pdf',
        vendorName: 'Amazon Web Services, Inc.',
        reference: 'INV-123',
        documentDate: '2024-10-12',
        category: 'Software & SaaS',
        vendorTaxId: 'TX-990-2134',
        subtotal: 1200,
        vat: 250,
        totalAmount: 1450,
        source: 'finance-inbox@finflow',
        confidenceLabel: 'High precision',
        lineItems: [],
      })
      .subscribe({
        error: (error: Error) => {
          messages.push(error.message);
        },
      });

    request = httpTesting.expectOne('/graphql');
    request.flush({ errors: [{ message: 'Submit failed.' }] });

    service.getMySubmittedDocuments().subscribe({
      error: (error: Error) => {
        messages.push(error.message);
      },
    });

    request = httpTesting.expectOne('/graphql');
    request.flush({ errors: [{ message: 'Submitted history failed.' }] });

    service.getMySubmittedDocument('submitted-1').subscribe({
      error: (error: Error) => {
        messages.push(error.message);
      },
    });

    request = httpTesting.expectOne('/graphql');
    request.flush({ errors: [{ message: 'Submitted detail failed.' }] });

    expect(messages).toEqual([
      'Drafts failed.',
      'Upload failed.',
      'Draft detail failed.',
      'Submit failed.',
      'Submitted history failed.',
      'Submitted detail failed.',
    ]);
    httpTesting.verify();
  });
});
