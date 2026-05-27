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

export interface BudgetWorkspaceSummaryResponse {
  periodLabel: string;
  totalAllocated: number;
  totalCommitted: number;
  totalSpent: number;
  availablePool: number;
  activeBudgetCount: number;
  overBudgetCount: number;
  committedDocumentCount: number;
  paidDocumentCount: number;
  allWithinBudget: boolean;
  currencyCode: string;
  managerScopeDepartmentName: string | null;
}

export interface BudgetWorkspaceActivityResponse {
  id: string;
  reference: string;
  employeeName: string;
  amount: number;
  state: string;
  date: string;
}

export interface BudgetWorkspaceTrendResponse {
  monthLabel: string;
  allocatedAmount: number;
  spentAmount: number;
  committedAmount: number | null;
}

export interface BudgetWorkspaceAuditResponse {
  id: string;
  type: string;
  title: string;
  actorName: string;
  timestamp: string;
  detail: string | null;
}

export interface BudgetWorkspaceBudgetResponse {
  id: string;
  departmentId: string;
  departmentName: string;
  departmentPath: string;
  periodLabel: string;
  allocatedAmount: number;
  carryOverAmount: number;
  committedAmount: number;
  spentAmount: number;
  availableAmount: number;
  utilizationPct: number;
  enforcementMode: string;
  status: string;
  isActive: boolean;
  updatedAt: string;
  activeExpenseCount: number;
  committedDocumentCount: number;
  paidDocumentCount: number;
  setByName: string;
  setOn: string;
  currencyCode: string;
  activity: BudgetWorkspaceActivityResponse[];
  trend: BudgetWorkspaceTrendResponse[];
  audit: BudgetWorkspaceAuditResponse[];
}

export interface BudgetWorkspaceResponse {
  summary: BudgetWorkspaceSummaryResponse;
  budgets: BudgetWorkspaceBudgetResponse[];
  selectedBudget: BudgetWorkspaceBudgetResponse | null;
}

export interface CreateBudgetInput {
  departmentId: string;
  month: number;
  year: number;
  amount: number;
}

export interface UpdateBudgetInput {
  budgetId: string;
  amount: number;
}

export interface SetBudgetEnforcementModeInput {
  budgetId: string;
  mode: string;
}

export interface CarryOverBudgetsInput {
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
  carryOverPercentage: number;
}

export interface BudgetMutationPayloadResponse {
  id: string;
  departmentId?: string;
  departmentName?: string;
  month?: number;
  year?: number;
  allocatedAmount?: number;
  spentAmount?: number;
  availableAmount?: number;
  isOverBudget?: boolean;
  isNearLimit?: boolean;
}

interface BudgetWorkspaceQueryResponse {
  budgetWorkspace: BudgetWorkspaceResponse;
}

interface CreateBudgetMutationResponse {
  createBudget: BudgetMutationPayloadResponse;
}

interface UpdateBudgetMutationResponse {
  updateBudget: BudgetMutationPayloadResponse;
}

interface SetBudgetEnforcementModeMutationResponse {
  setBudgetEnforcementMode: BudgetMutationPayloadResponse;
}

interface CarryOverBudgetsMutationResponse {
  carryOverBudgets: number;
}

const BUDGET_WORKSPACE_QUERY = `
  query BudgetWorkspace($month: Int!, $year: Int!, $selectedBudgetId: UUID) {
    budgetWorkspace(month: $month, year: $year, selectedBudgetId: $selectedBudgetId) {
      summary {
        periodLabel
        totalAllocated
        totalCommitted
        totalSpent
        availablePool
        activeBudgetCount
        overBudgetCount
        committedDocumentCount
        paidDocumentCount
        allWithinBudget
        currencyCode
        managerScopeDepartmentName
      }
      budgets {
        id
        departmentId
        departmentName
        departmentPath
        periodLabel
        allocatedAmount
        carryOverAmount
        committedAmount
        spentAmount
        availableAmount
        utilizationPct
        enforcementMode
        status
        isActive
        updatedAt
        activeExpenseCount
        committedDocumentCount
        paidDocumentCount
        setByName
        setOn
        currencyCode
        activity { id reference employeeName amount state date }
        trend { monthLabel allocatedAmount spentAmount committedAmount }
        audit { id type title actorName timestamp detail }
      }
      selectedBudget {
        id
        departmentId
        departmentName
        departmentPath
        periodLabel
        allocatedAmount
        carryOverAmount
        committedAmount
        spentAmount
        availableAmount
        utilizationPct
        enforcementMode
        status
        isActive
        updatedAt
        activeExpenseCount
        committedDocumentCount
        paidDocumentCount
        setByName
        setOn
        currencyCode
        activity { id reference employeeName amount state date }
        trend { monthLabel allocatedAmount spentAmount committedAmount }
        audit { id type title actorName timestamp detail }
      }
    }
  }
`;

