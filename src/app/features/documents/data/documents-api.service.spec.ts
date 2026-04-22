import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { DocumentsApiService, SubmitReviewedDocumentDraft } from './documents-api.service';

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
          dueDate: '2024-11-12',
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
      dueDate: '2024-11-12',
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
              itemName: 'Cloud Compute Instance',
              quantity: 1,
              unitPrice: 850,
              total: 850,
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
          itemName: 'Cloud Compute Instance',
          quantity: 1,
          unitPrice: 850,
          total: 850,
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
        status: 'Submitted',
        submittedByEmail: 'staff.one@finflow.test',
        submittedAt: '2026-04-19T09:00:00Z',
        lastUpdatedAt: '2026-04-19T09:00:00Z',
        rejectionReason: null,
      },
    ]);
    httpTesting.verify();
  });

  it('submits a reviewed document draft', () => {
    const service = TestBed.inject(DocumentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    const draft: SubmitReviewedDocumentDraft = {
      documentId: 'doc-123',
      originalFileName: 'invoice.pdf',
      contentType: 'application/pdf',
      vendorName: 'Amazon Web Services, Inc.',
      reference: 'INV-123',
      documentDate: '2024-10-12',
      dueDate: '2024-11-12',
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
          dueDate: '2024-11-12',
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
      dueDate: '2024-11-12',
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
        documentId: 'doc-123',
        originalFileName: 'invoice.pdf',
        contentType: 'application/pdf',
        vendorName: 'Amazon Web Services, Inc.',
        reference: 'INV-123',
        documentDate: '2024-10-12',
        dueDate: '2024-11-12',
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

    expect(messages).toEqual([
      'Drafts failed.',
      'Upload failed.',
      'Draft detail failed.',
      'Submit failed.',
      'Submitted history failed.',
    ]);
    httpTesting.verify();
  });
});
