import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { PaymentsApiService } from './payments-api.service';

describe('PaymentsApiService', () => {
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

  it('returns payment queue items from the graphql endpoint', () => {
    const service = TestBed.inject(PaymentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getPaymentQueue('Scheduled', 'Creative').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('paymentQueue');
    expect(request.request.body.variables).toEqual({
      status: 'Scheduled',
      search: 'Creative',
    });

    request.flush({
      data: {
        paymentQueue: [
          {
            paymentId: 'pay-1',
            documentId: 'doc-1',
            reference: 'INV-001',
            documentFileName: 'INV-001.pdf',
            employeeName: 'Marcus Lee',
            employeeMembershipId: 'MBS-0055',
            employeeCode: null,
            merchantName: 'Creative Agency XYZ',
            department: 'Marketing',
            amount: 7600,
            currencyCode: 'VND',
            amountInBaseCurrency: 7600,
            expenseDate: '2026-05-20',
            submittedAt: '2026-05-01T09:00:00Z',
            queueStatus: 'Scheduled',
            paymentMethod: 'BankTransfer',
            recordedAt: '2026-05-02T10:00:00Z',
            confirmedAt: null,
            rejectionReason: null,
            notes: null,
          },
        ],
      },
    });

    expect(result).toEqual([
      {
        paymentId: 'pay-1',
        documentId: 'doc-1',
        reference: 'INV-001',
        documentFileName: 'INV-001.pdf',
        employeeName: 'Marcus Lee',
        employeeMembershipId: 'MBS-0055',
        employeeCode: null,
        merchantName: 'Creative Agency XYZ',
        department: 'Marketing',
        amount: 7600,
        currencyCode: 'VND',
        amountInBaseCurrency: 7600,
        expenseDate: '2026-05-20',
        submittedAt: '2026-05-01T09:00:00Z',
        queueStatus: 'Scheduled',
        paymentMethod: 'BankTransfer',
        recordedAt: '2026-05-02T10:00:00Z',
        confirmedAt: null,
        rejectionReason: null,
        notes: null,
      },
    ]);
    httpTesting.verify();
  });

  it('refreshes the session and retries when paymentQueue returns an auth graphql error', () => {
    authServiceMock.refreshToken.mockReturnValue(
      of({
        accessToken: 'workspace-token-refreshed',
        refreshToken: 'workspace-refresh-refreshed',
        id: 'acc-123',
        email: 'accountant@finflow.local',
        sessionKind: 'workspace',
        membershipId: 'membership-123',
        role: 'Accountant',
        idTenant: 'tenant-123',
      }),
    );

    const service = TestBed.inject(PaymentsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getPaymentQueue().subscribe((value) => {
      result = value;
    });

    const firstRequest = httpTesting.expectOne('/graphql');
    firstRequest.flush({
      errors: [{ message: 'User is not authenticated or token is invalid' }],
    });

    expect(authServiceMock.refreshToken).toHaveBeenCalledTimes(1);

    const retriedRequest = httpTesting.expectOne('/graphql');
    expect(retriedRequest.request.body.variables).toEqual({
      status: 'ALL',
      search: null,
    });
    retriedRequest.flush({
      data: {
        paymentQueue: [],
      },
    });

    expect(result).toEqual([]);
    httpTesting.verify();
  });
});
