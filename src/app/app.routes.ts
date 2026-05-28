import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { homeRouteGuard } from './core/guards/home-route.guard';
import { guestGuard } from './core/guards/guest.guard';
import { noWorkspaceGuard, workspaceGuard } from './core/guards/workspace.guard';
import { superAdminGuard } from './core/guards/superadmin.guard';
import { chatbotGuard, paidPlanGuard } from './core/guards/subscription-feature.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    canActivate: [homeRouteGuard],
    loadComponent: () =>
      import('./features/marketing/pages/landing-page.component').then(
        (module) => module.LandingPageComponent,
      ),
  },
  {
    path: 'home',
    pathMatch: 'full',
    redirectTo: 'workspaces',
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/login/login-page.component').then(
        (module) => module.LoginPageComponent,
      ),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/register/register-page.component').then(
        (module) => module.RegisterPageComponent,
      ),
  },
  {
    path: 'forgot-password',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./features/auth/pages/forgot-password/forgot-password-page.component').then(
        (module) => module.ForgotPasswordPageComponent,
      ),
  },
  {
    path: 'reset-password',
    loadComponent: () =>
      import('./features/auth/pages/reset-password/reset-password-page.component').then(
        (module) => module.ResetPasswordPageComponent,
      ),
  },
  {
    path: 'auth/verify-email',
    loadComponent: () =>
      import('./features/auth/pages/verify-email/verify-email-page.component').then(
        (module) => module.VerifyEmailPageComponent,
      ),
  },
  {
    path: 'create-workspace',
    canActivate: [authGuard, noWorkspaceGuard],
    loadComponent: () =>
      import('./features/auth/pages/create-workspace/create-workspace-page.component').then(
        (module) => module.CreateWorkspacePageComponent,
      ),
  },
  {
    path: 'workspaces',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/auth/pages/workspace-selection/workspace-selection-page.component').then(
        (module) => module.WorkspaceSelectionPageComponent,
      ),
  },
  {
    path: 'app',
    canActivate: [authGuard, workspaceGuard],
    loadComponent: () =>
      import('./layout/app-shell/app-shell.component').then(
        (module) => module.AppShellComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/pages/dashboard-page.component').then(
            (module) => module.DashboardPageComponent,
          ),
      },
      {
        path: 'documents',
        loadChildren: () =>
          import('./features/documents/documents.routes').then(
            (module) => module.documentsRoutes,
          ),
      },
      {
        path: 'approvals',
        canActivate: [roleGuard(['TenantAdmin', 'Manager'])],
        loadComponent: () =>
          import('./features/approvals/pages/approvals-page.component').then(
            (module) => module.ApprovalsPageComponent,
          ),
      },
      {
        path: 'payments',
        canActivate: [roleGuard(['TenantAdmin', 'Accountant'])],
        loadComponent: () =>
          import('./features/payments/pages/payments-page.component').then(
            (module) => module.PaymentsPageComponent,
          ),
      },
      {
        path: 'members',
        canActivate: [roleGuard(['TenantAdmin', 'Manager', 'Accountant'])],
        loadComponent: () =>
          import('./features/members/pages/members-page.component').then(
            (module) => module.MembersPageComponent,
          ),
      },
      {
        path: 'departments',
        canActivate: [roleGuard(['TenantAdmin', 'Manager', 'Accountant'])],
        loadComponent: () =>
          import('./features/departments/pages/departments-page.component').then(
            (module) => module.DepartmentsPageComponent,
          ),
      },
      {
        path: 'budgets',
        canActivate: [roleGuard(['TenantAdmin', 'Manager', 'Accountant'])],
        loadComponent: () =>
          import('./features/budgets/pages/budgets-page.component').then(
            (module) => module.BudgetsPageComponent,
          ),
      },
      {
        path: 'vendors',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },
      {
        path: 'subscription',
        loadComponent: () =>
          import('./features/subscription/pages/subscription-page.component').then(
            (module) => module.SubscriptionPageComponent,
          ),
      },
      {
        path: 'reports',
        canActivate: [paidPlanGuard, roleGuard(['TenantAdmin', 'Manager', 'Accountant'])],
        loadComponent: () =>
          import('./features/reporting/pages/reporting-page.component').then(
            (module) => module.ReportingPageComponent,
          ),
      },
      {
        path: 'profile',
        loadComponent: () =>
          import('./features/profile/pages/profile-page.component').then(
            (module) => module.ProfilePageComponent,
          ),
      },
      {
        path: 'settings',
        canActivate: [roleGuard(['TenantAdmin'])],
        loadComponent: () =>
          import('./features/settings/pages/settings-page.component').then(
            (module) => module.SettingsPageComponent,
          ),
      },
      {
        path: 'forbidden',
        loadComponent: () =>
          import('./features/forbidden/pages/forbidden-page.component').then(
            (module) => module.ForbiddenPageComponent,
          ),
      },
      {
        path: 'chat',
        canActivate: [chatbotGuard],
        loadComponent: () =>
          import('./features/chat/pages/chat-page.component').then(
            (module) => module.ChatPageComponent,
          ),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard, workspaceGuard, superAdminGuard],
    loadComponent: () =>
      import('./features/platform-admin/layout/platform-admin-shell.component').then(
        (module) => module.PlatformAdminShellComponent,
      ),
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'overview',
      },
      {
        path: 'overview',
        loadComponent: () =>
          import('./features/platform-admin/pages/admin-overview.component').then(
            (module) => module.AdminOverviewComponent,
          ),
      },
      {
        path: 'tenants',
        loadComponent: () =>
          import('./features/platform-admin/pages/admin-tenants.component').then(
            (module) => module.AdminTenantsComponent,
          ),
      },
      {
        path: 'subscriptions',
        loadComponent: () =>
          import('./features/platform-admin/pages/admin-subscriptions.component').then(
            (module) => module.AdminSubscriptionsComponent,
          ),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () =>
      import('./features/not-found/pages/not-found-page.component').then(
        (module) => module.NotFoundPageComponent,
      ),
  },
];

