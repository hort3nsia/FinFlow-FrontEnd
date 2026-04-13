import { inject, Injectable, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { CurrentWorkspaceApiService } from './current-workspace.api.service';
import { CurrentWorkspace } from './current-workspace.models';

export interface CurrentWorkspaceState {
  workspace: CurrentWorkspace | null;
  loading: boolean;
  error: string | null;
  statusLabel: string;
}

const STATUS_LABEL = 'Backend-backed workspace snapshot';

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
    statusLabel: STATUS_LABEL,
  });

  readonly state = this.stateSignal.asReadonly();

  refresh(): void {
    this.workspaceRequestSubscription?.unsubscribe();

    if (!this.authService.workspaceSession()) {
      this.stateSignal.set({
        workspace: null,
        loading: false,
        error: null,
        statusLabel: STATUS_LABEL,
      });
      return;
    }

    this.stateSignal.set({
      workspace: null,
      loading: true,
      error: null,
      statusLabel: STATUS_LABEL,
    });

    this.workspaceRequestSubscription = this.currentWorkspaceApiService.getCurrentWorkspace().subscribe({
        next: (workspace) => {
          this.stateSignal.set({
            workspace,
            loading: false,
            error: null,
            statusLabel: STATUS_LABEL,
          });
        },
        error: (error: Error) => {
          this.stateSignal.set({
            workspace: null,
            loading: false,
            error: error.message,
            statusLabel: STATUS_LABEL,
          });
        },
      });
  }
}
