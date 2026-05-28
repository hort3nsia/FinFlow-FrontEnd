import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { SettingsApiService, TenantSettingsResponse } from './settings-api.service';

describe('SettingsApiService', () => {
  const authServiceMock = {
    refreshToken: vi.fn(),
    getAccessToken: vi.fn(),
  };

  const settings: TenantSettingsResponse = {
    id: 'settings-1',
    branding: {
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#2563eb',
      companyDisplayName: 'Meridian Finance',
      locale: 'vi-VN',
      timezone: 'Asia/Ho_Chi_Minh',
    },
    approvalPolicy: {
      autoApproveThreshold: 0,
      escalationThreshold: 5000000,
      escalationApproverRole: 'TenantAdmin',
      requireDifferentApprover: true,
      maxApprovalAgeHours: 48,
      isEscalationEnabled: true,
    },
    budgetPolicy: {
      defaultEnforcementMode: 'SoftBlock',
      defaultCarryOverPercent: 15,
      warningThreshold1: 70,
      warningThreshold2: 90,
    },
    reimbursementPolicy: {
      maxClaimAmount: 20000000,
      receiptRequiredAbove: 500000,
    },
    notificationPreferences: {
      emailDigestEnabled: true,
      emailDigestFrequency: 'weekly',
    },
    updatedAt: '2026-05-24T09:30:00Z',
  };

  beforeEach(() => {
    authServiceMock.refreshToken.mockReset();
    authServiceMock.getAccessToken.mockReset();
    authServiceMock.getAccessToken.mockReturnValue('workspace-token');

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceMock },
      ],
    });
  });

  it('returns tenant settings from the graphql endpoint', () => {
    const service = TestBed.inject(SettingsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: TenantSettingsResponse | undefined;

    service.getSettings().subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('getTenantSettings');
    request.flush({
      data: {
        getTenantSettings: settings,
      },
    });

    expect(result).toEqual(settings);
    httpTesting.verify();
  });

  it('returns tenant branding from the public workspace branding endpoint', () => {
    const service = TestBed.inject(SettingsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: TenantSettingsResponse['branding'] | undefined;

    service.getBranding().subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('tenantBranding');
    expect(request.request.body.query).not.toContain('getTenantSettings');
    request.flush({
      data: {
        tenantBranding: settings.branding,
      },
    });

    expect(result).toEqual(settings.branding);
    httpTesting.verify();
  });

  it('uploads a tenant branding asset through the REST upload endpoint', () => {
    const service = TestBed.inject(SettingsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    const file = new File(['logo'], 'logo.png', { type: 'image/png' });
    let result: { url: string } | undefined;

    service.uploadBrandingAsset('logo', file).subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/api/tenant-settings/branding-assets');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer workspace-token');
    expect(request.request.body instanceof FormData).toBe(true);
    expect(request.request.body.get('kind')).toBe('logo');
    expect(request.request.body.get('file')).toBe(file);
    request.flush({ url: '/uploads/tenant-branding/tenant/logo-123.png' });

    expect(result).toEqual({ url: '/uploads/tenant-branding/tenant/logo-123.png' });
    httpTesting.verify();
  });

  it('refreshes the session and retries when tenant settings returns an auth graphql error', () => {
    authServiceMock.refreshToken.mockReturnValue(
      of({
        accessToken: 'workspace-token-refreshed',
        refreshToken: 'workspace-refresh-refreshed',
        id: 'acc-123',
        email: 'admin@finflow.local',
        sessionKind: 'workspace',
        membershipId: 'membership-123',
        role: 'TenantAdmin',
        idTenant: 'tenant-123',
      }),
    );

    const service = TestBed.inject(SettingsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: TenantSettingsResponse | undefined;

    service.getSettings().subscribe((value) => {
      result = value;
    });

    const firstRequest = httpTesting.expectOne('/graphql');
    firstRequest.flush({
      errors: [{ message: 'User is not authenticated or token is invalid' }],
    });

    expect(authServiceMock.refreshToken).toHaveBeenCalledTimes(1);

    const retriedRequest = httpTesting.expectOne('/graphql');
    expect(retriedRequest.request.body.query).toContain('getTenantSettings');
    retriedRequest.flush({
      data: {
        getTenantSettings: settings,
      },
    });

    expect(result).toEqual(settings);
    httpTesting.verify();
  });
});
