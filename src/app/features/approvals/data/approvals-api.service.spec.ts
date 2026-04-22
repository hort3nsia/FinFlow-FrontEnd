import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ApprovalsApiService } from './approvals-api.service';

describe('ApprovalsApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('returns pending approval items from the graphql endpoint', () => {
    const service = TestBed.inject(ApprovalsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getPendingApprovalItems().subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('pendingApprovalItems');

    request.flush({
      data: {
        pendingApprovalItems: [
          {
            documentId: 'doc-123',
            title: 'AWS October invoice',
            requester: 'Documents review',
            department: 'Infrastructure',
            amount: 1450,
            dueDate: '2024-11-12',
            priority: 'High',
            status: 'Pending',
          },
        ],
      },
    });

    expect(result).toEqual([
      {
        documentId: 'doc-123',
        title: 'AWS October invoice',
        requester: 'Documents review',
        department: 'Infrastructure',
        amount: 1450,
        dueDate: '2024-11-12',
        priority: 'High',
        status: 'Pending',
      },
    ]);
    httpTesting.verify();
  });

  it('surfaces graphql errors from approval queries', () => {
    const service = TestBed.inject(ApprovalsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let thrownMessage: string | null = null;

    service.getPendingApprovalItems().subscribe({
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush({ errors: [{ message: 'Approvals unavailable.' }] });

    expect(thrownMessage).toBe('Approvals unavailable.');
    httpTesting.verify();
  });
});
