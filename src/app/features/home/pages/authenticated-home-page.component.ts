import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { WorkspaceInfo } from '../../../core/auth/auth.models';
import { AuthService } from '../../../core/auth/auth.service';
import { BrandMarkComponent } from '../../../shared/ui/brand-mark/brand-mark.component';

@Component({
  selector: 'app-authenticated-home-page',
  standalone: true,
  imports: [RouterLink, BrandMarkComponent],
  templateUrl: './authenticated-home-page.component.html',
  styleUrl: './authenticated-home-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthenticatedHomePageComponent implements OnInit {
  private readonly authService = inject(AuthService);

  protected readonly workspaces = this.authService.workspaces;
  protected readonly workspaceCount = this.authService.workspaceCount;
  protected readonly hasSingleWorkspace = this.authService.hasSingleWorkspace;
  protected readonly hasMultipleWorkspaces = this.authService.hasMultipleWorkspaces;
  protected readonly hasNoWorkspaces = this.authService.hasNoWorkspaces;
  protected readonly primaryWorkspace = this.authService.primaryWorkspace;
  protected readonly isLoading = this.authService.isLoading;
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly switchingWorkspaceId = signal<string | null>(null);

  ngOnInit(): void {
    this.loadWorkspaces();
  }

  protected retryLoadWorkspaces(): void {
    this.loadWorkspaces();
  }

  protected goToWorkspaceSelection(): void {
    this.authService.goToWorkspaceSelection();
  }

  protected goToCreateWorkspace(): void {
    this.authService.goToCreateWorkspace();
  }

  protected continueToPrimaryWorkspace(): void {
    const workspace = this.primaryWorkspace();

    if (!workspace) {
      return;
    }

    this.switchingWorkspaceId.set(workspace.membershipId);
    this.errorMessage.set(null);

    this.authService
      .switchWorkspace(workspace.membershipId)
      .pipe(finalize(() => this.switchingWorkspaceId.set(null)))
      .subscribe({
        next: () => this.authService.goToDashboard(),
        error: (error: Error) => this.errorMessage.set(error.message),
      });
  }

  protected workspaceInitial(workspace: WorkspaceInfo): string {
    return workspace.tenantCode.charAt(0).toUpperCase();
  }

  protected roleLabel(role: string): string {
    const normalizedRole = role.toLowerCase();

    if (normalizedRole.includes('owner')) {
      return 'Chủ workspace';
    }

    if (normalizedRole.includes('admin')) {
      return 'Quản trị';
    }

    return 'Nhân viên';
  }

  protected workspaceSummary(workspace: WorkspaceInfo): string {
    return `${workspace.tenantCode} · ${this.roleLabel(workspace.role)}`;
  }

  private loadWorkspaces(): void {
    this.errorMessage.set(null);

    this.authService.loadWorkspaces().subscribe({
      error: (error: Error) => this.errorMessage.set(error.message),
    });
  }
}
