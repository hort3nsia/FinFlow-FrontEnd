import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api-base-url.token';
import {
  LoginCredentials,
  RegisterCredentials,
  CreateWorkspaceInput,
  AccountSession,
  WorkspaceSession,
  RefreshSession,
  WorkspaceInfo,
  CurrentWorkspace,
  RegistrationPending,
  VerifyEmailOtpInput,
  ChallengeDispatchResponse,
} from './auth.models';

interface GraphQlError {
  message: string;
}

interface GraphQlResponse<TData> {
  data?: TData;
  errors?: GraphQlError[];
}

interface LoginMutationResponse {
  login: AccountSession;
}

interface RegisterMutationResponse {
  register: RegistrationPending;
}

interface VerifyEmailByTokenMutationResponse {
  verifyEmailByToken: boolean;
}

interface VerifyEmailByOtpMutationResponse {
  verifyEmailByOtp: boolean;
}

interface ResendEmailVerificationMutationResponse {
  resendEmailVerification: ChallengeDispatchResponse;
}

interface RefreshTokenMutationResponse {
  refreshToken: RefreshSession;
}

interface LogoutMutationResponse {
  logout: boolean;
}

interface CreateSharedTenantMutationResponse {
  createSharedTenant: WorkspaceSession;
}

interface SwitchWorkspaceMutationResponse {
  switchWorkspace: WorkspaceSession;
}

interface MyWorkspacesQueryResponse {
  myWorkspaces: WorkspaceInfo[];
}

interface CurrentWorkspaceQueryResponse {
  currentWorkspace: CurrentWorkspace;
}

const LOGIN_MUTATION = `
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      accessToken
      refreshToken
      id
      email
      sessionKind
    }
  }
`;

const REGISTER_MUTATION = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      accountId
      email
      requiresEmailVerification
      cooldownSeconds
    }
  }
`;

const VERIFY_EMAIL_BY_TOKEN_MUTATION = `
  mutation VerifyEmailByToken($token: String!) {
    verifyEmailByToken(token: $token)
  }
`;

const VERIFY_EMAIL_BY_OTP_MUTATION = `
  mutation VerifyEmailByOtp($email: String!, $otp: String!) {
    verifyEmailByOtp(email: $email, otp: $otp)
  }
`;

const RESEND_EMAIL_VERIFICATION_MUTATION = `
  mutation ResendEmailVerification($email: String!) {
    resendEmailVerification(email: $email) {
      accepted
      cooldownSeconds
    }
  }
`;

const REFRESH_TOKEN_MUTATION = `
  mutation RefreshToken($input: RefreshTokenInput!) {
    refreshToken(input: $input) {
      accessToken
      refreshToken
      id
      email
      sessionKind
      membershipId
      role
      idTenant
    }
  }
`;

const LOGOUT_MUTATION = `
  mutation Logout($refreshToken: String!) {
    logout(refreshToken: $refreshToken)
  }
`;

const CREATE_SHARED_TENANT_MUTATION = `
  mutation CreateSharedTenant($input: CreateSharedTenantInput!) {
    createSharedTenant(input: $input) {
      accessToken
      refreshToken
      id
      membershipId
      email
      role
      idTenant
      sessionKind
    }
  }
`;

const SWITCH_WORKSPACE_MUTATION = `
  mutation SwitchWorkspace($input: SwitchWorkspaceInput!) {
    switchWorkspace(input: $input) {
      accessToken
      refreshToken
      id
      membershipId
      email
      role
      idTenant
      sessionKind
    }
  }
`;

const MY_WORKSPACES_QUERY = `
  query MyWorkspaces {
    myWorkspaces {
      workspaceId
      tenantId
      tenantCode
      tenantName
      membershipId
      role
    }
  }
