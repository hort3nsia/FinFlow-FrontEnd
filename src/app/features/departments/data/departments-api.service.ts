import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, defer, map, Observable, switchMap, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { isAuthInvalidMessage } from '../../../core/auth/auth-error.utils';
import { API_BASE_URL } from '../../../core/config/api-base-url.token';

interface GraphQlError {
  message: string;
}

interface GraphQlResponse<TData> {
  data?: TData;
  errors?: GraphQlError[];
}

export interface DepartmentSummaryResponse {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
}

export interface DepartmentTreeNodeResponse {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
  memberCount: number;
  childCount: number;
  budgetUtilizationPct: number | null;
  children: DepartmentTreeNodeResponse[];
}

export type DepartmentWorkspaceTreeNodeResponse = DepartmentTreeNodeResponse;

export interface DepartmentWorkspaceSummaryResponse {
  totalDepartments: number;
  totalMembers: number;
  activeDepartments: number;
  selectedDepartmentId: string | null;
}

export interface DepartmentWorkspaceManagerResponse {
  membershipId: string;
  fullName: string;
  email: string;
  role: string;
  initials: string;
}

export interface DepartmentWorkspaceBudgetSnapshotResponse {
  periodLabel: string;
  allocatedAmount: number;
  spentAmount: number;
  remainingAmount: number;
  utilizationPct: number;
}

export interface DepartmentWorkspaceSubDepartmentResponse {
  id: string;
  name: string;
  memberCount: number;
  budgetUtilizationPct: number | null;
}

export interface DepartmentWorkspaceMemberPreviewResponse {
  membershipId: string;
  fullName: string;
  email: string;
  role: string;
  initials: string;
  isActive: boolean;
}

export interface DepartmentWorkspaceActivityResponse {
  id: string;
  title: string;
  description: string;
  actorName: string;
  tone: string;
  amount: number | null;
}

export interface DepartmentWorkspaceSelectedDepartmentResponse {
  id: string;
  name: string;
  parentName: string | null;
  departmentCode: string | null;
  status: string;
  createdAt: string;
  memberCount: number;
  subDepartmentCount: number;
  expenseVolumeAmount: number | null;
  expenseCount: number | null;
  manager: DepartmentWorkspaceManagerResponse | null;
  budgetSnapshot: DepartmentWorkspaceBudgetSnapshotResponse | null;
  subDepartments: DepartmentWorkspaceSubDepartmentResponse[];
  membersPreview: DepartmentWorkspaceMemberPreviewResponse[];
  recentActivity: DepartmentWorkspaceActivityResponse[];
}

export interface DepartmentWorkspaceResponse {
  summary: DepartmentWorkspaceSummaryResponse;
  tree: DepartmentTreeNodeResponse[];
  selectedDepartment: DepartmentWorkspaceSelectedDepartmentResponse | null;
}

export interface DepartmentMutationPayloadResponse {
  id: string;
  name: string;
  parentId: string | null;
  isActive: boolean;
}

interface DepartmentWorkspaceQueryResponse {
  departmentWorkspace: DepartmentWorkspaceResponse;
}

interface CreateDepartmentMutationResponse {
  createDepartment: DepartmentMutationPayloadResponse;
}

interface RenameDepartmentMutationResponse {
  renameDepartment: DepartmentMutationPayloadResponse;
}

interface DeactivateDepartmentMutationResponse {
  deactivateDepartment: boolean;
}

interface ActivateDepartmentMutationResponse {
  activateDepartment: DepartmentMutationPayloadResponse;
}

const DEPARTMENT_WORKSPACE_QUERY = `
  query DepartmentWorkspace($selectedDepartmentId: UUID) {
    departmentWorkspace(selectedDepartmentId: $selectedDepartmentId) {
      summary {
        totalDepartments
        totalMembers
        activeDepartments
        selectedDepartmentId
      }
      tree {
        id
        name
        parentId
        isActive
        memberCount
        childCount
        budgetUtilizationPct
        children {
          id
          name
          parentId
          isActive
          memberCount
          childCount
          budgetUtilizationPct
          children {
            id
            name
            parentId
            isActive
            memberCount
            childCount
            budgetUtilizationPct
            children {
              id
              name
              parentId
              isActive
              memberCount
              childCount
              budgetUtilizationPct
            }
          }
        }
      }
      selectedDepartment {
        id
        name
        parentName
        departmentCode
        status
        createdAt
        memberCount
        subDepartmentCount
        expenseVolumeAmount
        expenseCount
        manager {
          membershipId
          fullName
          email
          role
          initials
        }
        budgetSnapshot {
          periodLabel
          allocatedAmount
          spentAmount
          remainingAmount
          utilizationPct
        }
        subDepartments {
          id
          name
          memberCount
          budgetUtilizationPct
        }
        membersPreview {
          membershipId
          fullName
          email
          role
          initials
          isActive
        }
        recentActivity {
          id
          title
          description
          actorName
          tone
          amount
        }
      }
    }
  }
`;

