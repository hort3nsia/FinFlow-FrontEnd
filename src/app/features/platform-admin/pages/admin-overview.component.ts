import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import {
  PlatformAdminApiService,
  PlatformMemberDto,
} from '../data/platform-admin-api.service';

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="space-y-6">
      <header>
        <h1 class="text-2xl font-semibold text-slate-900">Tổng quan nền tảng</h1>
        <p class="mt-1 text-sm text-slate-500">
          Số liệu tổng hợp toàn hệ thống FinFlow.
        </p>
      </header>

      @if (isLoading()) {
        <p class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          Đang tải dữ liệu…
        </p>
      } @else if (errorMessage()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {{ errorMessage() }}
        </div>
      } @else {
        <section class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-sm font-medium text-slate-500">Số tenant</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ tenantCount() }}</p>
          </article>
          <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-sm font-medium text-slate-500">Tổng thành viên</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ members().length }}</p>
          </article>
          <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-sm font-medium text-slate-500">Owner đang hoạt động</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ ownerCount() }}</p>
          </article>
          <article class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-sm font-medium text-slate-500">SuperAdmin</p>
            <p class="mt-2 text-2xl font-semibold text-slate-900">{{ superAdminCount() }}</p>
          </article>
        </section>

        <section class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 class="mb-3 text-base font-semibold text-slate-900">Phân bổ vai trò</h2>
          <div class="space-y-2">
            @for (entry of roleBreakdown(); track entry.role) {
              <div>
                <div class="flex items-center justify-between text-sm">
                  <span class="font-medium text-slate-700">{{ entry.role }}</span>
                  <span class="text-slate-500">{{ entry.count }} người</span>
                </div>
                <div class="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div class="h-full rounded-full bg-indigo-500" [style.width.%]="entry.percent"></div>
                </div>
              </div>
            }
          </div>
        </section>
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOverviewComponent {
  private readonly api = inject(PlatformAdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly members = signal<PlatformMemberDto[]>([]);

  protected readonly tenantCount = computed(() => {
    const set = new Set(this.members().map((m) => m.tenantId));
    return set.size;
  });
  protected readonly ownerCount = computed(
    () => this.members().filter((m) => m.isOwner).length,
  );
  protected readonly superAdminCount = computed(
    () =>
      this.members().filter((m) => (m.role || '').toLowerCase().includes('superadmin')).length,
  );

  protected readonly roleBreakdown = computed(() => {
    const total = this.members().length || 1;
    const counts = new Map<string, number>();
    for (const m of this.members()) {
      const role = m.role || 'Unknown';
      counts.set(role, (counts.get(role) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([role, count]) => ({ role, count, percent: Math.round((count / total) * 100) }))
      .sort((a, b) => b.count - a.count);
  });

  constructor() {
    this.refresh();
  }

  protected refresh(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.api
      .getMembers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (members) => {
          this.members.set(members);
          this.isLoading.set(false);
        },
        error: (err: Error) => {
          this.errorMessage.set(err.message);
          this.isLoading.set(false);
        },
      });
  }
}
