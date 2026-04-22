import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthApiService } from './auth-api.service';

const createLoginInput = () => ({
  email: 'demo@finflow.local',
  password: 'Pass@word1',
  tenantCode: 'finflow',
});

describe('AuthApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('returns login data from a successful response', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.login(createLoginInput()).subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush({
      data: {
        login: {
          accessToken: 'access-123',
          refreshToken: 'refresh-123',
          id: '9b3c9e2c-efb2-44d4-98eb-c9217f6a16cf',
          membershipId: '1c2f1b35-bdcb-45d2-a889-a7c4cbebdf64',
          email: 'demo@finflow.local',
          role: 'Owner',
          idTenant: '4e97f2c7-d7f5-4dfd-b0df-826bc843f0cb',
        },
      },
    });

    expect(result).toEqual({
      accessToken: 'access-123',
      refreshToken: 'refresh-123',
      id: '9b3c9e2c-efb2-44d4-98eb-c9217f6a16cf',
      membershipId: '1c2f1b35-bdcb-45d2-a889-a7c4cbebdf64',
      email: 'demo@finflow.local',
      role: 'Owner',
      idTenant: '4e97f2c7-d7f5-4dfd-b0df-826bc843f0cb',
    });
    httpTesting.verify();
  });

  it('returns verification-pending data from register', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.register({
      email: 'new@finflow.local',
      password: 'Pass@word1',
      name: 'New User',
    }).subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush({
      data: {
        register: {
          accountId: 'account-123',
          email: 'new@finflow.local',
          requiresEmailVerification: true,
          cooldownSeconds: 90,
        },
      },
    });

    expect(result).toEqual({
      accountId: 'account-123',
      email: 'new@finflow.local',
      requiresEmailVerification: true,
      cooldownSeconds: 90,
    });
    httpTesting.verify();
  });

  it('verifies an email token through the expected mutation', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: boolean | undefined;

    service.verifyEmailByToken('token-123').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.variables.token).toBe('token-123');

    request.flush({
      data: {
        verifyEmailByToken: true,
      },
    });

    expect(result).toBe(true);
    httpTesting.verify();
  });

  it('verifies an email otp through the expected mutation', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: boolean | undefined;

    service.verifyEmailByOtp({
      email: 'new@finflow.local',
      otp: '123456',
    }).subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.variables.email).toBe('new@finflow.local');
    expect(request.request.body.variables.otp).toBe('123456');

    request.flush({
      data: {
        verifyEmailByOtp: true,
      },
    });

    expect(result).toBe(true);
    httpTesting.verify();
  });

  it('returns resend verification dispatch metadata', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.resendEmailVerification('new@finflow.local').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.variables.email).toBe('new@finflow.local');

    request.flush({
      data: {
        resendEmailVerification: {
          accepted: true,
          cooldownSeconds: 90,
        },
      },
    });

    expect(result).toEqual({
      accepted: true,
      cooldownSeconds: 90,
    });
    httpTesting.verify();
  });

  it('returns forgot password dispatch metadata', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.forgotPassword('demo@finflow.local').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.variables.email).toBe('demo@finflow.local');

    request.flush({
      data: {
        forgotPassword: {
          accepted: true,
          cooldownSeconds: 120,
        },
      },
    });

    expect(result).toEqual({
      accepted: true,
      cooldownSeconds: 120,
    });
    httpTesting.verify();
  });

  it('verifies a password reset token through the expected mutation', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: boolean | undefined;

    service.verifyPasswordResetToken('reset-token-123').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.variables.token).toBe('reset-token-123');

    request.flush({
      data: {
        verifyPasswordResetToken: true,
      },
    });

    expect(result).toBe(true);
    httpTesting.verify();
  });

  it('resets a password by token through the expected mutation', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: boolean | undefined;

    service.resetPasswordByToken('reset-token-123', 'Pass@word2').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.variables.token).toBe('reset-token-123');
    expect(request.request.body.variables.newPassword).toBe('Pass@word2');

    request.flush({
      data: {
        resetPasswordByToken: true,
      },
    });

    expect(result).toBe(true);
    httpTesting.verify();
  });

  it('resets a password by otp through the expected mutation', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: boolean | undefined;

    service.resetPasswordByOtp({
      email: 'demo@finflow.local',
      otp: '654321',
      newPassword: 'Pass@word2',
    }).subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.variables.input).toEqual({
      email: 'demo@finflow.local',
      otp: '654321',
      newPassword: 'Pass@word2',
    });

    request.flush({
      data: {
        resetPasswordByOtp: true,
      },
    });

    expect(result).toBe(true);
    httpTesting.verify();
  });

  it('surfaces graphql errors from a normal response body', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let thrownMessage: string | null = null;

    service.login(createLoginInput()).subscribe({
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush({
      errors: [{ message: 'Invalid credentials' }],
    });

    expect(thrownMessage).toBe('Invalid credentials');
    httpTesting.verify();
  });

  it('surfaces graphql errors from HttpErrorResponse.error.errors', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let thrownMessage: string | null = null;

    service.login(createLoginInput()).subscribe({
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush(
      { errors: [{ message: 'Tenant is disabled' }] },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(thrownMessage).toBe('Tenant is disabled');
    httpTesting.verify();
  });

  it('rejects a response without login data', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let thrownMessage: string | null = null;

    service.login(createLoginInput()).subscribe({
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush({
      data: {},
    });

    expect(thrownMessage).toBe('Login response did not include session data.');
    httpTesting.verify();
  });

  it('calls the logout mutation with the supplied refresh token', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: boolean | undefined;

    service.logout('refresh-123').subscribe((value: boolean) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.variables.refreshToken).toBe('refresh-123');

    request.flush({
      data: {
        logout: true,
      },
    });

    expect(result).toBe(true);
    httpTesting.verify();
  });

  it('surfaces graphql logout errors from a normal response body', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let thrownMessage: string | null = null;

    service.logout('refresh-123').subscribe({
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush({
      errors: [{ message: 'Refresh token is invalid.' }],
    });

    expect(thrownMessage).toBe('Refresh token is invalid.');
    httpTesting.verify();
  });

  it('surfaces graphql logout errors from HttpErrorResponse.error.errors', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let thrownMessage: string | null = null;

    service.logout('refresh-123').subscribe({
      error: (error: Error) => {
        thrownMessage = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush(
      { errors: [{ message: 'Tenant context is missing.' }] },
      { status: 400, statusText: 'Bad Request' },
    );

    expect(thrownMessage).toBe('Tenant context is missing.');
    httpTesting.verify();
  });

  it('rejects a logout response without a boolean data.logout result', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let missingResultMessage: string | null = null;
    let invalidResultMessage: string | null = null;

    service.logout('refresh-123').subscribe({
      error: (error: Error) => {
        missingResultMessage = error.message;
      },
    });

    let request = httpTesting.expectOne('/graphql');
    request.flush({
      data: {},
    });

    service.logout('refresh-123').subscribe({
      error: (error: Error) => {
        invalidResultMessage = error.message;
      },
    });

    request = httpTesting.expectOne('/graphql');
    request.flush({
      data: {
        logout: 'true',
      },
    });

    expect(missingResultMessage).toBe('Logout response did not include a result.');
    expect(invalidResultMessage).toBe('Logout response did not include a result.');
    httpTesting.verify();
  });

  it('creates a workspace through the workspace-session mutation and normalizes the response', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service
      .createWorkspace({
        name: 'Main Corp',
        tenantCode: 'main-corp',
        currency: 'VND',
      })
      .subscribe((value: unknown) => {
        result = value;
      });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('mutation CreateWorkspace');
    expect(request.request.body.variables.input).toEqual({
      name: 'Main Corp',
      tenantCode: 'main-corp',
      currency: 'VND',
    });

    request.flush({
      data: {
        createWorkspace: {
          accessToken: 'workspace-access',
          refreshToken: 'workspace-refresh',
          accountId: 'account-1',
          membershipId: 'membership-1',
          email: 'demo@finflow.local',
          role: 'Owner',
          tenantId: 'tenant-1',
          sessionKind: 'workspace',
        },
      },
    });

    expect(result).toEqual({
      accessToken: 'workspace-access',
      refreshToken: 'workspace-refresh',
      id: 'account-1',
      membershipId: 'membership-1',
      email: 'demo@finflow.local',
      role: 'Owner',
      idTenant: 'tenant-1',
      sessionKind: 'workspace',
    });
    httpTesting.verify();
  });

  it('selects a workspace through the dedicated mutation', () => {
    const service = TestBed.inject(AuthApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.selectWorkspace('membership-1').subscribe((value: unknown) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('mutation SelectWorkspace');
    expect(request.request.body.variables.input).toEqual({
      membershipId: 'membership-1',
    });

    request.flush({
      data: {
        selectWorkspace: {
          accessToken: 'workspace-access',
          refreshToken: 'workspace-refresh',
          accountId: 'account-1',
          membershipId: 'membership-1',
          email: 'demo@finflow.local',
          role: 'Owner',
          tenantId: 'tenant-1',
          sessionKind: 'workspace',
        },
      },
    });

    expect(result).toEqual({
      accessToken: 'workspace-access',
      refreshToken: 'workspace-refresh',
      id: 'account-1',
      membershipId: 'membership-1',
      email: 'demo@finflow.local',
      role: 'Owner',
      idTenant: 'tenant-1',
      sessionKind: 'workspace',
    });
    httpTesting.verify();
  });
});