const DEPARTMENT_TREE_OPTIONS_QUERY = `
  query DepartmentTreeOptions($selectedDepartmentId: UUID) {
    departmentWorkspace(selectedDepartmentId: $selectedDepartmentId) {
      tree {
        id
        name
        parentId
        isActive
        memberCount
        childCount
        budgetUtilizationPct
        children {
          id
          name
          parentId
          isActive
          memberCount
          childCount
          budgetUtilizationPct
          children {
            id
            name
            parentId
            isActive
            memberCount
            childCount
            budgetUtilizationPct
            children {
              id
              name
              parentId
              isActive
              memberCount
              childCount
              budgetUtilizationPct
            }
          }
        }
      }
    }
  }
`;

const CREATE_DEPARTMENT_MUTATION = `
  mutation CreateDepartment($input: CreateDepartmentInput!) {
    createDepartment(input: $input) {
      id
      name
      parentId
      isActive
    }
  }
`;

const RENAME_DEPARTMENT_MUTATION = `
  mutation RenameDepartment($input: RenameDepartmentInput!) {
    renameDepartment(input: $input) {
      id
      name
      parentId
      isActive
    }
  }
`;

const DEACTIVATE_DEPARTMENT_MUTATION = `
  mutation DeactivateDepartment($input: DeactivateDepartmentInput!) {
    deactivateDepartment(input: $input)
  }
`;

const ACTIVATE_DEPARTMENT_MUTATION = `
  mutation ActivateDepartment($input: ActivateDepartmentInput!) {
    activateDepartment(input: $input) {
      id
      name
      parentId
      isActive
    }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null => errors?.[0]?.message ?? null;

@Injectable({
  providedIn: 'root',
})
export class DepartmentsApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
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

  private isAuthInvalidError(error: unknown): boolean {
    if (error instanceof HttpErrorResponse) {
      return isAuthInvalidMessage(extractGraphQlMessage(error.error?.errors) ?? error.message);
    }

    if (error instanceof Error) {
      return isAuthInvalidMessage(error.message);
    }

    return false;
  }

  private withRefreshRetry<TData, TResult>(
    requestFactory: () => Observable<GraphQlResponse<TData>>,
    missingMessage: string,
    select: (data: TData) => TResult,
    hasRetried = false,
  ): Observable<TResult> {
    return defer(requestFactory).pipe(
      map((response) => select(this.extractData(response, missingMessage))),
      catchError((error: unknown) => {
        if (hasRetried || !this.isAuthInvalidError(error)) {
          return this.mapTransportError(error);
        }

        return this.authService.refreshToken().pipe(
          switchMap(() => this.withRefreshRetry(requestFactory, missingMessage, select, true)),
          catchError((refreshError: unknown) => this.mapTransportError(refreshError)),
        );
      }),
    );
  }

  getDepartmentWorkspace(
    selectedDepartmentId: string | null = null,
  ): Observable<DepartmentWorkspaceResponse> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<DepartmentWorkspaceQueryResponse>>(this.endpoint, {
          query: DEPARTMENT_WORKSPACE_QUERY,
          variables: {
            selectedDepartmentId,
          },
        }),
      'DepartmentWorkspace query did not include department data.',
      (data) => data.departmentWorkspace,
    );
  }

  getDepartmentTree(): Observable<DepartmentTreeNodeResponse[]> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<DepartmentWorkspaceQueryResponse>>(this.endpoint, {
          query: DEPARTMENT_TREE_OPTIONS_QUERY,
          variables: {
            selectedDepartmentId: null,
          },
        }),
      'GetDepartmentTree query did not return data.',
      (data) => data.departmentWorkspace.tree,
    );
  }

  createDepartment(
    name: string,
    parentId: string | null,
  ): Observable<DepartmentMutationPayloadResponse> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<CreateDepartmentMutationResponse>>(this.endpoint, {
          query: CREATE_DEPARTMENT_MUTATION,
          variables: {
            input: {
              name,
              parentId,
            },
          },
        }),
      'CreateDepartment mutation did not include department payload data.',
      (data) => data.createDepartment,
    );
  }

  renameDepartment(
    id: string,
    name: string,
  ): Observable<DepartmentMutationPayloadResponse> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<RenameDepartmentMutationResponse>>(this.endpoint, {
          query: RENAME_DEPARTMENT_MUTATION,
          variables: {
            input: {
              id,
              name,
            },
          },
        }),
      'RenameDepartment mutation did not include department payload data.',
      (data) => data.renameDepartment,
    );
  }

  deactivateDepartment(id: string): Observable<boolean> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<DeactivateDepartmentMutationResponse>>(this.endpoint, {
          query: DEACTIVATE_DEPARTMENT_MUTATION,
          variables: {
            input: {
              id,
            },
          },
        }),
      'DeactivateDepartment mutation did not include mutation result data.',
      (data) => data.deactivateDepartment,
    );
  }

  activateDepartment(id: string): Observable<DepartmentMutationPayloadResponse> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<ActivateDepartmentMutationResponse>>(this.endpoint, {
          query: ACTIVATE_DEPARTMENT_MUTATION,
          variables: {
            input: {
              id,
            },
          },
        }),
      'ActivateDepartment mutation did not include department payload data.',
      (data) => data.activateDepartment,
    );
  }
}
