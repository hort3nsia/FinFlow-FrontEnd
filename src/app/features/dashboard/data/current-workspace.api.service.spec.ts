import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { CurrentWorkspaceApiService } from './current-workspace.api.service';

describe('CurrentWorkspaceApiService', () => {
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

  it('refreshes the session and retries when currentWorkspace returns an auth graphql error', () => {
    authServiceMock.refreshToken.mockReturnValue(
      of({
        accessToken: 'workspace-token-refreshed',
        refreshToken: 'workspace-refresh-refreshed',
        id: 'acc-123',
        email: 'demo@finflow.local',
        sessionKind: 'workspace',
        membershipId: 'membership-123',
        role: 'Owner',
        idTenant: 'tenant-123',
      }),
    );

    const service = TestBed.inject(CurrentWorkspaceApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getCurrentWorkspace().subscribe((value) => {
      result = value;
    });

    const firstRequest = httpTesting.expectOne('/graphql');
    firstRequest.flush({
      errors: [{ message: 'The current user is not authorized.' }],
    });

    expect(authServiceMock.refreshToken).toHaveBeenCalledTimes(1);

    const retriedRequest = httpTesting.expectOne('/graphql');
    retriedRequest.flush({
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
