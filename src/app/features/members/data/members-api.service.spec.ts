import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MembersApiService } from './members-api.service';

describe('MembersApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('returns workspace members from the graphql endpoint', () => {
    const service = TestBed.inject(MembersApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getWorkspaceMembers('tenant-1').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('workspaceMembers');
    expect(request.request.body.variables).toEqual({
      tenantId: 'tenant-1',
      departmentId: null,
    });

    request.flush({
      data: {
        workspaceMembers: [
          {
            id: 'membership-1',
            accountId: 'account-1',
            tenantId: 'tenant-1',
            departmentId: 'department-1',
            fullName: 'Director Kim',
            email: 'director.kim@meridian.com',
            departmentName: 'Finance',
            role: 'TENANT_ADMIN',
            isOwner: true,
            isActive: true,
            createdAt: '2026-05-01T09:00:00Z',
            lastActiveAt: '2026-05-02T10:30:00Z',
            deactivatedAt: null,
            deactivatedBy: null,
            deactivatedReason: null,
          },
        ],
      },
    });

    expect(result).toEqual([
      {
        id: 'membership-1',
        accountId: 'account-1',
        tenantId: 'tenant-1',
        departmentId: 'department-1',
        fullName: 'Director Kim',
        email: 'director.kim@meridian.com',
        departmentName: 'Finance',
        role: 'TENANT_ADMIN',
        isOwner: true,
        isActive: true,
        createdAt: '2026-05-01T09:00:00Z',
        lastActiveAt: '2026-05-02T10:30:00Z',
        deactivatedAt: null,
        deactivatedBy: null,
        deactivatedReason: null,
      },
    ]);
    httpTesting.verify();
  });

  it('returns departments from the graphql endpoint', () => {
    const service = TestBed.inject(MembersApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getDepartments().subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('departments');

    request.flush({
      data: {
        departments: [
          {
            id: 'department-1',
            name: 'Finance',
            parentId: null,
            isActive: true,
          },
        ],
      },
    });

    expect(result).toEqual([
      {
        id: 'department-1',
        name: 'Finance',
        parentId: null,
        isActive: true,
      },
    ]);
    httpTesting.verify();
  });

  it('returns invitations from the graphql endpoint', () => {
    const service = TestBed.inject(MembersApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getInvitations('tenant-1').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('invitations');
    expect(request.request.body.variables).toEqual({
      tenantId: 'tenant-1',
    });

    request.flush({
      data: {
        invitations: [
          {
            id: 'invitation-1',
            email: 'new.manager@meridian.com',
            tenantId: 'tenant-1',
            role: 'MANAGER',
            expiresAt: '2026-05-06T00:00:00Z',
            createdAt: '2026-05-02T00:00:00Z',
            acceptedAt: null,
            revokedAt: null,
            revokedByMembershipId: null,
            isPending: true,
            isExpired: false,
          },
        ],
      },
    });

    expect(result).toEqual([
      {
        id: 'invitation-1',
        email: 'new.manager@meridian.com',
        tenantId: 'tenant-1',
        role: 'MANAGER',
        expiresAt: '2026-05-06T00:00:00Z',
        createdAt: '2026-05-02T00:00:00Z',
        acceptedAt: null,
        revokedAt: null,
        revokedByMembershipId: null,
        isPending: true,
        isExpired: false,
      },
    ]);
    httpTesting.verify();
  });

  it('returns member detail from the graphql endpoint', () => {
    const service = TestBed.inject(MembersApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.getMember('membership-1', 'tenant-1').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('member');
    expect(request.request.body.variables).toEqual({
      membershipId: 'membership-1',
      tenantId: 'tenant-1',
    });

    request.flush({
      data: {
        member: {
          id: 'membership-1',
          accountId: 'account-1',
          tenantId: 'tenant-1',
          departmentId: 'department-1',
          fullName: 'Director Kim',
          email: 'director.kim@meridian.com',
          departmentName: 'Finance',
          role: 'TENANT_ADMIN',
          isOwner: true,
          isActive: true,
          createdAt: '2026-05-01T09:00:00Z',
          lastActiveAt: '2026-05-02T10:30:00Z',
          deactivatedAt: null,
          deactivatedBy: null,
          deactivatedReason: null,
        },
      },
    });

    expect(result).toEqual({
      id: 'membership-1',
      accountId: 'account-1',
      tenantId: 'tenant-1',
      departmentId: 'department-1',
      fullName: 'Director Kim',
      email: 'director.kim@meridian.com',
      departmentName: 'Finance',
      role: 'TENANT_ADMIN',
      isOwner: true,
      isActive: true,
      createdAt: '2026-05-01T09:00:00Z',
      lastActiveAt: '2026-05-02T10:30:00Z',
      deactivatedAt: null,
      deactivatedBy: null,
      deactivatedReason: null,
    });
    httpTesting.verify();
  });

  it('creates an invitation through the graphql endpoint', () => {
    const service = TestBed.inject(MembersApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service
      .inviteMember({
        email: 'new.staff@meridian.com',
        role: 'STAFF',
        departmentId: 'department-hr',
      })
      .subscribe((value: unknown) => {
        result = value;
      });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('inviteMember');
    expect(request.request.body.variables).toEqual({
      input: {
        email: 'new.staff@meridian.com',
        role: 'STAFF',
        departmentId: 'department-hr',
      },
    });

    request.flush({
      data: {
        inviteMember: {
          invitationId: 'invitation-3',
          inviteToken: 'token-123',
          email: 'new.staff@meridian.com',
          role: 'STAFF',
          idTenant: 'tenant-1',
          expiresAt: '2026-05-12T00:00:00Z',
        },
      },
    });

    expect(result).toEqual({
      invitationId: 'invitation-3',
      inviteToken: 'token-123',
      email: 'new.staff@meridian.com',
      role: 'STAFF',
      idTenant: 'tenant-1',
      expiresAt: '2026-05-12T00:00:00Z',
    });
    httpTesting.verify();
  });

  it('changes a member role through the graphql endpoint', () => {
    const service = TestBed.inject(MembersApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let result: unknown;

    service.changeMemberRole('tenant-1', 'membership-2', 'MANAGER').subscribe((value) => {
      result = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('changeMemberRole');
    expect(request.request.body.variables).toEqual({
      tenantId: 'tenant-1',
      input: {
        membershipId: 'membership-2',
        newRole: 'MANAGER',
      },
    });

    request.flush({
      data: {
        changeMemberRole: {
          success: true,
          message: null,
        },
      },
    });

    expect(result).toEqual({ success: true, message: null });
    httpTesting.verify();
  });

  it('removes and reactivates members through real membership mutations', () => {
    const service = TestBed.inject(MembersApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    const results: unknown[] = [];

    service.removeMember('tenant-1', 'membership-2', 'Left project').subscribe((value) => {
      results.push(value);
    });
    service.reactivateMember('tenant-1', 'membership-2').subscribe((value) => {
      results.push(value);
    });

    const removeRequest = httpTesting.expectOne((request) =>
      String(request.body.query).includes('removeMember'),
    );
    expect(removeRequest.request.body.variables).toEqual({
      tenantId: 'tenant-1',
      input: {
        membershipId: 'membership-2',
        reason: 'Left project',
      },
    });
    removeRequest.flush({
      data: {
        removeMember: {
          success: true,
          message: null,
        },
      },
    });

    const reactivateRequest = httpTesting.expectOne((request) =>
      String(request.body.query).includes('reactivateMember'),
    );
    expect(reactivateRequest.request.body.variables).toEqual({
      tenantId: 'tenant-1',
      membershipId: 'membership-2',
    });
    reactivateRequest.flush({
      data: {
        reactivateMember: {
          success: true,
          message: null,
        },
      },
    });

    expect(results).toEqual([
      { success: true, message: null },
      { success: true, message: null },
    ]);
    httpTesting.verify();
  });

  it('resends and revokes invitations through real membership mutations', () => {
    const service = TestBed.inject(MembersApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    const results: unknown[] = [];

    service.resendInvitation('tenant-1', 'invitation-1').subscribe((value) => {
      results.push(value);
    });
    service.revokeInvitation('tenant-1', 'invitation-1').subscribe((value) => {
      results.push(value);
    });

    const resendRequest = httpTesting.expectOne((request) =>
      String(request.body.query).includes('resendInvitation'),
    );
    expect(resendRequest.request.body.variables.tenantId).toBe('tenant-1');
    expect(resendRequest.request.body.variables.input.invitationId).toBe('invitation-1');
    expect(resendRequest.request.body.variables.input.newToken).toEqual(expect.any(String));
    expect(resendRequest.request.body.variables.input.newExpiresAt).toEqual(expect.any(String));
    resendRequest.flush({
      data: {
        resendInvitation: {
          success: true,
          message: null,
        },
      },
    });

    const revokeRequest = httpTesting.expectOne((request) =>
      String(request.body.query).includes('revokeInvitation'),
    );
    expect(revokeRequest.request.body.variables).toEqual({
      tenantId: 'tenant-1',
      input: {
        invitationId: 'invitation-1',
      },
    });
    revokeRequest.flush({
      data: {
        revokeInvitation: {
          success: true,
          message: null,
        },
      },
    });

    expect(results).toEqual([
      { success: true, message: null },
      { success: true, message: null },
    ]);
    httpTesting.verify();
  });
});
