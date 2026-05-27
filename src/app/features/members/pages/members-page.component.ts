import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostListener,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { catchError, forkJoin, of, switchMap } from 'rxjs';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import {
  ApprovalsApiService,
  PendingApprovalItemResponse,
} from '../../approvals/data/approvals-api.service';
import {
  DepartmentSummaryResponse,
  InviteMemberInput,
  InvitationResponse,
  MembersApiService,
  WorkspaceMemberResponse,
} from '../data/members-api.service';

type MembersTabId = 'members' | 'invitations';
type MemberStatusFilter = 'all' | 'active' | 'inactive';
type MemberInspectorTabId = 'identity' | 'access' | 'activity' | 'audit-log';
type InviteRoleValue = 'TENANT_ADMIN' | 'MANAGER' | 'ACCOUNTANT' | 'STAFF';
type OperationNoticeKind = 'invite' | 'revoke' | 'resend';

interface MembersTab {
  id: MembersTabId;
  label: string;
}

interface MembersKpi {
  id: 'total' | 'active' | 'pending' | 'inactive';
  label: string;
  value: string;
  tone: 'neutral' | 'success' | 'warning' | 'muted';
}

interface MemberInspectorTab {
  id: MemberInspectorTabId;
  label: string;
}

interface InviteRoleOption {
  value: InviteRoleValue;
  label: string;
  description: string;
}

interface MemberRow {
  id: string;
  name: string;
  email: string;
  roleLabel: string;
  roleValue: string;
  departmentId: string | null;
  departmentName: string;
  typeLabel: 'Owner' | 'Member';
  statusLabel: 'Active' | 'Inactive';
  statusValue: 'active' | 'inactive';
  initials: string;
  isCurrentUser: boolean;
  joinedLabel: string;
  lastActiveLabel: string;
  actionLabel: string;
  detailSnapshot: WorkspaceMemberResponse;
}

interface MemberTimelineItem {
  id: string;
  title: string;
  meta: string;
  detail: string | null;
  tone: 'blue' | 'green' | 'red' | 'slate';
}

interface MemberBusinessActivityItem {
  id: string;
  title: string;
  meta: string;
  detail: string;
  tone: 'blue' | 'green' | 'red' | 'slate';
}

interface PermissionRow {
  id: string;
  label: string;
  allowed: boolean;
  note: string;
}

interface InvitationRow {
  id: string;
  email: string;
  roleLabel: string;
  roleValue: string;
  createdLabel: string;
  expiresLabel: string;
  statusLabel: 'Pending' | 'Expired' | 'Revoked' | 'Accepted';
  actionType: 'revoke' | 'resend' | 'view';
  actionLabel: string;
}

