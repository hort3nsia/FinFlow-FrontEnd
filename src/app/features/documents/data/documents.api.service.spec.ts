import 'zone.js';

import { TestBed } from '@angular/core/testing';
import { ApolloTestingController, ApolloTestingModule } from 'apollo-angular/testing';
import { firstValueFrom } from 'rxjs';
import { DocumentsApiService } from './documents.api.service';
import {
  CREATE_MANUAL_DOCUMENT_DRAFT_MUTATION,
  DELETE_DOCUMENT_DRAFT_MUTATION,
  MY_DOCUMENT_DRAFTS_QUERY,
  MY_DOCUMENT_DRAFT_QUERY,
  MY_SUBMITTED_DOCUMENTS_QUERY,
  SUBMIT_REVIEWED_DOCUMENT_MUTATION,
  UPLOAD_DOCUMENT_FOR_REVIEW_MUTATION,
} from './documents.graphql';

describe('DocumentsApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ApolloTestingModule],
    });
  });

  afterEach(() => {
    TestBed.inject(ApolloTestingController).verify();
  });

  it('queries my document drafts and maps the paginated response', async () => {
    const service = TestBed.inject(DocumentsApiService);
    const apolloTesting = TestBed.inject(ApolloTestingController);
    const resultPromise = firstValueFrom(service.getDrafts(0, 10));

    const operation = apolloTesting.expectOne(MY_DOCUMENT_DRAFTS_QUERY);
    expect(operation.operation.variables).toEqual({
      skip: 0,
      take: 10,
    });
    expect(operation.operation.query.loc?.source.body).not.toContain('hasImage');

    operation.flush({
      data: {
        myDocumentDrafts: {
          items: [
            {
              documentId: 'draft-001',
              originalFileName: 'invoice-001.pdf',
              vendorName: 'Acme Supplies',
              reference: 'INV-001',
              totalAmount: 1250.5,
              confidenceLabel: 'High',
              ownerEmail: 'owner@finflow.local',
              uploadedAt: '2026-04-21T08:00:00Z',
            },
          ],
          totalCount: 1,
          skip: 0,
          take: 10,
        },
      },
    });

    await expect(resultPromise).resolves.toEqual({
      items: [
        {
          documentId: 'draft-001',
          originalFileName: 'invoice-001.pdf',
          vendorName: 'Acme Supplies',
          reference: 'INV-001',
          totalAmount: 1250.5,
          confidenceLabel: 'High',
          ownerEmail: 'owner@finflow.local',
          uploadedAt: '2026-04-21T08:00:00Z',
        },
      ],
      totalCount: 1,
      skip: 0,
      take: 10,
    });
  });

  it('queries a document draft detail using the backend draft payload shape', async () => {
    const service = TestBed.inject(DocumentsApiService);
    const apolloTesting = TestBed.inject(ApolloTestingController);
    const resultPromise = firstValueFrom(service.getDraft('draft-001'));

    const operation = apolloTesting.expectOne(MY_DOCUMENT_DRAFT_QUERY);
    expect(operation.operation.variables).toEqual({
      documentId: 'draft-001',
    });
    expect(operation.operation.query.loc?.source.body).toContain('contentType');
    expect(operation.operation.query.loc?.source.body).toContain('vendorTaxId');
    expect(operation.operation.query.loc?.source.body).toContain('reviewedByStaff');
    expect(operation.operation.query.loc?.source.body).toContain('itemName');

    operation.flush({
      data: {
        myDocumentDraft: {
          documentId: 'draft-001',
          originalFileName: 'invoice-001.pdf',
          contentType: 'application/pdf',
          vendorName: 'Acme Supplies',
          reference: 'INV-001',
          documentDate: '2026-04-20',
          dueDate: '2026-05-20',
          category: 'Software & SaaS',
          vendorTaxId: 'TX-123',
          subtotal: 1000,
          vat: 250.5,
          totalAmount: 1250.5,
          source: 'staff-upload',
          reviewedByStaff: 'owner@finflow.local',
          confidenceLabel: 'High precision',
          hasImage: true,
          lineItems: [
            {
              itemName: 'Cloud Compute',
              quantity: 1,
              unitPrice: 1000,
              total: 1000,
            },
          ],
        },
      },
    });

    await expect(resultPromise).resolves.toEqual({
      documentId: 'draft-001',
      originalFileName: 'invoice-001.pdf',
      contentType: 'application/pdf',
      vendorName: 'Acme Supplies',
      reference: 'INV-001',
      documentDate: '2026-04-20',
      dueDate: '2026-05-20',
      category: 'Software & SaaS',
      vendorTaxId: 'TX-123',
      subtotal: 1000,
      vat: 250.5,
      totalAmount: 1250.5,
      source: 'staff-upload',
      reviewedByStaff: 'owner@finflow.local',
      confidenceLabel: 'High precision',
      hasImage: true,
      lineItems: [
        {
          itemName: 'Cloud Compute',
          quantity: 1,
          unitPrice: 1000,
          total: 1000,
        },
      ],
    });
  });

  it('uploads a document for review using backend input field names and maps the response', async () => {
    const service = TestBed.inject(DocumentsApiService);
    const apolloTesting = TestBed.inject(ApolloTestingController);
    const input = {
      fileName: 'invoice-001.pdf',
      contentType: 'application/pdf',
      base64Content: 'RmluRmxvdw==',
    };

    const resultPromise = firstValueFrom(service.uploadForReview(input));

    const operation = apolloTesting.expectOne(UPLOAD_DOCUMENT_FOR_REVIEW_MUTATION);
    expect(operation.operation.variables).toEqual({
      input,
    });
    expect(operation.operation.query.loc?.source.body).toContain('reviewedByStaff');

    operation.flush({
      data: {
        uploadDocumentForReview: {
          documentId: 'draft-ocr-001',
          originalFileName: 'invoice-001.pdf',
          contentType: 'application/pdf',
          vendorName: 'Amazon Web Services, Inc.',
          reference: 'INV-2026-0101',
          documentDate: '2026-04-18',
          dueDate: '2026-05-02',
          category: 'Software & SaaS',
          vendorTaxId: 'TX-990-2134',
          subtotal: 1200,
          vat: 250,
          totalAmount: 1450,
          source: 'staff-upload',
          reviewedByStaff: 'staff.documents@finflow.test',
          confidenceLabel: 'High precision',
          hasImage: true,
          lineItems: [
            {
              itemName: 'Cloud Compute Instance - t3.large',
              quantity: 1,
              unitPrice: 850,
              total: 850,
            },
          ],
        },
      },
    });

    await expect(resultPromise).resolves.toEqual({
      documentId: 'draft-ocr-001',
      originalFileName: 'invoice-001.pdf',
      contentType: 'application/pdf',
      vendorName: 'Amazon Web Services, Inc.',
      reference: 'INV-2026-0101',
      documentDate: '2026-04-18',
      dueDate: '2026-05-02',
      category: 'Software & SaaS',
      vendorTaxId: 'TX-990-2134',
      subtotal: 1200,
      vat: 250,
      totalAmount: 1450,
      source: 'staff-upload',
      reviewedByStaff: 'staff.documents@finflow.test',
      confidenceLabel: 'High precision',
      hasImage: true,
      lineItems: [
        {
          itemName: 'Cloud Compute Instance - t3.large',
          quantity: 1,
          unitPrice: 850,
          total: 850,
        },
      ],
    });
  });

  it('queries submitted documents and maps the paginated response', async () => {
    const service = TestBed.inject(DocumentsApiService);
    const apolloTesting = TestBed.inject(ApolloTestingController);
    const resultPromise = firstValueFrom(service.getSubmitted(10, 5));

    const operation = apolloTesting.expectOne(MY_SUBMITTED_DOCUMENTS_QUERY);
    expect(operation.operation.variables).toEqual({
      skip: 10,
      take: 5,
    });

    operation.flush({
      data: {
        mySubmittedDocuments: {
          items: [
            {
              documentId: 'submitted-001',
              originalFileName: 'invoice-001.pdf',
              vendorName: 'Acme Supplies',
              reference: 'INV-001',
              totalAmount: 1250.5,
              status: 'Submitted',
              submittedByEmail: 'submitter@finflow.local',
              submittedAt: '2026-04-21T08:00:00Z',
              lastUpdatedAt: '2026-04-21T09:00:00Z',
              rejectionReason: null,
            },
          ],
          totalCount: 12,
          skip: 10,
          take: 5,
        },
      },
    });

    await expect(resultPromise).resolves.toEqual({
      items: [
        {
          documentId: 'submitted-001',
          originalFileName: 'invoice-001.pdf',
          vendorName: 'Acme Supplies',
          reference: 'INV-001',
          totalAmount: 1250.5,
          status: 'Submitted',
          submittedByEmail: 'submitter@finflow.local',
          submittedAt: '2026-04-21T08:00:00Z',
          lastUpdatedAt: '2026-04-21T09:00:00Z',
          rejectionReason: null,
        },
      ],
      totalCount: 12,
      skip: 10,
      take: 5,
    });
  });

  it('creates a manual draft using backend input field names and maps the response', async () => {
    const service = TestBed.inject(DocumentsApiService);
    const apolloTesting = TestBed.inject(ApolloTestingController);
    const input = {
      vendorName: 'Manual Vendor',
      reference: 'MAN-001',
      documentDate: '2026-04-18',
      dueDate: '2026-05-02',
      category: 'Office Supplies',
      vendorTaxId: 'TX-123',
      subtotal: 100,
      vat: 10,
      totalAmount: 110,
      lineItems: [
        {
          itemName: 'Printer Paper',
          quantity: 10,
          unitPrice: 10,
          total: 100,
        },
      ],
      imageFileName: 'receipt.jpg',
      imageContentType: 'image/jpeg',
      base64ImageContent: 'RmluRmxvdw==',
    };

    const resultPromise = firstValueFrom(service.createManualDraft(input));

    const operation = apolloTesting.expectOne(CREATE_MANUAL_DOCUMENT_DRAFT_MUTATION);
    expect(operation.operation.variables).toEqual({
      input,
    });

    operation.flush({
      data: {
        createManualDocumentDraft: {
          documentId: 'manual-001',
          originalFileName: 'receipt.jpg',
          contentType: 'image/jpeg',
          vendorName: 'Manual Vendor',
          reference: 'MAN-001',
          documentDate: '2026-04-18',
          dueDate: '2026-05-02',
          category: 'Office Supplies',
          vendorTaxId: 'TX-123',
          subtotal: 100,
          vat: 10,
          totalAmount: 110,
          source: 'manual-entry',
          reviewedByStaff: 'staff@finflow.local',
          confidenceLabel: 'Staff corrected',
          hasImage: true,
          lineItems: [
            {
              itemName: 'Printer Paper',
              quantity: 10,
              unitPrice: 10,
              total: 100,
            },
          ],
        },
      },
    });

    await expect(resultPromise).resolves.toEqual({
      documentId: 'manual-001',
      originalFileName: 'receipt.jpg',
      contentType: 'image/jpeg',
      vendorName: 'Manual Vendor',
      reference: 'MAN-001',
      documentDate: '2026-04-18',
      dueDate: '2026-05-02',
      category: 'Office Supplies',
      vendorTaxId: 'TX-123',
      subtotal: 100,
      vat: 10,
      totalAmount: 110,
      source: 'manual-entry',
      reviewedByStaff: 'staff@finflow.local',
      confidenceLabel: 'Staff corrected',
      hasImage: true,
      lineItems: [
        {
          itemName: 'Printer Paper',
          quantity: 10,
          unitPrice: 10,
          total: 100,
        },
      ],
    });
  });

  it('submits a reviewed document and maps the reviewed payload', async () => {
    const service = TestBed.inject(DocumentsApiService);
    const apolloTesting = TestBed.inject(ApolloTestingController);
    const input = {
      documentId: 'draft-001',
      originalFileName: 'invoice-001.pdf',
      contentType: 'application/pdf',
      vendorName: 'Acme Supplies',
      reference: 'INV-001',
      documentDate: '2026-04-20',
      dueDate: '2026-05-20',
      category: 'Software & SaaS',
      vendorTaxId: 'TX-123',
      subtotal: 1000,
      vat: 250.5,
      totalAmount: 1250.5,
      source: 'staff-upload',
      confidenceLabel: 'Staff corrected',
      lineItems: [
        {
          itemName: 'Cloud Compute',
          quantity: 1,
          unitPrice: 1000,
          total: 1000,
        },
      ],
    };

    const resultPromise = firstValueFrom(service.submitReviewedDocument(input));

    const operation = apolloTesting.expectOne(SUBMIT_REVIEWED_DOCUMENT_MUTATION);
    expect(operation.operation.variables).toEqual({
      input,
    });

    operation.flush({
      data: {
        submitReviewedDocument: {
          documentId: 'draft-001',
          status: 'ReadyForApproval',
          submittedAt: '2026-04-21T10:00:00Z',
          vendorName: 'Acme Supplies',
          reference: 'INV-001',
          totalAmount: 1250.5,
          dueDate: '2026-05-20',
          reviewedByStaff: 'staff@finflow.local',
        },
      },
    });

    await expect(resultPromise).resolves.toEqual({
      documentId: 'draft-001',
      status: 'ReadyForApproval',
      submittedAt: '2026-04-21T10:00:00Z',
      vendorName: 'Acme Supplies',
      reference: 'INV-001',
      totalAmount: 1250.5,
      dueDate: '2026-05-20',
      reviewedByStaff: 'staff@finflow.local',
    });
  });

  it('deletes a draft when the backend returns a bare boolean', async () => {
    const service = TestBed.inject(DocumentsApiService);
    const apolloTesting = TestBed.inject(ApolloTestingController);
    const resultPromise = firstValueFrom(service.deleteDraft('draft-001'));

    const operation = apolloTesting.expectOne(DELETE_DOCUMENT_DRAFT_MUTATION);
    expect(operation.operation.variables).toEqual({
      input: {
        documentId: 'draft-001',
      },
    });

    operation.flush({
      data: {
        deleteDocumentDraft: true,
      },
    });

    await expect(resultPromise).resolves.toBe(true);
  });

  it('normalizes graphql errors to Error instances', async () => {
    const service = TestBed.inject(DocumentsApiService);
    const apolloTesting = TestBed.inject(ApolloTestingController);
    const resultPromise = firstValueFrom(service.getDrafts(0, 10));

    const operation = apolloTesting.expectOne(MY_DOCUMENT_DRAFTS_QUERY);
    operation.graphqlErrors([
      {
        message: 'Uploaded document draft not found.',
      },
    ]);

    await expect(resultPromise).rejects.toMatchObject({
      message: 'Uploaded document draft not found.',
    });
  });

  it('rejects malformed draft detail payloads with a clear error', async () => {
    const service = TestBed.inject(DocumentsApiService);
    const apolloTesting = TestBed.inject(ApolloTestingController);
    const resultPromise = firstValueFrom(service.getDraft('draft-001'));

    const operation = apolloTesting.expectOne(MY_DOCUMENT_DRAFT_QUERY);
    operation.flush({
      data: {
        myDocumentDraft: {
          documentId: 'draft-001',
          originalFileName: 'invoice-001.pdf',
          contentType: 'application/pdf',
          vendorName: 'Acme Supplies',
          reference: 'INV-001',
          documentDate: '2026-04-20',
          dueDate: '2026-05-20',
          category: 'Software & SaaS',
          vendorTaxId: 'TX-123',
          subtotal: 1000,
          vat: 250.5,
          totalAmount: 1250.5,
          source: 'staff-upload',
          reviewedByStaff: 'owner@finflow.local',
          confidenceLabel: 'High precision',
          hasImage: true,
          lineItems: [
            {
              quantity: 1,
              unitPrice: 1000,
              total: 1000,
            },
          ],
        },
      },
    });

    await expect(resultPromise).rejects.toMatchObject({
      message: 'MyDocumentDraft query returned an invalid draft payload.',
    });
  });
});
