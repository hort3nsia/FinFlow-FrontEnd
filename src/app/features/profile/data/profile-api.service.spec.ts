import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { ProfileApiService, ReimbursementProfileResponse } from './profile-api.service';

describe('ProfileApiService', () => {
  const authServiceMock = {
    refreshToken: vi.fn(),
  };

  const profile: ReimbursementProfileResponse = {
    membershipId: 'membership-123',
    bankCode: 'VCB',
    bankName: 'Vietcombank',
    bankAccountLast4: '1234',
    bankAccountHolderName: 'NGUYEN VAN A',
    bankBranch: 'HCM',
    preferredPaymentMethod: 'BankTransfer',
    contactPhone: '0901234567',
    reimbursementEmail: 'reimburse@finflow.local',
    taxId: '8123456789',
    hasBankInfo: true,
    updatedAt: '2026-05-27T10:00:00Z',
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

  it('returns the current reimbursement profile from the graphql endpoint', () => {
    const service = TestBed.inject(ProfileApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: ReimbursementProfileResponse | null | undefined;

    service.getMyProfile().subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('myReimbursementProfile');

    request.flush({
      data: {
        myReimbursementProfile: profile,
      },
    });

    expect(result).toEqual(profile);
    httpTesting.verify();
  });

  it('refreshes the session and retries when my profile returns an auth graphql error', () => {
    authServiceMock.refreshToken.mockReturnValue(
      of({
        accessToken: 'workspace-token-refreshed',
        refreshToken: 'workspace-refresh-refreshed',
        id: 'acc-123',
        email: 'staff@finflow.local',
        sessionKind: 'workspace',
        membershipId: 'membership-123',
        role: 'Staff',
        idTenant: 'tenant-123',
      }),
    );

    const service = TestBed.inject(ProfileApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: ReimbursementProfileResponse | null | undefined;

    service.getMyProfile().subscribe((value) => {
      result = value;
    });

    const firstRequest = httpTesting.expectOne('/graphql');
    firstRequest.flush({
      errors: [{ message: 'User is not authenticated or token is invalid' }],
    });

    expect(authServiceMock.refreshToken).toHaveBeenCalledTimes(1);

    const retriedRequest = httpTesting.expectOne('/graphql');
    expect(retriedRequest.request.body.query).toContain('myReimbursementProfile');
    retriedRequest.flush({
      data: {
        myReimbursementProfile: profile,
      },
    });

    expect(result).toEqual(profile);
    httpTesting.verify();
  });
});