@Component({
  selector: 'app-members-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './members-page.component.html',
  styleUrl: './members-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MembersPageComponent {
  private readonly membersApi = inject(MembersApiService);
  private readonly approvalsApi = inject(ApprovalsApiService);
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly pageCopy = 'Kiểm soát quyền truy cập, vai trò và lời mời đang chờ xử lý trong workspace.';
  protected readonly workspaceState = this.currentWorkspaceFacade.state;
  protected readonly isLoading = signal(true);
  private readonly hasLoadedTenantId = signal<string | null>(null);
  private readonly memberRowsSignal = signal<MemberRow[]>([]);
  private readonly invitationRowsSignal = signal<InvitationRow[]>([]);
  private readonly approvalActivityItemsSignal = signal<PendingApprovalItemResponse[]>([]);
  private readonly departmentsSignal = signal<DepartmentSummaryResponse[]>([]);
  private readonly loadErrorSignal = signal<string | null>(null);
  protected readonly activeTab = signal<MembersTabId>('members');
  protected readonly searchQuery = signal('');
  protected readonly departmentFilter = signal('');
  protected readonly statusFilter = signal<MemberStatusFilter>('all');
  protected readonly roleFilter = signal('');
  protected readonly activeInspectorTab = signal<MemberInspectorTabId>('identity');
  protected readonly isInviteModalOpen = signal(false);
  protected readonly inviteEmail = signal('');
  protected readonly inviteRole = signal<InviteRoleValue>('STAFF');
  protected readonly inviteDepartmentId = signal('');
  protected readonly inviteSubmitError = signal<string | null>(null);
  protected readonly inviteSubmitting = signal(false);
  protected readonly operationNoticeKind = signal<OperationNoticeKind>('invite');
  protected readonly operationNoticeTitle = signal<string | null>(null);
  protected readonly operationNotice = signal<string | null>(null);
  protected readonly invitationActionSubmitting = signal<string | null>(null);
  protected readonly invitationActionError = signal<string | null>(null);
  protected readonly memberActionError = signal<string | null>(null);
  protected readonly memberActionSubmitting = signal(false);
  protected readonly isChangeRoleModalOpen = signal(false);
  protected readonly changeRoleValue = signal<InviteRoleValue>('STAFF');
  protected readonly isDeactivateModalOpen = signal(false);
  protected readonly deactivateReason = signal('');
  private readonly selectedMemberIdSignal = signal<string | null>(null);
  private readonly selectedMemberDetailSignal = signal<WorkspaceMemberResponse | null>(null);
  private readonly openMemberActionMenuIdSignal = signal<string | null>(null);
  private readonly memberDetailLoadingSignal = signal(false);
  private readonly memberDetailErrorSignal = signal<string | null>(null);
  private readonly currentTenantIdSignal = signal<string | null>(null);
  private readonly currentMembershipIdSignal = signal<string | null>(null);
  private readonly memberDetailCache = new Map<string, WorkspaceMemberResponse>();

  protected readonly loadError = computed(() => this.loadErrorSignal());
  protected readonly memberRows = computed(() => this.memberRowsSignal());
  protected readonly invitationRows = computed(() => this.invitationRowsSignal());
  protected readonly departments = computed(() => this.departmentsSignal());
  protected readonly inspectorTabs = computed<MemberInspectorTab[]>(() => [
    { id: 'identity', label: 'Danh tính' },
    { id: 'access', label: 'Quyền hạn' },
    { id: 'activity', label: 'Hoạt động' },
    { id: 'audit-log', label: 'Nhật ký' },
  ]);
  protected readonly inviteRoleOptions = computed<InviteRoleOption[]>(() => [
    {
      value: 'TENANT_ADMIN',
      label: 'Tenant Admin',
      description: 'Toàn quyền workspace, quản lý thành viên, cấu hình và phê duyệt.',
    },
    {
      value: 'MANAGER',
      label: 'Manager',
      description: 'Quản lý luồng xử lý, rà soát yêu cầu và theo dõi phòng ban.',
    },
    {
      value: 'ACCOUNTANT',
      label: 'Accountant',
      description: 'Xử lý nghiệp vụ tài chính, thanh toán và dữ liệu kế toán.',
    },
    {
      value: 'STAFF',
      label: 'Staff',
      description: 'Tạo bản nháp, gửi khoản chi và theo dõi yêu cầu cá nhân.',
    },
  ]);
  protected readonly tabs = computed<MembersTab[]>(() => [
    { id: 'members', label: `Thành viên ${this.memberRows().length}` },
    { id: 'invitations', label: `Lời mời ${this.invitationRows().length}` },
  ]);
  protected readonly kpis = computed<MembersKpi[]>(() => [
    { id: 'total', label: 'Tổng thành viên', value: String(this.memberRows().length), tone: 'neutral' },
    {
      id: 'active',
      label: 'Đang hoạt động',
      value: String(this.memberRows().filter((row) => row.statusValue === 'active').length),
      tone: 'success',
    },
    {
      id: 'pending',
      label: 'Lời mời chờ',
      value: String(this.invitationRows().filter((row) => row.statusLabel === 'Pending').length),
      tone: 'warning',
    },
    {
      id: 'inactive',
      label: 'Vô hiệu hoá',
      value: String(this.memberRows().filter((row) => row.statusValue === 'inactive').length),
      tone: 'muted',
    },
  ]);
  protected readonly roleOptions = computed(() =>
    Array.from(new Set(this.memberRows().map((row) => row.roleValue))).sort(),
  );
  protected readonly visibleMemberRows = computed(() => {
    const searchQuery = this.searchQuery().trim().toLowerCase();
    const departmentFilter = this.departmentFilter();
    const statusFilter = this.statusFilter();
    const roleFilter = this.roleFilter();

    return this.memberRows().filter((row) => {
      const matchesSearch =
        !searchQuery ||
        row.name.toLowerCase().includes(searchQuery) ||
        row.email.toLowerCase().includes(searchQuery) ||
        row.roleLabel.toLowerCase().includes(searchQuery);
      const matchesDepartment = !departmentFilter || row.departmentId === departmentFilter;
      const matchesStatus = statusFilter === 'all' || row.statusValue === statusFilter;
      const matchesRole = !roleFilter || row.roleValue === roleFilter;

      return matchesSearch && matchesDepartment && matchesStatus && matchesRole;
    });
  });
  protected readonly visibleInvitationRows = computed(() => {
    const searchQuery = this.searchQuery().trim().toLowerCase();
    const roleFilter = this.roleFilter();

    return this.invitationRows().filter((row) => {
      const matchesSearch =
        !searchQuery ||
        row.email.toLowerCase().includes(searchQuery) ||
        row.roleLabel.toLowerCase().includes(searchQuery) ||
        row.statusLabel.toLowerCase().includes(searchQuery);
      const matchesRole = !roleFilter || row.roleValue === roleFilter;

      return matchesSearch && matchesRole;
    });
  });
  protected readonly emptyStateCopy = computed(() =>
    this.activeTab() === 'members'
      ? 'Không có thành viên nào khớp bộ lọc hiện tại.'
      : 'Không có lời mời nào khớp bộ lọc hiện tại.',
  );
  protected readonly inactiveCount = computed(
    () => this.memberRows().filter((row) => row.statusValue === 'inactive').length,
  );
  protected readonly resultsCountLabel = computed(() => {
    if (this.activeTab() === 'members') {
      return `${this.visibleMemberRows().length} / ${this.memberRows().length}`;
    }

    return `${this.visibleInvitationRows().length} / ${this.invitationRows().length}`;
  });
  protected readonly selectedMemberId = computed(() => this.selectedMemberIdSignal());
  protected readonly selectedMemberDetail = computed(() => this.selectedMemberDetailSignal());
  protected readonly openMemberActionMenuId = computed(() => this.openMemberActionMenuIdSignal());
  protected readonly selectedInviteRoleOption = computed(
    () =>
      this.inviteRoleOptions().find((role) => role.value === this.inviteRole()) ??
      this.inviteRoleOptions()[0],
  );
  protected readonly inviteFormValid = computed(() => {
    const email = this.inviteEmail().trim();
    const departmentId = this.inviteDepartmentId().trim();
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailPattern.test(email) && !!this.inviteRole() && !!departmentId;
  });
  protected readonly isMemberDetailLoading = computed(() => this.memberDetailLoadingSignal());
  protected readonly memberDetailError = computed(() => this.memberDetailErrorSignal());
  protected readonly hasMemberInspector = computed(() => {
    if (this.activeTab() !== 'members') {
      return false;
    }

    const selectedMemberId = this.selectedMemberId();
    if (!selectedMemberId) {
      return false;
    }

    return this.visibleMemberRows().some((row) => row.id === selectedMemberId);
  });
  protected readonly selectedMemberRow = computed(() => {
    const selectedMemberId = this.selectedMemberId();
    return this.visibleMemberRows().find((row) => row.id === selectedMemberId) ?? null;
  });
  protected readonly selectedMemberRoleLabel = computed(() => {
    const selectedMemberDetail = this.selectedMemberDetail();
    return selectedMemberDetail ? this.formatEnumLabel(selectedMemberDetail.role) : '';
  });
  protected readonly selectedMemberStatusLabel = computed(() => {
    const selectedMemberDetail = this.selectedMemberDetail();
    if (!selectedMemberDetail) {
      return '';
    }

    return selectedMemberDetail.isActive ? 'Active' : 'Inactive';
  });
  protected readonly selectedMemberTypeLabel = computed(() => {
    const selectedMemberDetail = this.selectedMemberDetail();
    if (!selectedMemberDetail) {
      return '';
    }

    return selectedMemberDetail.isOwner ? 'Owner' : 'Member';
  });
  protected readonly selectedMemberJoinedLabel = computed(() => {
    const selectedMemberDetail = this.selectedMemberDetail();
    return selectedMemberDetail ? this.formatDate(selectedMemberDetail.createdAt) : 'Không rõ';
  });
  protected readonly selectedMemberLastActiveLabel = computed(() => {
    const selectedMemberDetail = this.selectedMemberDetail();
    return selectedMemberDetail ? this.formatLastActive(selectedMemberDetail) : 'Không rõ';
  });
  protected readonly selectedMemberDepartmentLabel = computed(() => {
    const selectedMemberDetail = this.selectedMemberDetail();
    return selectedMemberDetail?.departmentName?.trim() || 'Chưa gán';
  });
  protected readonly selectedMemberProtectedNote = computed(() => {
    const selectedMemberDetail = this.selectedMemberDetail();
    const currentMembershipId = this.currentMembershipIdSignal();

    if (!selectedMemberDetail) {
      return '';
    }

    if (selectedMemberDetail.isOwner) {
      return 'Owner được bảo vệ. Cần chuyển quyền sở hữu trước khi thay đổi vai trò hoặc vô hiệu hoá.';
    }

    if (selectedMemberDetail.id === currentMembershipId) {
      return 'Tài khoản hiện tại được bảo vệ khỏi thao tác tự vô hiệu hoá.';
    }

    return 'Quyền được suy ra từ vai trò và dữ liệu thành viên thật trong workspace.';
  });
  protected readonly selectedMemberTimeline = computed<MemberTimelineItem[]>(() => {
    const member = this.selectedMemberDetail();
    if (!member) {
      return [];
    }

    const items: MemberTimelineItem[] = [
      {
        id: 'created',
        title: 'Đã tham gia workspace',
        meta: this.formatDateTime(member.createdAt),
        detail: `${this.formatEnumLabel(member.role)} · ${member.departmentName?.trim() || 'Chưa gán phòng ban'}`,
        tone: 'blue',
      },
    ];

    if (member.lastActiveAt) {
      items.unshift({
        id: 'last-active',
        title: 'Hoạt động gần nhất',
        meta: this.formatDateTime(member.lastActiveAt),
        detail: member.email,
        tone: 'green',
      });
    }

    if (member.deactivatedAt) {
      items.unshift({
        id: 'deactivated',
        title: 'Đã vô hiệu hoá',
        meta: this.formatDateTime(member.deactivatedAt),
        detail: member.deactivatedReason,
        tone: 'red',
      });
    }

    return items;
  });
  protected readonly selectedMemberBusinessActivities = computed<MemberBusinessActivityItem[]>(() => {
    const memberEmail = this.selectedMemberDetail()?.email?.trim().toLowerCase();
    if (!memberEmail) {
      return [];
    }

    return this.approvalActivityItemsSignal()
      .filter((item) => item.requesterEmail.trim().toLowerCase() === memberEmail)
      .sort((left, right) => right.submittedAt.localeCompare(left.submittedAt))
      .slice(0, 8)
      .map((item) => ({
        id: item.documentId,
        title: 'Đã gửi chứng từ',
        meta: this.formatDateTime(item.submittedAt),
        detail: `${item.title} · ${this.formatMoney(item.amount, item.currency)} · ${this.formatApprovalStatus(item.status)}`,
        tone: this.activityTone(item.status),
      }));
  });
  protected readonly selectedMemberPermissions = computed<PermissionRow[]>(() => {
    const role = this.selectedMemberDetail()?.role ?? '';
    const isAdmin = role === 'TENANT_ADMIN';
    const isManager = role === 'MANAGER';
    const isAccountant = role === 'ACCOUNTANT';
    const isStaff = role === 'STAFF';

    return [
      {
        id: 'documents-create',
        label: 'Tạo và gửi khoản chi',
        allowed: isAdmin || isManager || isAccountant || isStaff,
        note: 'Module Tài liệu',
      },
      {
        id: 'approvals-review',
        label: 'Duyệt yêu cầu',
        allowed: isAdmin || isManager,
        note: 'Vai trò quản lý',
      },
      {
        id: 'payments-manage',
        label: 'Xử lý thanh toán',
        allowed: isAdmin || isAccountant,
        note: 'Hàng đợi thanh toán',
      },
      {
        id: 'members-manage',
        label: 'Quản lý thành viên',
        allowed: isAdmin,
        note: 'Chỉ Tenant Admin',
      },
      {
        id: 'settings-manage',
        label: 'Cấu hình workspace',
        allowed: isAdmin,
        note: 'Quản trị hệ thống',
      },
    ];
  });

  constructor() {
    effect(() => {
      const workspace = this.workspaceState().workspace;
      if (!workspace?.tenantId || this.hasLoadedTenantId() === workspace.tenantId) {
        return;
      }

      this.hasLoadedTenantId.set(workspace.tenantId);
      this.loadWorkspaceMembers(workspace.tenantId, workspace.membershipId);
    });

    effect(() => {
      if (this.activeTab() !== 'members' || this.isLoading() || this.loadError()) {
        return;
      }

      const selectedMemberId = this.selectedMemberId();
      if (!selectedMemberId) {
        return;
      }

      const visibleMemberRows = this.visibleMemberRows();
      if (!visibleMemberRows.length || !visibleMemberRows.some((row) => row.id === selectedMemberId)) {
        this.clearSelectedMemberPanel();
      }
    });
  }

  protected setActiveTab(tabId: MembersTabId): void {
    this.closeMemberActionMenu();
    this.closeInviteModal();
    this.activeTab.set(tabId);
  }

  protected updateSearchQuery(value: string): void {
    this.searchQuery.set(value);
  }

  protected updateDepartmentFilter(value: string): void {
    this.departmentFilter.set(value);
  }

  protected updateStatusFilter(value: MemberStatusFilter): void {
    this.statusFilter.set(value);
  }

  protected updateRoleFilter(value: string): void {
    this.roleFilter.set(value);
  }

  protected setActiveInspectorTab(tabId: MemberInspectorTabId): void {
    this.activeInspectorTab.set(tabId);
  }

  protected selectMemberRow(memberId: string): void {
    const tenantId = this.currentTenantIdSignal();
    if (!tenantId) {
      return;
    }

    this.closeMemberActionMenu();

    if (this.selectedMemberId() === memberId && this.selectedMemberDetail()?.id === memberId) {
      return;
    }

    this.selectedMemberIdSignal.set(memberId);
    this.activeInspectorTab.set('identity');
    this.memberDetailErrorSignal.set(null);

    const fallbackMemberDetail =
      this.memberRows().find((row) => row.id === memberId)?.detailSnapshot ?? null;
    if (fallbackMemberDetail) {
      this.selectedMemberDetailSignal.set(fallbackMemberDetail);
      this.memberDetailLoadingSignal.set(false);
    }

    const cachedMemberDetail = this.memberDetailCache.get(memberId);
    if (cachedMemberDetail) {
      this.selectedMemberDetailSignal.set(cachedMemberDetail);
      this.memberDetailLoadingSignal.set(false);
      return;
    }

    if (!fallbackMemberDetail) {
      this.selectedMemberDetailSignal.set(null);
      this.memberDetailLoadingSignal.set(true);
    }

    this.membersApi
      .getMember(memberId, tenantId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (memberDetail) => {
          if (this.selectedMemberId() !== memberId) {
            return;
          }

          this.memberDetailCache.set(memberId, memberDetail);
          this.selectedMemberDetailSignal.set(memberDetail);
          this.memberDetailLoadingSignal.set(false);
        },
        error: (error: Error) => {
          if (this.selectedMemberId() !== memberId) {
            return;
          }

          this.memberDetailLoadingSignal.set(false);

          if (this.selectedMemberDetailSignal()) {
            return;
          }

          this.memberDetailErrorSignal.set(error.message);
        },
      });
  }

  protected retrySelectedMemberDetail(): void {
    const selectedMemberId = this.selectedMemberId();
    if (selectedMemberId) {
      this.memberDetailCache.delete(selectedMemberId);
      this.selectMemberRow(selectedMemberId);
    }
  }

  protected closeSelectedMemberPanel(): void {
    this.closeMemberActionMenu();
    this.clearSelectedMemberPanel();
  }

  protected openInviteModal(): void {
    this.closeMemberActionMenu();
    this.inviteSubmitError.set(null);
    this.isInviteModalOpen.set(true);
  }

  protected closeInviteModal(): void {
    this.isInviteModalOpen.set(false);
    this.inviteEmail.set('');
    this.inviteRole.set('STAFF');
    this.inviteDepartmentId.set('');
    this.inviteSubmitError.set(null);
    this.inviteSubmitting.set(false);
  }

  protected updateInviteEmail(value: string): void {
    this.inviteEmail.set(value);
    this.inviteSubmitError.set(null);
  }

  protected updateInviteRole(value: string): void {
    this.inviteRole.set(value as InviteRoleValue);
    this.inviteSubmitError.set(null);
  }

  protected updateInviteDepartment(value: string): void {
    this.inviteDepartmentId.set(value);
    this.inviteSubmitError.set(null);
  }

  protected submitInviteMember(): void {
    const tenantId = this.currentTenantIdSignal();
    if (!tenantId || !this.inviteFormValid() || this.inviteSubmitting()) {
      return;
    }

    const payload: InviteMemberInput = {
      email: this.inviteEmail().trim(),
      role: this.inviteRole(),
      departmentId: this.inviteDepartmentId(),
    };

    this.inviteSubmitting.set(true);
    this.inviteSubmitError.set(null);
    this.operationNoticeTitle.set(null);
    this.operationNotice.set(null);

    this.membersApi
      .inviteMember(payload)
      .pipe(
        switchMap(() => this.membersApi.getInvitations(tenantId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (invitations) => {
          this.invitationRowsSignal.set(this.mapInvitationRows(invitations));
          this.showOperationNotice('invite', 'Đã gửi lời mời', `Đã gửi lời mời tới ${payload.email}.`);
          this.closeInviteModal();
        },
        error: (error: Error) => {
          this.inviteSubmitting.set(false);
          this.inviteSubmitError.set(error.message);
        },
      });
  }

  protected handleInvitationAction(invitation: InvitationRow, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (invitation.actionType === 'revoke') {
      this.revokeInvitation(invitation);
      return;
    }

    if (invitation.actionType === 'resend') {
      this.resendInvitation(invitation);
    }
  }

  protected onMemberRowKeydown(event: KeyboardEvent, memberId: string): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.selectMemberRow(memberId);
    }
  }

  protected toggleMemberActionMenu(event: Event, memberId: string): void {
    event.preventDefault();
    event.stopPropagation();

    this.openMemberActionMenuIdSignal.set(
      this.openMemberActionMenuId() === memberId ? null : memberId,
    );
  }

  protected viewMemberDetailsFromMenu(event: Event, memberId: string): void {
    event.preventDefault();
    event.stopPropagation();

    this.closeMemberActionMenu();
    this.selectMemberRow(memberId);
  }

  protected handleMemberMenuPlaceholderAction(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    this.closeMemberActionMenu();
  }

  protected openChangeRoleModal(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const selectedMember = this.selectedMemberDetail();
    if (!selectedMember || selectedMember.isOwner || selectedMember.id === this.currentMembershipIdSignal()) {
      return;
    }

    this.memberActionError.set(null);
    this.changeRoleValue.set(selectedMember.role as InviteRoleValue);
    this.isChangeRoleModalOpen.set(true);
  }

  protected closeChangeRoleModal(): void {
    if (this.memberActionSubmitting()) {
      return;
    }

    this.isChangeRoleModalOpen.set(false);
    this.memberActionError.set(null);
  }

  protected updateChangeRoleValue(value: string): void {
    this.changeRoleValue.set(value as InviteRoleValue);
    this.memberActionError.set(null);
  }

  protected submitChangeRole(): void {
    const tenantId = this.currentTenantIdSignal();
    const membershipId = this.selectedMemberId();
    const currentMembershipId = this.currentMembershipIdSignal();

    if (!tenantId || !membershipId || !currentMembershipId || this.memberActionSubmitting()) {
      return;
    }

    this.memberActionSubmitting.set(true);
    this.memberActionError.set(null);

    this.membersApi
      .changeMemberRole(tenantId, membershipId, this.changeRoleValue())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isChangeRoleModalOpen.set(false);
          this.memberActionSubmitting.set(false);
          this.loadWorkspaceMembers(tenantId, currentMembershipId);
        },
        error: (error: Error) => {
          this.memberActionSubmitting.set(false);
          this.memberActionError.set(error.message);
        },
      });
  }

  protected openDeactivateModal(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const selectedMember = this.selectedMemberDetail();
    if (!selectedMember || selectedMember.isOwner || selectedMember.id === this.currentMembershipIdSignal()) {
      return;
    }

    this.memberActionError.set(null);
    this.deactivateReason.set('');
    this.isDeactivateModalOpen.set(true);
  }

  protected closeDeactivateModal(): void {
    if (this.memberActionSubmitting()) {
      return;
    }

    this.isDeactivateModalOpen.set(false);
    this.memberActionError.set(null);
  }

  protected updateDeactivateReason(value: string): void {
    this.deactivateReason.set(value);
    this.memberActionError.set(null);
  }

  protected submitDeactivateMember(): void {
    const tenantId = this.currentTenantIdSignal();
    const membershipId = this.selectedMemberId();
    const currentMembershipId = this.currentMembershipIdSignal();
    const reason = this.deactivateReason().trim();

    if (!tenantId || !membershipId || !currentMembershipId || !reason || this.memberActionSubmitting()) {
      return;
    }

    this.memberActionSubmitting.set(true);
    this.memberActionError.set(null);

    this.membersApi
      .removeMember(tenantId, membershipId, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.isDeactivateModalOpen.set(false);
          this.memberActionSubmitting.set(false);
          this.loadWorkspaceMembers(tenantId, currentMembershipId);
        },
        error: (error: Error) => {
          this.memberActionSubmitting.set(false);
          this.memberActionError.set(error.message);
        },
      });
  }

  protected reactivateSelectedMember(event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    const tenantId = this.currentTenantIdSignal();
    const membershipId = this.selectedMemberId();
    const currentMembershipId = this.currentMembershipIdSignal();

    if (!tenantId || !membershipId || !currentMembershipId || this.memberActionSubmitting()) {
      return;
    }

    this.memberActionSubmitting.set(true);
    this.memberActionError.set(null);

    this.membersApi
      .reactivateMember(tenantId, membershipId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.memberActionSubmitting.set(false);
          this.loadWorkspaceMembers(tenantId, currentMembershipId);
        },
        error: (error: Error) => {
          this.memberActionSubmitting.set(false);
          this.memberActionError.set(error.message);
        },
      });
  }

  protected keepMemberActionMenuOpen(event: Event): void {
    event.stopPropagation();
  }

  protected stopEventPropagation(event: Event): void {
    event.stopPropagation();
  }

  protected dismissOperationNotice(): void {
    this.operationNoticeKind.set('invite');
    this.operationNoticeTitle.set(null);
    this.operationNotice.set(null);
  }

  @HostListener('document:click')
  protected onDocumentClick(): void {
    this.closeMemberActionMenu();
  }

  @HostListener('document:keydown.escape')
  protected onDocumentEscape(): void {
    this.closeMemberActionMenu();
    if (this.isInviteModalOpen()) {
      this.closeInviteModal();
    }
    if (this.isChangeRoleModalOpen()) {
      this.closeChangeRoleModal();
    }
    if (this.isDeactivateModalOpen()) {
      this.closeDeactivateModal();
    }
  }

  private loadWorkspaceMembers(tenantId: string, currentMembershipId: string): void {
    this.isLoading.set(true);
    this.loadErrorSignal.set(null);
    this.currentTenantIdSignal.set(tenantId);
    this.currentMembershipIdSignal.set(currentMembershipId);
    this.selectedMemberIdSignal.set(null);
    this.selectedMemberDetailSignal.set(null);
    this.closeInviteModal();
    this.memberDetailErrorSignal.set(null);
    this.memberDetailLoadingSignal.set(false);
    this.memberDetailCache.clear();

    forkJoin({
      members: this.membersApi.getWorkspaceMembers(tenantId),
      departments: this.membersApi.getDepartments(),
      invitations: this.membersApi.getInvitations(tenantId),
      approvals: this.approvalsApi.getApprovalQueue('ALL', null, 1, 100).pipe(
        catchError(() =>
          of({
            items: [],
            page: 1,
            pageSize: 100,
            totalCount: 0,
            totalPages: 1,
          }),
        ),
      ),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ members, departments, invitations, approvals }) => {
          this.departmentsSignal.set(departments.filter((department) => department.isActive));
          const memberRows = this.mapMemberRows(members, currentMembershipId);
          this.memberRowsSignal.set(memberRows);
          this.invitationRowsSignal.set(this.mapInvitationRows(invitations));
          this.approvalActivityItemsSignal.set(approvals.items);
          this.isLoading.set(false);
          if (memberRows.length) {
            this.selectMemberRow(memberRows[0].id);
          }
        },
        error: (error: Error) => {
          this.memberRowsSignal.set([]);
          this.invitationRowsSignal.set([]);
          this.approvalActivityItemsSignal.set([]);
          this.departmentsSignal.set([]);
          this.selectedMemberIdSignal.set(null);
          this.selectedMemberDetailSignal.set(null);
          this.memberDetailErrorSignal.set(null);
          this.memberDetailLoadingSignal.set(false);
          this.loadErrorSignal.set(error.message);
          this.isLoading.set(false);
        },
      });
  }

  private clearSelectedMemberPanel(): void {
    this.selectedMemberIdSignal.set(null);
    this.selectedMemberDetailSignal.set(null);
    this.memberDetailErrorSignal.set(null);
    this.memberDetailLoadingSignal.set(false);
    this.activeInspectorTab.set('identity');
    this.memberActionError.set(null);
    this.isChangeRoleModalOpen.set(false);
    this.isDeactivateModalOpen.set(false);
  }

  private closeMemberActionMenu(): void {
    this.openMemberActionMenuIdSignal.set(null);
  }

  private mapMemberRows(
    members: WorkspaceMemberResponse[],
    currentMembershipId: string,
  ): MemberRow[] {
    return members.map((member) => {
      const email = member.email?.trim() || 'Chưa có email';
      const departmentName = member.departmentName?.trim() || 'Chưa gán';

      return {
        id: member.id,
        name: member.fullName?.trim() || this.formatDisplayName(email, member.id),
        email,
        roleLabel: this.formatEnumLabel(member.role),
        roleValue: member.role,
        departmentId: member.departmentId,
        departmentName,
        typeLabel: member.isOwner ? 'Owner' : 'Member',
        statusLabel: member.isActive ? 'Active' : 'Inactive',
        statusValue: member.isActive ? 'active' : 'inactive',
        initials: this.formatInitials(member.fullName?.trim() || email),
        isCurrentUser: member.id === currentMembershipId,
        joinedLabel: this.formatDate(member.createdAt),
        lastActiveLabel: this.formatLastActive(member),
        actionLabel: member.isOwner || member.id === currentMembershipId ? 'Được bảo vệ' : 'Quản lý',
        detailSnapshot: member,
      };
    });
  }

  private mapInvitationRows(invitations: InvitationResponse[]): InvitationRow[] {
    return invitations.map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      roleLabel: this.formatEnumLabel(invitation.role),
      roleValue: invitation.role,
      createdLabel: this.formatDate(invitation.createdAt),
      expiresLabel: this.formatDate(invitation.expiresAt),
      statusLabel: invitation.acceptedAt
        ? 'Accepted'
        : invitation.revokedAt
          ? 'Revoked'
          : invitation.isPending
            ? 'Pending'
            : invitation.isExpired
              ? 'Expired'
              : 'Pending',
      actionType: invitation.isPending ? 'revoke' : invitation.isExpired ? 'resend' : 'view',
      actionLabel: invitation.isPending ? 'Thu hồi' : invitation.isExpired ? 'Gửi lại' : 'Xem',
    }));
  }

  private revokeInvitation(invitation: InvitationRow): void {
    const tenantId = this.currentTenantIdSignal();
    if (!tenantId || this.invitationActionSubmitting()) {
      return;
    }

    this.invitationActionSubmitting.set(invitation.id);
    this.invitationActionError.set(null);
    this.operationNoticeTitle.set(null);
    this.operationNotice.set(null);

    this.membersApi
      .revokeInvitation(tenantId, invitation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.invitationRowsSignal.update((rows) => rows.filter((row) => row.id !== invitation.id));
          this.invitationActionSubmitting.set(null);
          this.showOperationNotice(
            'revoke',
            'Đã thu hồi lời mời',
            `Đã thu hồi lời mời tới ${invitation.email}.`,
          );
        },
        error: (error: Error) => {
          this.invitationActionSubmitting.set(null);
          this.invitationActionError.set(error.message);
        },
      });
  }

  private resendInvitation(invitation: InvitationRow): void {
    const tenantId = this.currentTenantIdSignal();
    if (!tenantId || this.invitationActionSubmitting()) {
      return;
    }

    this.invitationActionSubmitting.set(invitation.id);
    this.invitationActionError.set(null);
    this.operationNoticeTitle.set(null);
    this.operationNotice.set(null);

    this.membersApi
      .resendInvitation(tenantId, invitation.id)
      .pipe(switchMap(() => this.membersApi.getInvitations(tenantId)), takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (invitations) => {
          this.invitationRowsSignal.set(this.mapInvitationRows(invitations));
          this.invitationActionSubmitting.set(null);
          this.showOperationNotice(
            'resend',
            'Đã gửi lại lời mời',
            `Đã gửi lại lời mời tới ${invitation.email}.`,
          );
        },
        error: (error: Error) => {
          this.invitationActionSubmitting.set(null);
          this.invitationActionError.set(error.message);
        },
      });
  }

  private showOperationNotice(kind: OperationNoticeKind, title: string, message: string): void {
    this.operationNoticeKind.set(kind);
    this.operationNoticeTitle.set(title);
    this.operationNotice.set(message);
  }

  private formatDisplayName(email: string, membershipId: string): string {
    const localPart = email.split('@')[0]?.trim();
    if (!localPart) {
      return `Member ${membershipId.slice(0, 8)}`;
    }

    return localPart
      .split(/[._-]+/)
      .filter(Boolean)
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ');
  }

  private formatEnumLabel(value: string): string {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join(' ');
  }

  private formatLastActive(member: WorkspaceMemberResponse): string {
    if (member.lastActiveAt) {
      return this.formatDate(member.lastActiveAt);
    }

    if (!member.isActive && member.deactivatedAt) {
      return this.formatDate(member.deactivatedAt);
    }

    return member.isActive ? 'Chưa có dữ liệu' : 'Vô hiệu';
  }

  private formatDate(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Không rõ';
    }

    return parsed.toLocaleDateString('vi-VN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  private formatDateTime(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return 'Không rõ thời gian';
    }

    return parsed.toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatMoney(value: number, currency: string): string {
    const formatted = new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: currency === 'VND' ? 0 : 2,
    }).format(value);
    return `${formatted} ${currency}`;
  }

  private formatApprovalStatus(status: string): string {
    const normalized = status.replace(/[\s_-]+/g, '').toLowerCase();
    if (normalized.includes('readyforapproval') || normalized.includes('pending')) {
      return 'Chờ duyệt';
    }
    if (normalized.includes('approved')) return 'Đã duyệt';
    if (normalized.includes('rejected')) return 'Từ chối';
    return status || 'Không rõ trạng thái';
  }

  private activityTone(status: string): MemberBusinessActivityItem['tone'] {
    const normalized = status.replace(/[\s_-]+/g, '').toLowerCase();
    if (normalized.includes('approved')) return 'green';
    if (normalized.includes('rejected')) return 'red';
    if (normalized.includes('pending') || normalized.includes('readyforapproval')) return 'blue';
    return 'slate';
  }

  private formatInitials(value: string): string {
    const parts = value
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2);

    if (!parts.length) {
      return 'MB';
    }

    return parts.map((part) => part.charAt(0).toUpperCase()).join('');
  }
}
