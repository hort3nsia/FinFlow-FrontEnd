import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { routes } from './app.routes';
import { homeRouteGuard } from './core/guards/home-route.guard';
import { authGuard } from './core/guards/auth.guard';
import { workspaceGuard } from './core/guards/workspace.guard';
import { AuthService } from './core/auth/auth.service';
import { ApprovalsPageComponent } from './features/approvals/pages/approvals-page.component';
import { AppShellComponent } from './layout/app-shell/app-shell.component';
import { LandingPageComponent } from './features/marketing/pages/landing-page.component';
import { vi } from 'vitest';

describe('app routes', () => {
  it('defines guest landing, protected shell routes, approvals, and documents children', () => {
    const landingRoute = routes.find((route) => route.path === '');
    const homeRoute = routes.find((route) => route.path === 'home');
    const workspacesRoute = routes.find((route) => route.path === 'workspaces');
    const loginRoute = routes.find((route) => route.path === 'login');
    const registerRoute = routes.find((route) => route.path === 'register');
    const forgotPasswordRoute = routes.find((route) => route.path === 'forgot-password');
    const resetPasswordRoute = routes.find((route) => route.path === 'reset-password');
    const verifyEmailRoute = routes.find((route) => route.path === 'auth/verify-email');
    const appRoute = routes.find((route) => route.path === 'app');
    const wildcardRoute = routes.find((route) => route.path === '**');
    const dashboardChild = appRoute?.children?.find((route) => route.path === 'dashboard');
    const documentsRoute = appRoute?.children?.find((route) => route.path === 'documents');
    const approvalsChild = appRoute?.children?.find((route) => route.path === 'approvals');
    const documentsChildren = documentsRoute?.children ?? [];
    const documentsRedirect = documentsChildren.find((route) => route.path === '');
    const documentsList = documentsChildren.find((route) => route.path === 'list');
    const documentsUpload = documentsChildren.find((route) => route.path === 'upload');
    const documentsManual = documentsChildren.find((route) => route.path === 'manual');
    const documentDetail = documentsChildren.find((route) => route.path === ':id');

    expect(landingRoute).toBeDefined();
    expect(landingRoute?.component).toBe(LandingPageComponent);
    expect(landingRoute?.canActivate?.[0]).toBe(homeRouteGuard);

    expect(homeRoute).toBeDefined();
    expect(homeRoute?.redirectTo).toBe('workspaces');

    expect(workspacesRoute).toBeDefined();
    expect(workspacesRoute?.canActivate?.[0]).toBe(authGuard);

    expect(loginRoute).toBeDefined();
    expect(loginRoute?.canActivate?.length).toBe(1);

    expect(registerRoute).toBeDefined();
    expect(registerRoute?.canActivate?.length).toBe(1);

    expect(forgotPasswordRoute).toBeDefined();
    expect(forgotPasswordRoute?.canActivate?.length).toBe(1);

    expect(resetPasswordRoute).toBeDefined();

    expect(verifyEmailRoute).toBeDefined();
    expect(verifyEmailRoute?.canActivate).toBeUndefined();

    expect(appRoute).toBeDefined();
    expect(appRoute?.component).toBe(AppShellComponent);
    expect(appRoute?.canActivate?.length).toBe(2);
    expect(appRoute?.canActivate?.[0]).toBe(authGuard);
    expect(appRoute?.canActivate?.[1]).toBe(workspaceGuard);
    expect(dashboardChild).toBeDefined();
    expect(documentsRoute).toBeDefined();
    expect(documentsRedirect?.redirectTo).toBe('list');
    expect(documentsRedirect?.pathMatch).toBe('full');
    expect(documentsList).toBeDefined();
    expect(documentsUpload).toBeDefined();
    expect(documentsManual).toBeDefined();
    expect(documentDetail).toBeDefined();
    expect(approvalsChild).toBeDefined();
    expect(approvalsChild?.component).toBe(ApprovalsPageComponent);

    expect(wildcardRoute).toBeDefined();
  });
});

describe('homeRouteGuard', () => {
  const authService = {
    isAuthenticated: vi.fn(),
  };

  beforeEach(() => {
    authService.isAuthenticated.mockReset();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });
  });

  it('redirects authenticated users away from guest landing', () => {
    authService.isAuthenticated.mockReturnValue(true);

    const router = TestBed.inject(Router);
    const result = TestBed.runInInjectionContext(() =>
      homeRouteGuard({} as never, {} as never),
    );

    expect(router.serializeUrl(result as never)).toBe('/workspaces');
  });

  it('allows guests to see the landing page', () => {
    authService.isAuthenticated.mockReturnValue(false);

    const result = TestBed.runInInjectionContext(() =>
      homeRouteGuard({} as never, {} as never),
    );

    expect(result).toBe(true);
  });
});
