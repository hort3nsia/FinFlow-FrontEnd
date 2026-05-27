import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-base-url.token';

interface GraphQlError {
  message: string;
}

interface GraphQlResponse<TData> {
  data?: TData;
  errors?: GraphQlError[];
}

export interface WorkspaceMemberResponse {
  id: string;
  accountId: string;
  tenantId: string;
  departmentId: string | null;
  fullName: string | null;
  email: string | null;
  departmentName: string | null;
  role: string;
  isOwner: boolean;
  isActive: boolean;
  createdAt: string;
  lastActiveAt: string | null;
  deactivatedAt: string | null;
  deactivatedBy: string | null;
  deactivatedReason: string | null;
}

export interface DepartmentSummaryResponse {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
}

export interface InvitationResponse {
  id: string;
  email: string;
  tenantId: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  revokedByMembershipId: string | null;
  isPending: boolean;
  isExpired: boolean;
}

export interface InviteMemberInput {
  email: string;
  role: string;
  departmentId: string;
}

export interface InviteMemberResponse {
  invitationId: string;
  inviteToken: string;
  email: string;
  role: string;
  idTenant: string;
  expiresAt: string;
}

export interface MemberMutationResponse {
  success: boolean;
  message: string | null;
}

interface WorkspaceMembersQueryResponse {
  workspaceMembers: WorkspaceMemberResponse[];
}

interface DepartmentsQueryResponse {
  departments: DepartmentSummaryResponse[];
}

interface InvitationsQueryResponse {
  invitations: InvitationResponse[];
}

interface MemberQueryResponse {
  member: WorkspaceMemberResponse | null;
}

interface InviteMemberMutationResponse {
  inviteMember: InviteMemberResponse;
}

interface ChangeMemberRoleMutationResponse {
  changeMemberRole: MemberMutationResponse;
}

interface RemoveMemberMutationResponse {
  removeMember: MemberMutationResponse;
}

interface ReactivateMemberMutationResponse {
  reactivateMember: MemberMutationResponse;
}

interface ResendInvitationMutationResponse {
  resendInvitation: MemberMutationResponse;
}

interface RevokeInvitationMutationResponse {
  revokeInvitation: MemberMutationResponse;
}

const WORKSPACE_MEMBERS_QUERY = `
  query WorkspaceMembers($tenantId: UUID!, $departmentId: UUID) {
    workspaceMembers(tenantId: $tenantId, departmentId: $departmentId) {
      id
      accountId
      tenantId
      departmentId
      fullName
      email
      departmentName
      role
      isOwner
      isActive
      createdAt
      lastActiveAt
      deactivatedAt
      deactivatedBy
      deactivatedReason
    }
  }
`;

const DEPARTMENTS_QUERY = `
  query Departments {
    departments {
      id
      name
      parentId
      isActive
    }
  }
`;

const INVITATIONS_QUERY = `
  query Invitations($tenantId: UUID!) {
    invitations(tenantId: $tenantId) {
      id
      email
      tenantId
      role
      expiresAt
      createdAt
      acceptedAt
      revokedAt
      revokedByMembershipId
      isPending
      isExpired
    }
  }
`;

const MEMBER_QUERY = `
  query Member($membershipId: UUID!, $tenantId: UUID!) {
    member(membershipId: $membershipId, tenantId: $tenantId) {
      id
      accountId
      tenantId
      departmentId
      fullName
      email
      departmentName
      role
      isOwner
      isActive
      createdAt
      lastActiveAt
      deactivatedAt
      deactivatedBy
      deactivatedReason
    }
  }
`;

const INVITE_MEMBER_MUTATION = `
  mutation InviteMember($input: InviteMemberInput!) {
    inviteMember(input: $input) {
      invitationId
      inviteToken
      email
      role
      idTenant
      expiresAt
    }
  }
`;

const CHANGE_MEMBER_ROLE_MUTATION = `
  mutation ChangeMemberRole($tenantId: UUID!, $input: ChangeMemberRoleInput!) {
    changeMemberRole(tenantId: $tenantId, input: $input) {
      success
      message
    }
  }
`;

const REMOVE_MEMBER_MUTATION = `
  mutation RemoveMember($tenantId: UUID!, $input: RemoveMemberInput!) {
    removeMember(tenantId: $tenantId, input: $input) {
      success
      message
    }
  }
`;

const REACTIVATE_MEMBER_MUTATION = `
  mutation ReactivateMember($tenantId: UUID!, $membershipId: UUID!) {
    reactivateMember(tenantId: $tenantId, membershipId: $membershipId) {
      success
      message
    }
  }
`;

const RESEND_INVITATION_MUTATION = `
  mutation ResendInvitation($tenantId: UUID!, $input: ResendInvitationInput!) {
    resendInvitation(tenantId: $tenantId, input: $input) {
      success
      message
    }
  }
`;

