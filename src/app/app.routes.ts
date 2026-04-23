import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { homeRouteGuard } from './core/guards/home-route.guard';
import { guestGuard } from './core/guards/guest.guard';
import { noWorkspaceGuard, workspaceGuard } from './core/guards/workspace.guard';
import { LoginPageComponent } from './features/auth/pages/login/login-page.component';
import { ForgotPasswordPageComponent } from './features/auth/pages/forgot-password/forgot-password-page.component';
import { RegisterPageComponent } from './features/auth/pages/register/register-page.component';
import { ResetPasswordPageComponent } from './features/auth/pages/reset-password/reset-password-page.component';
import { VerifyEmailPageComponent } from './features/auth/pages/verify-email/verify-email-page.component';
import { CreateWorkspacePageComponent } from './features/auth/pages/create-workspace/create-workspace-page.component';
import { WorkspaceSelectionPageComponent } from './features/auth/pages/workspace-selection/workspace-selection-page.component';
import { ApprovalsPageComponent } from './features/approvals/pages/approvals-page.component';
import { DashboardPageComponent } from './features/dashboard/pages/dashboard-page.component';
import { documentsRoutes } from './features/documents/documents.routes';
import { LandingPageComponent } from './features/marketing/pages/landing-page.component';
import { NotFoundPageComponent } from './features/not-found/pages/not-found-page.component';
import { AppShellComponent } from './layout/app-shell/app-shell.component';

export const routes: Routes = [
  {
    path: '',
    canActivate: [homeRouteGuard],
    component: LandingPageComponent,
  },
  {
    path: 'home',
    pathMatch: 'full',
    redirectTo: 'workspaces',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    component: LoginPageComponent,
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    component: RegisterPageComponent,
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    component: ForgotPasswordPageComponent,
  },
  {
    path: 'reset-password',
    component: ResetPasswordPageComponent,
  },
  {
    path: 'auth/verify-email',
    component: VerifyEmailPageComponent,
  },
  {
    path: 'create-workspace',
    canActivate: [authGuard, noWorkspaceGuard],
    component: CreateWorkspacePageComponent,
  },
  {
    path: 'workspaces',
    canActivate: [authGuard],
    component: WorkspaceSelectionPageComponent,
  },
  {
    path: 'app',
    canActivate: [authGuard, workspaceGuard],
    component: AppShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        component: DashboardPageComponent,
      },
      {
        path: 'documents',
        children: documentsRoutes,
      },
      {
        path: 'approvals',
        component: ApprovalsPageComponent,
      },
    ],
  },
  {
    path: '**',
    component: NotFoundPageComponent,
  },
];
