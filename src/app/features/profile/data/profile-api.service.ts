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

export interface ReimbursementProfileResponse {
  membershipId: string;
  bankCode: string | null;
  bankName: string | null;
  bankAccountLast4: string | null;
  bankAccountHolderName: string | null;
  bankBranch: string | null;
  preferredPaymentMethod: string | null;
  contactPhone: string | null;
  reimbursementEmail: string | null;
  taxId: string | null;
  hasBankInfo: boolean;
  updatedAt: string;
}

export interface BankCode {
  code: string;
  name: string;
  fullName: string;
}

export interface OtpDispatchResponse {
  challengeId: string;
  cooldownSeconds: number;
}

export interface UpdateMyReimbursementProfileInput {
  preferredPaymentMethod?: string | null;
  contactPhone?: string | null;
  reimbursementEmail?: string | null;
  taxId?: string | null;
}

export interface ConfirmBankInfoUpdateInput {
  challengeId: string;
  otp: string;
  bankCode?: string | null;
  bankAccountNumber?: string | null;
  bankAccountHolderName?: string | null;
  bankBranch?: string | null;
}

const PROFILE_FIELDS = `
  membershipId
  bankCode
  bankName
  bankAccountLast4
  bankAccountHolderName
  bankBranch
  preferredPaymentMethod
  contactPhone
  reimbursementEmail
  taxId
  hasBankInfo
  updatedAt
`;

const MY_PROFILE_QUERY = `
  query MyReimbursementProfile {
    myReimbursementProfile {${PROFILE_FIELDS}}
  }
`;

const BANK_CODES_QUERY = `
  query BankCodes {
    bankCodes { code name fullName }
  }
`;

const UPDATE_PROFILE_MUTATION = `
  mutation UpdateMyReimbursementProfile($input: UpdateMyReimbursementProfileInput!) {
    updateMyReimbursementProfile(input: $input) {${PROFILE_FIELDS}}
  }
`;

const REQUEST_BANK_OTP_MUTATION = `
  mutation RequestBankInfoUpdateOtp {
    requestBankInfoUpdateOtp {
      challengeId
      cooldownSeconds
    }
  }
`;

const CONFIRM_BANK_UPDATE_MUTATION = `
  mutation ConfirmBankInfoUpdate($input: ConfirmBankInfoUpdateInput!) {
    confirmBankInfoUpdate(input: $input) {${PROFILE_FIELDS}}
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null =>
  errors?.[0]?.message ?? null;

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly endpoint = inject(API_BASE_URL);

  getMyProfile(): Observable<ReimbursementProfileResponse | null> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<{ myReimbursementProfile: ReimbursementProfileResponse | null }>>(
          this.endpoint,
          { query: MY_PROFILE_QUERY },
        ),
      'MyReimbursementProfile did not return data.',
      (data) => data.myReimbursementProfile,
    );
  }

  getBankCodes(): Observable<BankCode[]> {
    return this.http
      .post<GraphQlResponse<{ bankCodes: BankCode[] }>>(this.endpoint, { query: BANK_CODES_QUERY })
      .pipe(
        map((response) => this.extractData(response, 'BankCodes did not return data.').bankCodes),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  updateProfile(
    input: UpdateMyReimbursementProfileInput,
  ): Observable<ReimbursementProfileResponse> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<{ updateMyReimbursementProfile: ReimbursementProfileResponse }>>(
          this.endpoint,
          { query: UPDATE_PROFILE_MUTATION, variables: { input } },
        ),
      'UpdateProfile did not return data.',
      (data) => data.updateMyReimbursementProfile,
    );
  }

  requestBankOtp(): Observable<OtpDispatchResponse> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<{ requestBankInfoUpdateOtp: OtpDispatchResponse }>>(this.endpoint, {
          query: REQUEST_BANK_OTP_MUTATION,
        }),
      'RequestBankInfoUpdateOtp did not return data.',
      (data) => data.requestBankInfoUpdateOtp,
    );
  }

  confirmBankUpdate(
    input: ConfirmBankInfoUpdateInput,
  ): Observable<ReimbursementProfileResponse> {
    return this.withRefreshRetry(
      () =>
        this.http.post<GraphQlResponse<{ confirmBankInfoUpdate: ReimbursementProfileResponse }>>(this.endpoint, {
          query: CONFIRM_BANK_UPDATE_MUTATION,
          variables: { input },
        }),
      'ConfirmBankInfoUpdate did not return data.',
      (data) => data.confirmBankInfoUpdate,
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
}