`;

const CURRENT_WORKSPACE_QUERY = `
  query CurrentWorkspace {
    currentWorkspace {
      accountId
      email
      membershipId
      role
      tenantId
      tenantCode
      tenantName
    }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null => errors?.[0]?.message ?? null;

@Injectable({
  providedIn: 'root',
})
export class AuthApiService {
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

  login(input: LoginCredentials): Observable<AccountSession> {
    return this.http
      .post<GraphQlResponse<LoginMutationResponse>>(this.endpoint, {
        query: LOGIN_MUTATION,
        variables: { input },
      })
      .pipe(
        map((response) => {
          const session = this.extractData(response, 'Login response did not include session data.')
            .login;
          if (!session) {
            throw new Error('Login response did not include session data.');
          }
          return session;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  register(input: RegisterCredentials): Observable<RegistrationPending> {
    return this.http
      .post<GraphQlResponse<RegisterMutationResponse>>(this.endpoint, {
        query: REGISTER_MUTATION,
        variables: { input },
      })
      .pipe(
        map((response) => {
          const pending = this.extractData(response, 'Register response did not include verification data.')
            .register;
          if (!pending) {
            throw new Error('Register response did not include verification data.');
          }
          return pending;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  verifyEmailByToken(token: string): Observable<boolean> {
    return this.http
      .post<GraphQlResponse<VerifyEmailByTokenMutationResponse>>(this.endpoint, {
        query: VERIFY_EMAIL_BY_TOKEN_MUTATION,
        variables: { token },
      })
      .pipe(
        map((response) => {
          const result = this.extractData(response, 'VerifyEmailByToken response did not include a result.')
            .verifyEmailByToken;
          if (typeof result !== 'boolean') {
            throw new Error('VerifyEmailByToken response did not include a result.');
          }
          return result;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  verifyEmailByOtp(input: VerifyEmailOtpInput): Observable<boolean> {
    return this.http
      .post<GraphQlResponse<VerifyEmailByOtpMutationResponse>>(this.endpoint, {
        query: VERIFY_EMAIL_BY_OTP_MUTATION,
        variables: input,
      })
      .pipe(
        map((response) => {
          const result = this.extractData(response, 'VerifyEmailByOtp response did not include a result.')
            .verifyEmailByOtp;
          if (typeof result !== 'boolean') {
            throw new Error('VerifyEmailByOtp response did not include a result.');
          }
          return result;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  resendEmailVerification(email: string): Observable<ChallengeDispatchResponse> {
    return this.http
      .post<GraphQlResponse<ResendEmailVerificationMutationResponse>>(this.endpoint, {
        query: RESEND_EMAIL_VERIFICATION_MUTATION,
        variables: { email },
      })
      .pipe(
        map((response) => {
          const dispatch = this.extractData(response, 'ResendEmailVerification response did not include dispatch data.')
            .resendEmailVerification;
          if (!dispatch) {
            throw new Error('ResendEmailVerification response did not include dispatch data.');
          }
          return dispatch;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  refreshToken(refreshToken: string): Observable<RefreshSession> {
    return this.http
      .post<GraphQlResponse<RefreshTokenMutationResponse>>(this.endpoint, {
        query: REFRESH_TOKEN_MUTATION,
        variables: { input: { refreshToken } },
      })
      .pipe(
        map((response) => {
          const session = this.extractData(response, 'RefreshToken response did not include session data.')
            .refreshToken;
          if (!session) {
            throw new Error('RefreshToken response did not include session data.');
          }
          return session;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  logout(refreshToken: string): Observable<boolean> {
    return this.http
      .post<GraphQlResponse<LogoutMutationResponse>>(this.endpoint, {
        query: LOGOUT_MUTATION,
        variables: { refreshToken },
      })
      .pipe(
        map((response) => {
          const result = this.extractData(response, 'Logout response did not include a result.')
            .logout;
          if (typeof result !== 'boolean') {
            throw new Error('Logout response did not include a result.');
          }
          return result;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  createWorkspace(input: CreateWorkspaceInput): Observable<WorkspaceSession> {
    return this.http
      .post<GraphQlResponse<CreateSharedTenantMutationResponse>>(this.endpoint, {
        query: CREATE_SHARED_TENANT_MUTATION,
        variables: { input },
      })
      .pipe(
        map((response) => {
          const session = this.extractData(response, 'CreateWorkspace response did not include session data.')
            .createSharedTenant;
          if (!session) {
            throw new Error('CreateWorkspace response did not include session data.');
          }
          return session;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  switchWorkspace(membershipId: string, currentRefreshToken: string): Observable<WorkspaceSession> {
    return this.http
      .post<GraphQlResponse<SwitchWorkspaceMutationResponse>>(this.endpoint, {
        query: SWITCH_WORKSPACE_MUTATION,
        variables: { input: { membershipId, currentRefreshToken } },
      })
      .pipe(
        map((response) => {
          const session = this.extractData(response, 'SwitchWorkspace response did not include session data.')
            .switchWorkspace;
          if (!session) {
            throw new Error('SwitchWorkspace response did not include session data.');
          }
          return session;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getMyWorkspaces(): Observable<WorkspaceInfo[]> {
    return this.http
      .post<GraphQlResponse<MyWorkspacesQueryResponse>>(this.endpoint, {
        query: MY_WORKSPACES_QUERY,
      })
      .pipe(
        map((response) => {
          const data = this.extractData(response, 'MyWorkspaces query did not include data.');
          return data.myWorkspaces;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getCurrentWorkspace(): Observable<CurrentWorkspace> {
    return this.http
      .post<GraphQlResponse<CurrentWorkspaceQueryResponse>>(this.endpoint, {
        query: CURRENT_WORKSPACE_QUERY,
      })
      .pipe(
        map((response) => {
          const data = this.extractData(response, 'CurrentWorkspace query did not include data.');
          return data.currentWorkspace;
        }),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }
}
