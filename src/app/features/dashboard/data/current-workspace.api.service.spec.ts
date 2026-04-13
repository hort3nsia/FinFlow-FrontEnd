import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CurrentWorkspaceApiService } from './current-workspace.api.service';

describe('CurrentWorkspaceApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('returns current workspace data from the graphql endpoint', () => {
    const service = TestBed.inject(CurrentWorkspaceApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getCurrentWorkspace().subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('currentWorkspace');

    request.flush({
      data: {
        currentWorkspace: {
          accountId: 'acc-123',
          email: 'demo@finflow.local',
          membershipId: 'membership-123',
          role: 'Owner',
          tenantId: 'tenant-123',
          tenantCode: 'finflow',
          tenantName: 'FinFlow Demo Tenant',
        },
      },
    });

    expect(result).toEqual({
      accountId: 'acc-123',
      email: 'demo@finflow.local',
      membershipId: 'membership-123',
      role: 'Owner',
      tenantId: 'tenant-123',
      tenantCode: 'finflow',
      tenantName: 'FinFlow Demo Tenant',
    });
    httpTesting.verify();
  });

  it('surfaces graphql errors from currentWorkspace responses', () => {
    const service = TestBed.inject(CurrentWorkspaceApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let thrownMessage: string | null = null;

    service.getCurrentWorkspace().subscribe({
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush({
      errors: [{ message: 'Workspace context unavailable.' }],
    });

    expect(thrownMessage).toBe('Workspace context unavailable.');
    httpTesting.verify();
  });

  it('surfaces graphql errors from HttpErrorResponse.error.errors', () => {
    const service = TestBed.inject(CurrentWorkspaceApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let thrownMessage: string | null = null;

    service.getCurrentWorkspace().subscribe({
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush(
      { errors: [{ message: 'Workspace context missing.' }] },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(thrownMessage).toBe('Workspace context missing.');
    httpTesting.verify();
  });

  it('rejects missing or malformed currentWorkspace data', () => {
    const service = TestBed.inject(CurrentWorkspaceApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    const messages: string[] = [];

    service.getCurrentWorkspace().subscribe({
      error: (error: Error) => {
        messages.push(error.message);
      },
    });

    let request = httpTesting.expectOne('/graphql');
    request.flush({
      data: {
        currentWorkspace: null,
      },
    });

    service.getCurrentWorkspace().subscribe({
      error: (error: Error) => {
        messages.push(error.message);
      },
    });

    request = httpTesting.expectOne('/graphql');
    request.flush({
      data: {
        currentWorkspace: {
          accountId: 'acc-123',
          email: 'demo@finflow.local',
          membershipId: 'membership-123',
          role: 'TENANT_ADMIN',
          tenantId: 'tenant-123',
          tenantCode: 'finflow',
          tenantName: null,
        },
      },
    });

    expect(messages).toEqual([
      'Current workspace response did not include workspace data.',
      'Current workspace response did not include workspace data.',
    ]);
    httpTesting.verify();
  });
});
