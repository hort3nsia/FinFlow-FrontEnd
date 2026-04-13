import { By } from '@angular/platform-browser';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { CreateWorkspacePageComponent } from './create-workspace-page.component';

describe('CreateWorkspacePageComponent', () => {
  const authService = {
    createWorkspace: vi.fn(),
    goToDashboard: vi.fn(),
  };

  beforeEach(() => {
    authService.createWorkspace.mockReset();
    authService.goToDashboard.mockReset();

    TestBed.configureTestingModule({
      imports: [CreateWorkspacePageComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });
  });

  it('creates the first workspace then enters the dashboard', () => {
    authService.createWorkspace.mockReturnValue(
      of({
        accessToken: 'workspace-access',
        refreshToken: 'workspace-refresh',
        id: 'account-1',
        membershipId: 'membership-1',
        email: 'demo@finflow.local',
        role: 'Owner',
        idTenant: 'tenant-1',
        sessionKind: 'workspace',
      }),
    );

    const fixture = TestBed.createComponent(CreateWorkspacePageComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance as CreateWorkspacePageComponent & {
      form: {
        setValue(value: { name: string; tenantCode: string; currency: string }): void;
      };
    };

    component.form.setValue({
      name: 'FinFlow Operations',
      tenantCode: 'finflow-ops',
      currency: 'VND',
    });

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit', {});

    expect(authService.createWorkspace).toHaveBeenCalledWith({
      name: 'FinFlow Operations',
      tenantCode: 'finflow-ops',
      currency: 'VND',
    });
    expect(authService.goToDashboard).toHaveBeenCalledTimes(1);
  });

  it('shows a backend error when workspace creation fails', () => {
    authService.createWorkspace.mockReturnValue(
      throwError(() => new Error('Tenant code is already taken')),
    );

    const fixture = TestBed.createComponent(CreateWorkspacePageComponent);
    fixture.detectChanges();

    const component = fixture.componentInstance as CreateWorkspacePageComponent & {
      form: {
        setValue(value: { name: string; tenantCode: string; currency: string }): void;
      };
    };

    component.form.setValue({
      name: 'FinFlow Operations',
      tenantCode: 'finflow-ops',
      currency: 'VND',
    });

    fixture.debugElement.query(By.css('form')).triggerEventHandler('ngSubmit', {});
    fixture.detectChanges();

    expect(authService.goToDashboard).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Tenant code is already taken');
  });
});
