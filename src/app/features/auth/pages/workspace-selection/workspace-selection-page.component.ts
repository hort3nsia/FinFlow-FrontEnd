import { finalize, tap } from 'rxjs';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { WorkspaceInfo } from '../../../../core/auth/auth.models';
import { BrandMarkComponent } from '../../../../shared/ui/brand-mark/brand-mark.component';

@Component({
  selector: 'app-workspace-selection-page',
  standalone: true,
  imports: [BrandMarkComponent],
  templateUrl: './workspace-selection-page.component.html',
  styleUrl: './workspace-selection-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceSelectionPageComponent implements OnInit {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly workspaces = signal<WorkspaceInfo[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSwitching = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);

  ngOnInit(): void {
    this.loadWorkspaces();
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
        tap((ws) => this.workspaces.set(ws)),
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
      .switchWorkspace(membershipId)
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
    void this.router.navigateByUrl('/create-workspace');
  }
}