const REVOKE_INVITATION_MUTATION = `
  mutation RevokeInvitation($tenantId: UUID!, $input: RevokeInvitationInput!) {
    revokeInvitation(tenantId: $tenantId, input: $input) {
      success
      message
    }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null => errors?.[0]?.message ?? null;

@Injectable({
  providedIn: 'root',
})
export class MembersApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(API_BASE_URL);

  private extractData<TData>(response: GraphQlResponse<TData>, missingMessage: string): TData {
    const graphQlMessage = extractGraphQlMessage(response.errors);
    if (graphQlMessage) {
      throw new Error(graphQlMessage);
    }

    if (!response.data) {
      throw new Error(missingMessage);
    }

    return response.data;
  }

  private mapTransportError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const graphQlMessage = extractGraphQlMessage(error.error?.errors);
      return throwError(
        () => new Error(graphQlMessage ?? error.message ?? 'Unable to complete the request.'),
      );
    }

    if (error instanceof Error) {
      return throwError(() => error);
    }

    return throwError(() => new Error('Unable to complete the request.'));
  }

  getWorkspaceMembers(
    tenantId: string,
    departmentId: string | null = null,
  ): Observable<WorkspaceMemberResponse[]> {
    return this.http
      .post<GraphQlResponse<WorkspaceMembersQueryResponse>>(this.endpoint, {
        query: WORKSPACE_MEMBERS_QUERY,
        variables: {
          tenantId,
          departmentId,
        },
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'WorkspaceMembers query did not include membership data.',
          ).workspaceMembers,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getDepartments(): Observable<DepartmentSummaryResponse[]> {
    return this.http
      .post<GraphQlResponse<DepartmentsQueryResponse>>(this.endpoint, {
        query: DEPARTMENTS_QUERY,
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'Departments query did not include department data.')
            .departments,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getInvitations(tenantId: string): Observable<InvitationResponse[]> {
    return this.http
      .post<GraphQlResponse<InvitationsQueryResponse>>(this.endpoint, {
        query: INVITATIONS_QUERY,
        variables: {
          tenantId,
        },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'Invitations query did not include invitation data.')
            .invitations,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getMember(membershipId: string, tenantId: string): Observable<WorkspaceMemberResponse> {
    return this.http
      .post<GraphQlResponse<MemberQueryResponse>>(this.endpoint, {
        query: MEMBER_QUERY,
        variables: {
          membershipId,
          tenantId,
        },
      })
      .pipe(
        map((response) => {
          const member = this.extractData(
            response,
            'Member query did not include member detail.',
          ).member;

          if (!member) {
            throw new Error('Member detail was not found.');
          }

          return member;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  inviteMember(input: InviteMemberInput): Observable<InviteMemberResponse> {
    return this.http
      .post<GraphQlResponse<InviteMemberMutationResponse>>(this.endpoint, {
        query: INVITE_MEMBER_MUTATION,
        variables: {
          input,
        },
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'InviteMember mutation did not include invitation data.',
          ).inviteMember,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  changeMemberRole(
    tenantId: string,
    membershipId: string,
    newRole: string,
  ): Observable<MemberMutationResponse> {
    return this.http
      .post<GraphQlResponse<ChangeMemberRoleMutationResponse>>(this.endpoint, {
        query: CHANGE_MEMBER_ROLE_MUTATION,
        variables: {
          tenantId,
          input: {
            membershipId,
            newRole,
          },
        },
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'ChangeMemberRole mutation did not include result data.',
          ).changeMemberRole,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  removeMember(
    tenantId: string,
    membershipId: string,
    reason: string | null = null,
  ): Observable<MemberMutationResponse> {
    return this.http
      .post<GraphQlResponse<RemoveMemberMutationResponse>>(this.endpoint, {
        query: REMOVE_MEMBER_MUTATION,
        variables: {
          tenantId,
          input: {
            membershipId,
            reason,
          },
        },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'RemoveMember mutation did not include result data.')
            .removeMember,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  reactivateMember(tenantId: string, membershipId: string): Observable<MemberMutationResponse> {
    return this.http
      .post<GraphQlResponse<ReactivateMemberMutationResponse>>(this.endpoint, {
        query: REACTIVATE_MEMBER_MUTATION,
        variables: {
          tenantId,
          membershipId,
        },
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'ReactivateMember mutation did not include result data.',
          ).reactivateMember,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  resendInvitation(tenantId: string, invitationId: string): Observable<MemberMutationResponse> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    return this.http
      .post<GraphQlResponse<ResendInvitationMutationResponse>>(this.endpoint, {
        query: RESEND_INVITATION_MUTATION,
        variables: {
          tenantId,
          input: {
            invitationId,
            newExpiresAt: expiresAt.toISOString(),
            newToken: this.createInviteToken(),
          },
        },
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'ResendInvitation mutation did not include result data.',
          ).resendInvitation,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  revokeInvitation(tenantId: string, invitationId: string): Observable<MemberMutationResponse> {
    return this.http
      .post<GraphQlResponse<RevokeInvitationMutationResponse>>(this.endpoint, {
        query: REVOKE_INVITATION_MUTATION,
        variables: {
          tenantId,
          input: {
            invitationId,
          },
        },
      })
      .pipe(
        map((response) =>
          this.extractData(
            response,
            'RevokeInvitation mutation did not include result data.',
          ).revokeInvitation,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  private createInviteToken(): string {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
}
