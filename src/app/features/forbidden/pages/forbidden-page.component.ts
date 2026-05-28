import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';

@Component({
  selector: 'app-forbidden-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <section
        class="w-full max-w-md rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center shadow-sm"
        data-testid="forbidden-page"
      >
        <div class="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            class="h-7 w-7"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
          </svg>
        </div>
        <h1 class="mt-5 text-2xl font-semibold text-slate-900">403 — Bạn không có quyền truy cập</h1>
        <p class="mt-2 text-sm text-slate-600">
          Vai trò
          <span class="font-semibold text-slate-800">{{ roleLabel() }}</span>
          không được phép sử dụng trang này. Liên hệ Tenant Admin nếu bạn cần quyền truy cập.
        </p>
        <div class="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
          <a
            routerLink="/app/dashboard"
            class="inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Về Dashboard
          </a>
          <button
            type="button"
            class="inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            (click)="goBack()"
          >
            Quay lại trang trước
          </button>
        </div>
      </section>
    </main>
  `,
})
export class ForbiddenPageComponent {
  private readonly router = inject(Router);
  private readonly workspaceFacade = inject(CurrentWorkspaceFacade);

  protected readonly roleLabel = computed(() => {
    const role = this.workspaceFacade.state().workspace?.role?.toString() ?? '';
    if (!role) return 'Thành viên';
    const normalized = role.toLowerCase().replace(/[\s_-]+/g, '');
    if (normalized.includes('superadmin')) return 'Super Admin';
    if (normalized.includes('tenantadmin') || normalized.includes('owner')) return 'Tenant Admin';
    if (normalized.includes('accountant')) return 'Kế toán';
    if (normalized.includes('manager')) return 'Quản lý';
    if (normalized.includes('staff') || normalized.includes('employee')) return 'Nhân viên';
    return role;
  });

  protected goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      void this.router.navigateByUrl('/app/dashboard');
    }
  }
}
