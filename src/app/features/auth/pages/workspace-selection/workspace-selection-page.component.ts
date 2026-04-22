import { finalize, tap } from 'rxjs';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { WorkspaceInfo } from '../../../../core/auth/auth.models';
import { BrandMarkComponent } from '../../../../shared/ui/brand-mark/brand-mark.component';

@Component({
  selector: 'app-workspace-selection-page',
  standalone: true,
  imports: [BrandMarkComponent, RouterLink],
  templateUrl: './workspace-selection-page.component.html',
  styleUrl: './workspace-selection-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceSelectionPageComponent implements OnInit {
  private readonly authService = inject(AuthService);

  protected readonly userEmail = this.authService.userEmail;
  protected readonly workspaces = signal<WorkspaceInfo[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSwitching = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isAccountMenuOpen = signal(false);

  ngOnInit(): void {
    this.loadWorkspaces();
  }

  protected toggleAccountMenu(): void {
    this.isAccountMenuOpen.update((value) => !value);
  }

  protected closeAccountMenu(): void {
    this.isAccountMenuOpen.set(false);
  }

  protected logout(): void {
    this.closeAccountMenu();
    this.authService.logout();
  }

  protected retryLoadWorkspaces(): void {
    this.loadWorkspaces();
  }

  private loadWorkspaces(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService
      .loadWorkspaces()
      .pipe(
        tap((workspaces) => {
          this.workspaces.set(workspaces);

          if (workspaces.length === 0) {
            this.authService.goToCreateWorkspace();
          }
        }),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        error: (err: Error) => this.errorMessage.set(err.message),
      });
  }

  protected selectWorkspace(membershipId: string): void {
    this.isSwitching.set(membershipId);
    this.errorMessage.set(null);

    this.authService
      .selectWorkspace(membershipId)
      .pipe(finalize(() => this.isSwitching.set(null)))
      .subscribe({
        next: () => {
          this.authService.goToDashboard();
        },
        error: (err: Error) => {
          this.errorMessage.set(err.message);
        },
      });
  }

  protected createNewWorkspace(): void {
    this.authService.goToCreateWorkspace();
  }

  protected workspaceInitial(workspace: WorkspaceInfo): string {
    return workspace.tenantName.charAt(0).toUpperCase();
  }

  protected accountInitial(): string {
    return (this.userEmail() || 'U').charAt(0).toUpperCase();
  }
}
