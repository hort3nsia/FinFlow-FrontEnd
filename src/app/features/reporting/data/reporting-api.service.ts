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

export interface ExpenseSummaryGroup {
  keyId: string | null;
  keyName: string;
  amountInBaseCurrency: number;
  expenseCount: number;
}

export interface ExpenseSummaryByCurrency {
  currencyCode: string;
  nativeAmount: number;
  amountInBaseCurrency: number;
  expenseCount: number;
}

export interface ExpenseSummaryResponse {
  expenseCount: number;
  totalInBaseCurrency: number;
  baseCurrencyCode: string;
  byCategory: ExpenseSummaryGroup[];
  byDepartment: ExpenseSummaryGroup[];
  byCurrency: ExpenseSummaryByCurrency[];
}

export interface BudgetUtilizationResponse {
  departmentId: string;
  departmentName: string;
  month: number;
  year: number;
  allocated: number;
  committed: number;
  spent: number;
  remaining: number;
  utilizationPercent: number;
  isApproachingLimit: boolean;
  isOverBudget: boolean;
  baseCurrencyCode: string;
}

export interface TopVendorResponse {
  vendorId: string;
  vendorName: string;
  taxCode: string;
  isVerified: boolean;
  documentCount: number;
  totalAmountInBaseCurrency: number;
  baseCurrencyCode: string;
}

export interface TopEmployeeResponse {
  membershipId: string;
  accountId: string;
  employeeName: string;
  departmentName: string;
  expenseCount: number;
  totalAmountInBaseCurrency: number;
  baseCurrencyCode: string;
}

export interface PendingPaymentItemResponse {
  paymentId: string;
  documentId: string;
  reference: string;
  employeeName: string;
  departmentName: string;
  amount: number;
  currencyCode: string;
  amountInBaseCurrency: number;
  baseCurrencyCode: string;
  paymentMethod: string;
  recordedAt: string;
  ageDays: number;
}

export interface MonthlyTrendPointResponse {
  year: number;
  month: number;
  expenseTotal: number;
  documentCount: number;
  baseCurrencyCode: string;
}

export interface ReportingPeriodInput {
  from: string; // ISO date YYYY-MM-DD
  to: string;
  departmentId?: string | null;
}

const EXPENSE_SUMMARY_QUERY = `
  query ExpenseSummary($from: Date!, $to: Date!, $departmentId: UUID) {
    expenseSummary(from: $from, to: $to, departmentId: $departmentId) {
      expenseCount
      totalInBaseCurrency
      baseCurrencyCode
      byCategory { keyId keyName amountInBaseCurrency expenseCount }
      byDepartment { keyId keyName amountInBaseCurrency expenseCount }
      byCurrency { currencyCode nativeAmount amountInBaseCurrency expenseCount }
    }
  }
`;

const BUDGET_UTILIZATION_QUERY = `
  query BudgetUtilization($month: Int!, $year: Int!, $departmentId: UUID) {
    budgetUtilization(month: $month, year: $year, departmentId: $departmentId) {
      departmentId
      departmentName
      month
      year
      allocated
      committed
      spent
      remaining
      utilizationPercent
      isApproachingLimit
      isOverBudget
      baseCurrencyCode
    }
  }
`;

const TOP_VENDORS_QUERY = `
  query TopVendors($from: Date!, $to: Date!, $limit: Int) {
    topVendors(from: $from, to: $to, limit: $limit) {
      vendorId
      vendorName
      taxCode
      isVerified
      documentCount
      totalAmountInBaseCurrency
      baseCurrencyCode
    }
  }
`;

const TOP_EMPLOYEES_QUERY = `
  query TopEmployees($from: Date!, $to: Date!, $departmentId: UUID, $limit: Int) {
    topEmployees(from: $from, to: $to, departmentId: $departmentId, limit: $limit) {
      membershipId
      accountId
      employeeName
      departmentName
      expenseCount
      totalAmountInBaseCurrency
      baseCurrencyCode
    }
  }
`;

const PENDING_PAYMENT_QUEUE_QUERY = `
  query PendingPaymentQueue {
    pendingPaymentQueue {
      paymentId
      documentId
      reference
      employeeName
      departmentName
      amount
      currencyCode
      amountInBaseCurrency
      baseCurrencyCode
      paymentMethod
      recordedAt
      ageDays
    }
  }
`;

const MONTHLY_TREND_QUERY = `
  query MonthlyTrend($months: Int, $departmentId: UUID) {
    monthlyTrend(months: $months, departmentId: $departmentId) {
      year
      month
      expenseTotal
      documentCount
      baseCurrencyCode
    }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null =>
  errors?.[0]?.message ?? null;

@Injectable({ providedIn: 'root' })
export class ReportingApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(API_BASE_URL);

  expenseSummary(input: ReportingPeriodInput): Observable<ExpenseSummaryResponse> {
    return this.http
      .post<GraphQlResponse<{ expenseSummary: ExpenseSummaryResponse }>>(this.endpoint, {
        query: EXPENSE_SUMMARY_QUERY,
        variables: { from: input.from, to: input.to, departmentId: input.departmentId ?? null },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'ExpenseSummary did not return data.').expenseSummary,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  budgetUtilization(
    month: number,
    year: number,
    departmentId: string | null = null,
  ): Observable<BudgetUtilizationResponse[]> {
    return this.http
      .post<GraphQlResponse<{ budgetUtilization: BudgetUtilizationResponse[] }>>(this.endpoint, {
        query: BUDGET_UTILIZATION_QUERY,
        variables: { month, year, departmentId },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'BudgetUtilization did not return data.').budgetUtilization,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  topVendors(
    fromDate: string,
    toDate: string,
    limit = 10,
  ): Observable<TopVendorResponse[]> {
    return this.http
      .post<GraphQlResponse<{ topVendors: TopVendorResponse[] }>>(this.endpoint, {
        query: TOP_VENDORS_QUERY,
        variables: { from: fromDate, to: toDate, limit },
      })
      .pipe(
        map((response) => this.extractData(response, 'TopVendors did not return data.').topVendors),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  topEmployees(
    fromDate: string,
    toDate: string,
    limit = 10,
    departmentId: string | null = null,
  ): Observable<TopEmployeeResponse[]> {
    return this.http
      .post<GraphQlResponse<{ topEmployees: TopEmployeeResponse[] }>>(this.endpoint, {
        query: TOP_EMPLOYEES_QUERY,
        variables: { from: fromDate, to: toDate, departmentId, limit },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'TopEmployees did not return data.').topEmployees,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  pendingPaymentQueue(): Observable<PendingPaymentItemResponse[]> {
    return this.http
      .post<GraphQlResponse<{ pendingPaymentQueue: PendingPaymentItemResponse[] }>>(this.endpoint, {
        query: PENDING_PAYMENT_QUEUE_QUERY,
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'PendingPaymentQueue did not return data.')
            .pendingPaymentQueue,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  monthlyTrend(
    months = 6,
    departmentId: string | null = null,
  ): Observable<MonthlyTrendPointResponse[]> {
    return this.http
      .post<GraphQlResponse<{ monthlyTrend: MonthlyTrendPointResponse[] }>>(this.endpoint, {
        query: MONTHLY_TREND_QUERY,
        variables: { months, departmentId },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'MonthlyTrend did not return data.').monthlyTrend,
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
