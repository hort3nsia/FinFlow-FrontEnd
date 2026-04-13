import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, Observable, of, take, tap } from 'rxjs';
import { AuthApiService } from './auth-api.service';
import {
  AccountSession,
  WorkspaceSession,
  RefreshSession,
  LoginCredentials,
  RegisterCredentials,
  CreateWorkspaceInput,
  WorkspaceInfo,
  RegistrationPending,
  VerifyEmailOtpInput,
  ResetPasswordByOtpInput,
  ChallengeDispatchResponse,
} from './auth.models';
import { TokenStorageService } from './token-storage.service';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly authApiService = inject(AuthApiService);
  private readonly tokenStorage = inject(TokenStorageService);
  private readonly router = inject(Router);

  private readonly _accountSession = signal<AccountSession | null>(this.loadAccountSession());
  private readonly _workspaceSession = signal<WorkspaceSession | null>(this.loadWorkspaceSession());
  private readonly _workspaces = signal<WorkspaceInfo[]>([]);
  private readonly _isLoading = signal<boolean>(false);

  readonly accountSession = this._accountSession.asReadonly();
  readonly workspaceSession = this._workspaceSession.asReadonly();
  readonly workspaces = this._workspaces.asReadonly();
  readonly isLoading = this._isLoading.asReadonly();

  readonly isAuthenticated = computed(() => 
    this._accountSession() !== null || this._workspaceSession() !== null
  );

  readonly currentSessionKind = computed(() => 
    this._workspaceSession()?.sessionKind ?? 
    this._accountSession()?.sessionKind ?? 
    null
  );

  readonly hasWorkspace = computed(() => this._workspaceSession() !== null);

  readonly userEmail = computed(() => 
    this._workspaceSession()?.email ?? 
    this._accountSession()?.email ?? 
    null
  );

  private loadAccountSession(): AccountSession | null {
    const stored = localStorage.getItem('finflow_account_session');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }

  private loadWorkspaceSession(): WorkspaceSession | null {
    const stored = localStorage.getItem('finflow_workspace_session');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }

  private saveAccountSession(session: AccountSession): void {
    localStorage.setItem('finflow_account_session', JSON.stringify(session));
  }

  private saveWorkspaceSession(session: WorkspaceSession): void {
    localStorage.setItem('finflow_workspace_session', JSON.stringify(session));
  }

  private clearSessions(): void {
    localStorage.removeItem('finflow_account_session');
    localStorage.removeItem('finflow_workspace_session');
  }

  login(credentials: LoginCredentials): Observable<AccountSession> {
    this._isLoading.set(true);
    return this.authApiService.login(credentials).pipe(
      tap((session) => {
        this._accountSession.set(session);
        this.saveAccountSession(session);
        this.tokenStorage.setAccessToken(session.accessToken);
      }),
      catchError((error) => {
        console.error('Login failed:', error);
        throw error;
      }),
      finalize(() => this._isLoading.set(false)),
      take(1),
    );
  }

  register(credentials: RegisterCredentials): Observable<RegistrationPending> {
    this._isLoading.set(true);
    return this.authApiService.register(credentials).pipe(
      catchError((error) => {
        console.error('Register failed:', error);
        throw error;
      }),
      finalize(() => this._isLoading.set(false)),
      take(1),
    );
  }

  verifyEmailByToken(token: string): Observable<boolean> {
    this._isLoading.set(true);
    return this.authApiService.verifyEmailByToken(token).pipe(
      finalize(() => this._isLoading.set(false)),
      take(1),
    );
  }

  verifyEmailByOtp(input: VerifyEmailOtpInput): Observable<boolean> {
    this._isLoading.set(true);
    return this.authApiService.verifyEmailByOtp(input).pipe(
      finalize(() => this._isLoading.set(false)),
      take(1),
    );
  }

  resendEmailVerification(email: string): Observable<ChallengeDispatchResponse> {
    this._isLoading.set(true);
    return this.authApiService.resendEmailVerification(email).pipe(
      finalize(() => this._isLoading.set(false)),
      take(1),
    );
  }

  forgotPassword(email: string): Observable<ChallengeDispatchResponse> {
    this._isLoading.set(true);
    return this.authApiService.forgotPassword(email).pipe(
      finalize(() => this._isLoading.set(false)),
      take(1),
    );
  }

  verifyPasswordResetToken(token: string): Observable<boolean> {
    this._isLoading.set(true);
    return this.authApiService.verifyPasswordResetToken(token).pipe(
      finalize(() => this._isLoading.set(false)),
      take(1),
    );
  }

  resetPasswordByToken(token: string, newPassword: string): Observable<boolean> {
    this._isLoading.set(true);
    return this.authApiService.resetPasswordByToken(token, newPassword).pipe(
      finalize(() => this._isLoading.set(false)),
      take(1),
    );
  }

  resetPasswordByOtp(input: ResetPasswordByOtpInput): Observable<boolean> {
    this._isLoading.set(true);
    return this.authApiService.resetPasswordByOtp(input).pipe(
      finalize(() => this._isLoading.set(false)),
      take(1),
    );
  }

  refreshToken(): Observable<RefreshSession> {
    const refreshToken = this._workspaceSession()?.refreshToken ?? 
                         this._accountSession()?.refreshToken ?? 
                         '';
    
    return this.authApiService.refreshToken(refreshToken).pipe(
      tap((session) => {
        this.tokenStorage.setAccessToken(session.accessToken);
        
        if (session.sessionKind === 'workspace' && session.membershipId) {
          const workspaceSession: WorkspaceSession = {
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            id: session.id,
            membershipId: session.membershipId,
            email: session.email,
            role: session.role ?? 'Staff',
            idTenant: session.idTenant ?? '',
            sessionKind: 'workspace',
          };
          this._workspaceSession.set(workspaceSession);
          this.saveWorkspaceSession(workspaceSession);
        } else {
          const accountSession: AccountSession = {
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            id: session.id,
            email: session.email,
            sessionKind: 'account',
          };
          this._accountSession.set(accountSession);
          this.saveAccountSession(accountSession);
        }
      }),
      take(1),
    );
  }

  logout(): void {
    const refreshToken = this._workspaceSession()?.refreshToken ?? 
                         this._accountSession()?.refreshToken ?? 
                         null;
    
    const completeLogout = () => {
      this.tokenStorage.clear();
      this.clearSessions();
      this._accountSession.set(null);
      this._workspaceSession.set(null);
      this._workspaces.set([]);
      void this.router.navigateByUrl('/login');
    };

    if (!refreshToken) {
      completeLogout();
      return;
    }

    this.authApiService
      .logout(refreshToken)
      .pipe(
        take(1),
        catchError(() => of(false)),
        finalize(completeLogout),
      )
      .subscribe();
  }

  createWorkspace(input: CreateWorkspaceInput): Observable<WorkspaceSession> {
    this._isLoading.set(true);
    return this.authApiService.createWorkspace(input).pipe(
      tap((session) => {
        this._workspaceSession.set(session);
        this.saveWorkspaceSession(session);
        this.tokenStorage.setAccessToken(session.accessToken);
      }),
      catchError((error) => {
        console.error('CreateWorkspace failed:', error);
        throw error;
      }),
      finalize(() => this._isLoading.set(false)),
      take(1),
    );
  }

  switchWorkspace(membershipId: string): Observable<WorkspaceSession> {
    const currentRefreshToken = this._workspaceSession()?.refreshToken ?? 
                                 this._accountSession()?.refreshToken ?? 
                                 '';
    
    this._isLoading.set(true);
    return this.authApiService.switchWorkspace(membershipId, currentRefreshToken).pipe(
      tap((session) => {
        this._workspaceSession.set(session);
        this.saveWorkspaceSession(session);
        this.tokenStorage.setAccessToken(session.accessToken);
      }),
      catchError((error) => {
        console.error('SwitchWorkspace failed:', error);
        throw error;
      }),
      finalize(() => this._isLoading.set(false)),
      take(1),
    );
  }

  loadWorkspaces(): Observable<WorkspaceInfo[]> {
    return this.authApiService.getMyWorkspaces().pipe(
      tap((workspaces) => this._workspaces.set(workspaces)),
      take(1),
    );
  }

  getAccessToken(): string | null {
    return this._workspaceSession()?.accessToken ?? 
           this._accountSession()?.accessToken ?? 
           null;
  }

  goToDashboard(): void {
    void this.router.navigateByUrl('/app/dashboard');
  }

  goToWorkspaceSelection(): void {
    void this.router.navigateByUrl('/workspaces');
  }

  goToCreateWorkspace(): void {
    void this.router.navigateByUrl('/create-workspace');
  }

  goToLogin(): void {
    void this.router.navigateByUrl('/login');
  }
}