const CREATE_BUDGET_MUTATION = `
  mutation CreateBudget($input: CreateBudgetInput!) {
    createBudget(input: $input) {
      id
      departmentId
      departmentName
      month
      year
      allocatedAmount
      spentAmount
      availableAmount
      isOverBudget
      isNearLimit
    }
  }
`;

const UPDATE_BUDGET_MUTATION = `
  mutation UpdateBudget($input: UpdateBudgetInput!) {
    updateBudget(input: $input) {
      id
      departmentId
      departmentName
      month
      year
      allocatedAmount
      spentAmount
      availableAmount
      isOverBudget
      isNearLimit
    }
  }
`;

const SET_BUDGET_ENFORCEMENT_MODE_MUTATION = `
  mutation SetBudgetEnforcementMode($input: SetBudgetEnforcementModeInput!) {
    setBudgetEnforcementMode(input: $input) {
      id
      departmentId
      departmentName
      month
      year
      allocatedAmount
      spentAmount
      availableAmount
      isOverBudget
      isNearLimit
    }
  }
`;

const CARRY_OVER_BUDGETS_MUTATION = `
  mutation CarryOverBudgets($input: CarryOverBudgetsInput!) {
    carryOverBudgets(input: $input)
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null =>
  errors?.[0]?.message ?? null;

@Injectable({ providedIn: 'root' })
export class BudgetsApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(API_BASE_URL);

  getBudgetWorkspace(
    month: number,
    year: number,
    selectedBudgetId: string | null = null,
  ): Observable<BudgetWorkspaceResponse> {
    return this.http
      .post<GraphQlResponse<BudgetWorkspaceQueryResponse>>(this.endpoint, {
        query: BUDGET_WORKSPACE_QUERY,
        variables: { month, year, selectedBudgetId },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'BudgetWorkspace query did not include budget data.')
            .budgetWorkspace,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  createBudget(input: CreateBudgetInput): Observable<BudgetMutationPayloadResponse> {
    return this.http
      .post<GraphQlResponse<CreateBudgetMutationResponse>>(this.endpoint, {
        query: CREATE_BUDGET_MUTATION,
        variables: { input },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'CreateBudget mutation did not return data.').createBudget,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  updateBudget(input: UpdateBudgetInput): Observable<BudgetMutationPayloadResponse> {
    return this.http
      .post<GraphQlResponse<UpdateBudgetMutationResponse>>(this.endpoint, {
        query: UPDATE_BUDGET_MUTATION,
        variables: { input },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'UpdateBudget mutation did not return data.').updateBudget,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  setBudgetEnforcementMode(
    input: SetBudgetEnforcementModeInput,
  ): Observable<BudgetMutationPayloadResponse> {
    return this.http
      .post<GraphQlResponse<SetBudgetEnforcementModeMutationResponse>>(this.endpoint, {
        query: SET_BUDGET_ENFORCEMENT_MODE_MUTATION,
        variables: { input },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'SetBudgetEnforcementMode mutation did not return data.')
            .setBudgetEnforcementMode,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  carryOverBudgets(input: CarryOverBudgetsInput): Observable<number> {
    return this.http
      .post<GraphQlResponse<CarryOverBudgetsMutationResponse>>(this.endpoint, {
        query: CARRY_OVER_BUDGETS_MUTATION,
        variables: { input },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'CarryOverBudgets mutation did not return data.')
            .carryOverBudgets,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  private extractData<TData>(response: GraphQlResponse<TData>, missingMessage: string): TData {
    const message = extractGraphQlMessage(response.errors);
    if (message) {
      throw new Error(message);
    }
    if (!response.data) {
      throw new Error(missingMessage);
    }
    return response.data;
  }

  private mapTransportError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const message = extractGraphQlMessage(error.error?.errors);
      return throwError(
        () => new Error(message ?? error.message ?? 'Unable to complete the request.'),
      );
    }
    if (error instanceof Error) {
      return throwError(() => error);
    }
    return throwError(() => new Error('Unable to complete the request.'));
  }
}
