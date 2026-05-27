import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApprovalsApiService } from '../../approvals/data/approvals-api.service';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { MembersApiService } from '../data/members-api.service';
import { MembersPageComponent } from './members-page.component';

describe('MembersPageComponent', () => {
  const workspaceState = signal({
    workspace: {
      tenantId: 'tenant-1',
      membershipId: 'membership-admin',
      tenantName: 'Meridian Corp',
    } as any,
    loading: false,
    error: null,
  });

  const membersApi = {
    getWorkspaceMembers: vi.fn(),
    getDepartments: vi.fn(),
    getInvitations: vi.fn(),
    getMember: vi.fn(),
    inviteMember: vi.fn(),
    changeMemberRole: vi.fn(),
    removeMember: vi.fn(),
    reactivateMember: vi.fn(),
    resendInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
  };

  const approvalsApi = {
    getApprovalQueue: vi.fn(),
  };

  const members = [
    {
      id: 'membership-admin',
      accountId: 'account-admin',
      tenantId: 'tenant-1',
      departmentId: 'department-finance',
      fullName: 'Director Kim',
      email: 'director.kim@meridian.test',
      departmentName: 'Finance',
      role: 'TENANT_ADMIN',
      isOwner: true,
      isActive: true,
      createdAt: '2026-05-01T09:00:00Z',
      lastActiveAt: '2026-05-20T10:30:00Z',
      deactivatedAt: null,
      deactivatedBy: null,
      deactivatedReason: null,
    },
    {
      id: 'membership-staff',
      accountId: 'account-staff',
      tenantId: 'tenant-1',
      departmentId: 'department-ops',
      fullName: 'Nguyễn Văn An',
      email: 'an.nguyen@meridian.test',
      departmentName: 'Vận hành',
      role: 'STAFF',
      isOwner: false,
      isActive: false,
      createdAt: '2026-04-20T09:00:00Z',
      lastActiveAt: null,
      deactivatedAt: '2026-05-12T08:15:00Z',
      deactivatedBy: 'membership-admin',
      deactivatedReason: 'Nghỉ dự án',
    },
  ];

  const departments = [
    { id: 'department-finance', name: 'Finance', parentId: null, isActive: true },
    { id: 'department-ops', name: 'Vận hành', parentId: null, isActive: true },
  ];

  const invitations = [
    {
      id: 'invitation-1',
      email: 'new.manager@meridian.test',
      tenantId: 'tenant-1',
      role: 'MANAGER',
      expiresAt: '2026-06-01T00:00:00Z',
      createdAt: '2026-05-18T00:00:00Z',
      acceptedAt: null,
      revokedAt: null,
      revokedByMembershipId: null,
      isPending: true,
      isExpired: false,
    },
  ];

  const createComponent = (): ComponentFixture<MembersPageComponent> => {
    const fixture = TestBed.createComponent(MembersPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    membersApi.getWorkspaceMembers.mockReset();
    membersApi.getDepartments.mockReset();
    membersApi.getInvitations.mockReset();
    membersApi.getMember.mockReset();
    membersApi.inviteMember.mockReset();
    membersApi.changeMemberRole.mockReset();
    membersApi.removeMember.mockReset();
    membersApi.reactivateMember.mockReset();
    membersApi.resendInvitation.mockReset();
    membersApi.revokeInvitation.mockReset();
    approvalsApi.getApprovalQueue.mockReset();

    membersApi.getWorkspaceMembers.mockReturnValue(of(members));
    membersApi.getDepartments.mockReturnValue(of(departments));
    membersApi.getInvitations.mockReturnValue(of(invitations));
    membersApi.getMember.mockImplementation((membershipId: string) =>
      of(members.find((member) => member.id === membershipId) ?? members[0]),
    );
    membersApi.inviteMember.mockReturnValue(of({ invitationId: 'invitation-2' }));
    membersApi.changeMemberRole.mockReturnValue(of({ success: true, message: null }));
    membersApi.removeMember.mockReturnValue(of({ success: true, message: null }));
    membersApi.reactivateMember.mockReturnValue(of({ success: true, message: null }));
    membersApi.resendInvitation.mockReturnValue(of({ success: true, message: null }));
    membersApi.revokeInvitation.mockReturnValue(of({ success: true, message: null }));
    approvalsApi.getApprovalQueue.mockReturnValue(
      of({
        items: [
          {
            documentId: 'document-1',
            title: 'BÁCH HÓA XANH · 21070052990051966',
            vendorName: 'BÁCH HÓA XANH',
            requester: 'Director Kim',
            requesterEmail: 'director.kim@meridian.test',
            department: 'Finance',
            amount: 187954,
            currency: 'VND',
            expenseDate: '2026-05-19',
            submittedAt: '2026-05-20T10:30:00Z',
            priority: 'Medium',
            status: 'ReadyForApproval',
            policySummary: null,
          },
          {
            documentId: 'document-2',
            title: 'Vé gửi xe tháng 5',
            vendorName: 'Parking Co',
            requester: 'Nguyễn Văn An',
            requesterEmail: 'an.nguyen@meridian.test',
            department: 'Vận hành',
            amount: 150000,
            currency: 'VND',
            expenseDate: '2026-05-10',
            submittedAt: '2026-05-11T08:00:00Z',
            priority: 'Low',
            status: 'Approved',
            policySummary: null,
          },
        ],
        page: 1,
        pageSize: 100,
        totalCount: 2,
        totalPages: 1,
      }),
    );

    TestBed.configureTestingModule({
      imports: [MembersPageComponent],
      providers: [
        { provide: MembersApiService, useValue: membersApi },
        { provide: ApprovalsApiService, useValue: approvalsApi },
        { provide: CurrentWorkspaceFacade, useValue: { state: workspaceState.asReadonly() } },
      ],
    });
  });

  it('renders the MagicPath membership workspace with real API rows and a selected inspector', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Quản lý thành viên');
    expect(text).toContain('Mời thành viên');
    expect(text).toContain('Tổng thành viên');
    expect(text).toContain('Đang hoạt động');
    expect(text).toContain('Lời mời chờ');
    expect(text).toContain('Vô hiệu hoá');
    expect(text).toContain('Thành viên');
    expect(text).toContain('Vai trò');
    expect(text).toContain('Phòng ban');
    expect(text).toContain('Trạng thái');
    expect(text).toContain('Tham gia');
    expect(text).toContain('Hành động');
    expect(text).toContain('Director Kim');
    expect(text).toContain('director.kim@meridian.test');
    expect(text).toContain('Owner');
    expect(text).toContain('Chi tiết thành viên');
    expect(text).toContain('Danh tính');
    expect(text).toContain('Quyền hạn');
    expect(text).toContain('Hoạt động');
    expect(text).toContain('Nhật ký');
    expect(text).not.toContain('mockMembers');
    expect(text).not.toContain('workspace.local');
    expect(membersApi.getWorkspaceMembers).toHaveBeenCalledWith('tenant-1');
    expect(membersApi.getInvitations).toHaveBeenCalledWith('tenant-1');
    expect(approvalsApi.getApprovalQueue).toHaveBeenCalledWith('ALL', null, 1, 100);
    expect(membersApi.getMember).toHaveBeenCalledWith('membership-admin', 'tenant-1');
  });

  it('shows inactive lifecycle detail from backend member fields instead of fabricated audit rows', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.selectMemberRow('membership-staff');
    component.setActiveInspectorTab('audit-log');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Nguyễn Văn An');
    expect(text).toContain('Đã vô hiệu hoá');
    expect(text).toContain('Nghỉ dự án');
    expect(text).toContain('Kích hoạt lại');
    expect(text).not.toContain('Membership created by');
  });

  it('shows submit logs in the activity tab from approval queue data', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.setActiveInspectorTab('activity');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Hoạt động nghiệp vụ của thành viên');
    expect(text).toContain('Đã gửi chứng từ');
    expect(text).toContain('BÁCH HÓA XANH');
    expect(text).toContain('187.954 VND');
    expect(text).toContain('Chờ duyệt');
    expect(text).not.toContain('Tóm tắt trạng thái vận hành hiện tại');
    expect(text).not.toContain('Nhật ký dưới đây lấy từ các field lifecycle');
  });

  it('keeps lifecycle events in the audit log tab only', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.setActiveInspectorTab('audit-log');
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Nhật ký dưới đây lấy từ các field lifecycle');
    expect(text).toContain('Đã tham gia workspace');
  });

  it('uses MagicPath invite modal controls and submits through the real GraphQL service', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.openInviteModal();
    fixture.detectChanges();

    let text = fixture.nativeElement.textContent;
    expect(text).toContain('Mời thành viên mới');
    expect(text).toContain('Địa chỉ email');
    expect(text).toContain('Vai trò');
    expect(text).toContain('Phòng ban');
    expect(text).toContain('Tenant Admin');
    expect(text).toContain('Manager');
    expect(text).not.toContain('Guest');
    expect(text).toContain('Mặc định');
    expect(text).toContain('Liên kết dùng một lần');

    component.updateInviteEmail('new.staff@meridian.test');
    component.updateInviteRole('STAFF');
    component.updateInviteDepartment('department-ops');
    component.submitInviteMember();
    fixture.detectChanges();

    expect(membersApi.inviteMember).toHaveBeenCalledWith({
      email: 'new.staff@meridian.test',
      role: 'STAFF',
      departmentId: 'department-ops',
    });
    text = fixture.nativeElement.textContent;
    expect(text).not.toContain('new.staff@workspace.local');
  });

  it('shows success feedback after a member invitation is sent', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.openInviteModal();
    component.updateInviteEmail('new.staff@meridian.test');
    component.updateInviteRole('STAFF');
    component.updateInviteDepartment('department-ops');
    component.submitInviteMember();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent;
    const toast = fixture.nativeElement.querySelector('.operation-toast') as HTMLElement | null;
    expect(text).toContain('Đã gửi lời mời');
    expect(text).toContain('new.staff@meridian.test');
    expect(toast).not.toBeNull();
    expect(toast?.classList.contains('operation-toast--invite')).toBe(true);
  });

  it('revokes a pending invitation from the invitation action button', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.setActiveTab('invitations');
    fixture.detectChanges();

    const revokeButton = fixture.nativeElement.querySelector(
      '[data-testid="invitation-action-invitation-1"]',
    ) as HTMLButtonElement | null;

    expect(revokeButton).not.toBeNull();
    revokeButton?.click();
    fixture.detectChanges();

    expect(membersApi.revokeInvitation).toHaveBeenCalledWith('tenant-1', 'invitation-1');
    expect(fixture.nativeElement.textContent).toContain('Đã thu hồi lời mời');
    expect(
      (fixture.nativeElement.querySelector('.operation-toast') as HTMLElement | null)?.classList.contains(
        'operation-toast--revoke',
      ),
    ).toBe(true);
  });
});
