import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ApprovalsApiService } from './approvals-api.service';

describe('ApprovalsApiService', () => {
  const authServiceMock = {
    refreshToken: vi.fn(),
  };

  beforeEach(() => {
    authServiceMock.refreshToken.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });
  });

  it('returns paginated approval queue items from the graphql endpoint', () => {
    const service = TestBed.inject(ApprovalsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getApprovalQueue('APPROVED', 'creative', 2, 50).subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('approvalQueue');
    expect(request.request.body.variables).toEqual({
      status: 'APPROVED',
      search: 'creative',
      page: 2,
      pageSize: 50,
    });

    request.flush({
      data: {
        approvalQueue: {
          items: [
            {
              documentId: 'doc-321',
              title: 'Creative Agency retainer',
              vendorName: 'Creative Agency XYZ',
              requester: 'James Osei',
              requesterEmail: 'james.osei@meridian.com',
              department: 'Marketing',
              amount: 7600,
              currency: 'VND',
              expenseDate: '2024-11-25',
              submittedAt: '2024-11-21T10:15:00Z',
              priority: 'Medium',
              status: 'Approved',
              policySummary: 'Requires manager approval',
            },
          ],
          page: 2,
          pageSize: 50,
          totalCount: 21,
          totalPages: 1,
        },
      },
    });

    expect(result).toEqual({
      items: [
        {
          documentId: 'doc-321',
          title: 'Creative Agency retainer',
          vendorName: 'Creative Agency XYZ',
          requester: 'James Osei',
          requesterEmail: 'james.osei@meridian.com',
          department: 'Marketing',
          amount: 7600,
          currency: 'VND',
          expenseDate: '2024-11-25',
          submittedAt: '2024-11-21T10:15:00Z',
          priority: 'Medium',
          status: 'Approved',
          policySummary: 'Requires manager approval',
        },
      ],
      page: 2,
      pageSize: 50,
      totalCount: 21,
      totalPages: 1,
    });
    httpTesting.verify();
  });

  it('returns export approval queue data from the graphql endpoint', () => {
    const service = TestBed.inject(ApprovalsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.exportApprovalQueue('PENDING', 'aws').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('exportApprovalQueue');
    expect(request.request.body.variables).toEqual({
      status: 'PENDING',
      search: 'aws',
    });

    request.flush({
      data: {
        exportApprovalQueue: {
          fileName: 'approvals-pending.csv',
          downloadUrl: 'data:text/csv;base64,Y29sMSxjb2wy',
        },
      },
    });

    expect(result).toEqual({
      fileName: 'approvals-pending.csv',
      downloadUrl: 'data:text/csv;base64,Y29sMSxjb2wy',
    });
    httpTesting.verify();
  });

  it('returns approval detail from the graphql endpoint', () => {
    const service = TestBed.inject(ApprovalsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getApprovalDetail('doc-123').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('approvalDetail');
    expect(request.request.body.variables).toEqual({
      documentId: 'doc-123',
    });

    request.flush({
      data: {
        approvalDetail: {
          documentId: 'doc-123',
          requestCode: 'DOC-2026-ABC12345',
          title: 'AWS October invoice',
          vendorName: 'Amazon Web Services',
          requesterName: 'Sarah Kimani',
          requesterEmail: 'sarah.kimani@meridian.com',
          department: 'Infrastructure',
          amount: 1450,
          currency: 'VND',
          expenseDate: '2024-11-12',
          submittedAt: '2024-11-09T09:00:00Z',
          priority: 'High',
          status: 'Pending',
          policySummary: 'Requires manager sign-off',
          lineItems: [
            {
              description: 'Cloud hosting',
              quantity: 1,
              unitPrice: 1450,
              total: 1450,
            },
          ],
        },
      },
    });

    expect(result).toEqual({
      documentId: 'doc-123',
      requestCode: 'DOC-2026-ABC12345',
      title: 'AWS October invoice',
      vendorName: 'Amazon Web Services',
      requesterName: 'Sarah Kimani',
      requesterEmail: 'sarah.kimani@meridian.com',
      department: 'Infrastructure',
      amount: 1450,
      currency: 'VND',
      expenseDate: '2024-11-12',
      submittedAt: '2024-11-09T09:00:00Z',
      priority: 'High',
      status: 'Pending',
      policySummary: 'Requires manager sign-off',
      lineItems: [
        {
          description: 'Cloud hosting',
          quantity: 1,
          unitPrice: 1450,
          total: 1450,
        },
      ],
    });
    httpTesting.verify();
  });

  it('submits approveReviewedDocument with an optional comment', () => {
    const service = TestBed.inject(ApprovalsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.approveReviewedDocument('doc-123', 'Looks good').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('approveReviewedDocument');
    expect(request.request.body.query).not.toContain('dueDate');
    expect(request.request.body.variables).toEqual({
      input: {
        documentId: 'doc-123',
        comment: 'Looks good',
      },
    });

    request.flush({
      data: {
        approveReviewedDocument: {
          documentId: 'doc-123',
          status: 'Approved',
          submittedAt: '2024-11-09T09:00:00Z',
          vendorName: 'Amazon Web Services',
          reference: 'INV-2024-10',
          totalAmount: 1450,
          expenseDate: '2024-11-12',
          reviewedByStaff: 'manager@meridian.com',
        },
      },
    });

    expect(result).toEqual({
      documentId: 'doc-123',
      status: 'Approved',
      submittedAt: '2024-11-09T09:00:00Z',
      vendorName: 'Amazon Web Services',
      reference: 'INV-2024-10',
      totalAmount: 1450,
      expenseDate: '2024-11-12',
      reviewedByStaff: 'manager@meridian.com',
    });
    httpTesting.verify();
  });

  it('submits rejectReviewedDocument with reason and optional comment', () => {
    const service = TestBed.inject(ApprovalsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service
      .rejectReviewedDocument('doc-123', 'Missing receipt', 'Need the original receipt file')
      .subscribe((value) => {
        result = value;
      });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('rejectReviewedDocument');
    expect(request.request.body.query).not.toContain('dueDate');
    expect(request.request.body.variables).toEqual({
      input: {
        documentId: 'doc-123',
        reason: 'Missing receipt',
        comment: 'Need the original receipt file',
      },
    });

    request.flush({
      data: {
        rejectReviewedDocument: {
          documentId: 'doc-123',
          status: 'Rejected',
          submittedAt: '2024-11-09T09:00:00Z',
          vendorName: 'Amazon Web Services',
          reference: 'INV-2024-10',
          totalAmount: 1450,
          expenseDate: '2024-11-12',
          reviewedByStaff: 'manager@meridian.com',
        },
      },
    });

    expect(result).toEqual({
      documentId: 'doc-123',
      status: 'Rejected',
      submittedAt: '2024-11-09T09:00:00Z',
      vendorName: 'Amazon Web Services',
      reference: 'INV-2024-10',
      totalAmount: 1450,
      expenseDate: '2024-11-12',
      reviewedByStaff: 'manager@meridian.com',
    });
    httpTesting.verify();
  });

  it('shows a Vietnamese business message when submitter approves their own document', () => {
    const service = TestBed.inject(ApprovalsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let thrownMessage: string | null = null;

    service.approveReviewedDocument('doc-owned').subscribe({
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush({
      errors: [
        {
          message: 'Submitter cannot approve their own reviewed document.',
          extensions: {
            code: 'ReviewedDocument.SelfApprovalNotAllowed',
          },
        },
      ],
    });

    expect(thrownMessage).toBe(
      'Bạn không thể tự phê duyệt hoặc từ chối chứng từ do chính mình gửi. Vui lòng chuyển cho người phê duyệt khác.',
    );
    httpTesting.verify();
  });

  it('shows a Vietnamese business message when submitter rejection is returned as an HTTP error', () => {
    const service = TestBed.inject(ApprovalsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let thrownMessage: string | null = null;

    service.rejectReviewedDocument('doc-owned', 'Duplicate').subscribe({
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush(
      {
        errors: [
          {
            message: 'Submitter cannot approve their own reviewed document.',
          },
        ],
      },
      {
        status: 400,
        statusText: 'Bad Request',
      },
    );

    expect(thrownMessage).toBe(
      'Bạn không thể tự phê duyệt hoặc từ chối chứng từ do chính mình gửi. Vui lòng chuyển cho người phê duyệt khác.',
    );
    httpTesting.verify();
  });

  it('surfaces graphql errors from approval queue queries', () => {
    const service = TestBed.inject(ApprovalsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let thrownMessage: string | null = null;

    service.getApprovalQueue().subscribe({
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush({ errors: [{ message: 'Approvals unavailable.' }] });

    expect(thrownMessage).toBe('Approvals unavailable.');
    httpTesting.verify();
  });

  it('refreshes the session and retries when approvalQueue returns an auth graphql error', () => {
    authServiceMock.refreshToken.mockReturnValue(
      of({
        accessToken: 'workspace-token-refreshed',
        refreshToken: 'workspace-refresh-refreshed',
        id: 'acc-123',
        email: 'approver@finflow.local',
        sessionKind: 'workspace',
        membershipId: 'membership-123',
        role: 'Owner',
        idTenant: 'tenant-123',
      }),
    );

    const service = TestBed.inject(ApprovalsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getApprovalQueue('PENDING', 'aws', 1, 20).subscribe((value) => {
      result = value;
    });

    const firstRequest = httpTesting.expectOne('/graphql');
    firstRequest.flush({
      errors: [{ message: 'User is not authenticated or token is invalid' }],
    });

    expect(authServiceMock.refreshToken).toHaveBeenCalledTimes(1);

    const retriedRequest = httpTesting.expectOne('/graphql');
    expect(retriedRequest.request.body.variables).toEqual({
      status: 'PENDING',
      search: 'aws',
      page: 1,
      pageSize: 20,
    });
    retriedRequest.flush({
      data: {
        approvalQueue: {
          items: [
            {
              documentId: 'doc-321',
              title: 'Creative Agency retainer',
              vendorName: 'Creative Agency XYZ',
              requester: 'James Osei',
              requesterEmail: 'james.osei@meridian.com',
              department: 'Marketing',
              amount: 7600,
              currency: 'VND',
              expenseDate: '2024-11-25',
              submittedAt: '2024-11-21T10:15:00Z',
              priority: 'Medium',
              status: 'Pending',
              policySummary: 'Requires manager approval',
            },
          ],
          page: 1,
          pageSize: 20,
          totalCount: 1,
          totalPages: 1,
        },
      },
    });

    expect(result).toEqual({
      items: [
        {
          documentId: 'doc-321',
          title: 'Creative Agency retainer',
          vendorName: 'Creative Agency XYZ',
          requester: 'James Osei',
          requesterEmail: 'james.osei@meridian.com',
          department: 'Marketing',
          amount: 7600,
          currency: 'VND',
          expenseDate: '2024-11-25',
          submittedAt: '2024-11-21T10:15:00Z',
          priority: 'Medium',
          status: 'Pending',
          policySummary: 'Requires manager approval',
        },
      ],
      page: 1,
      pageSize: 20,
      totalCount: 1,
      totalPages: 1,
    });
    httpTesting.verify();
  });
});

