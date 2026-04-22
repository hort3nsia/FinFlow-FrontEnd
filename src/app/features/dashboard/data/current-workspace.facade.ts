import { inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { CurrentWorkspaceApiService } from './current-workspace.api.service';
import { CurrentWorkspace } from './current-workspace.models';

export interface CurrentWorkspaceState {
  workspace: CurrentWorkspace | null;
  loading: boolean;
  error: string | null;
}
const AUTH_INVALID_PATTERNS = [
  'not authenticated',
  'token is invalid',
  'unauthorized',
  'refresh token is invalid',
];

@Injectable({
  providedIn: 'root',
})
export class CurrentWorkspaceFacade {
  private readonly authService = inject(AuthService);
  private readonly currentWorkspaceApiService = inject(CurrentWorkspaceApiService);
  private workspaceRequestSubscription: Subscription | null = null;
  private readonly stateSignal = signal<CurrentWorkspaceState>({
    workspace: null,
    loading: false,
    error: null,
  });

  readonly state = this.stateSignal.asReadonly();

  private isAuthInvalidError(message: string): boolean {
    const normalizedMessage = message.toLowerCase();
    return AUTH_INVALID_PATTERNS.some((pattern) => normalizedMessage.includes(pattern));
  }

  refresh(): void {
    this.workspaceRequestSubscription?.unsubscribe();

    if (!this.authService.workspaceSession()) {
      this.stateSignal.set({
        workspace: null,
        loading: false,
        error: null,
      });
      return;
    }

    this.stateSignal.set({
      workspace: null,
      loading: true,
      error: null,
    });

    this.workspaceRequestSubscription = this.currentWorkspaceApiService.getCurrentWorkspace().subscribe({
        next: (workspace) => {
          this.stateSignal.set({
            workspace,
            loading: false,
            error: null,
          });
        },
        error: (error: Error) => {
          if (this.isAuthInvalidError(error.message)) {
            this.stateSignal.set({
              workspace: null,
              loading: false,
              error: 'Workspace session expired. Please choose a workspace again.',
            });
            this.authService.resetWorkspaceContext({ redirectToSelection: true });
            return;
          }

          this.stateSignal.set({
            workspace: null,
            loading: false,
            error: error.message,
          });
        },
      });
  }
}
