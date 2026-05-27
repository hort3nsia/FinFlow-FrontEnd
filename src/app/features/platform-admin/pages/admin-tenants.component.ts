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
import { FormsModule } from '@angular/forms';
import {
  PlatformAdminApiService,
  PlatformMemberDto,
} from '../data/platform-admin-api.service';

interface TenantSummary {
  tenantId: string;
  ownerName: string;
  ownerEmail: string;
  memberCount: number;
  activeCount: number;
  hasSuperAdmin: boolean;
}

@Component({
  selector: 'app-admin-tenants',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      <header class="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">Tenants &amp; Members</h1>
          <p class="mt-1 text-sm text-slate-500">Toàn bộ thành viên trên hệ thống FinFlow.</p>
        </div>
        <input
          type="search"
          class="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 lg:w-72"
          placeholder="Tìm theo email, tên, vai trò…"
          [ngModel]="searchQuery()"
          (ngModelChange)="searchQuery.set($event)"
        />
      </header>

      @if (isLoading()) {
        <p class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang tải…</p>
      } @else if (errorMessage()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{{ errorMessage() }}</div>
      } @else {
        <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
          <header class="border-b border-slate-100 px-5 py-3">
            <h2 class="text-sm font-semibold text-slate-900">Tenants ({{ tenantSummaries().length }})</h2>
          </header>
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-4 py-2 font-medium">Tenant ID</th>
                  <th class="px-4 py-2 font-medium">Owner</th>
                  <th class="px-4 py-2 text-right font-medium">Thành viên</th>
                  <th class="px-4 py-2 text-right font-medium">Đang hoạt động</th>
                  <th class="px-4 py-2 font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (t of tenantSummaries(); track t.tenantId) {
                  <tr>
                    <td class="px-4 py-2 font-mono text-xs text-slate-600">{{ t.tenantId.slice(0, 8) }}…</td>
                    <td class="px-4 py-2 text-slate-800">
                      <p class="font-medium">{{ t.ownerName || '—' }}</p>
                      <p class="text-xs text-slate-500">{{ t.ownerEmail || '—' }}</p>
                    </td>
                    <td class="px-4 py-2 text-right text-slate-700">{{ t.memberCount }}</td>
                    <td class="px-4 py-2 text-right text-slate-700">{{ t.activeCount }}</td>
                    <td class="px-4 py-2">
                      <button
                        type="button"
                        class="rounded-md border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        (click)="setSelectedTenant(t.tenantId)"
                      >
                        Xem thành viên
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        @if (selectedTenantId()) {
          <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
            <header class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
              <h2 class="text-sm font-semibold text-slate-900">
                Thành viên của {{ selectedTenantId()?.slice(0, 8) }}…
              </h2>
              <button
                type="button"
                class="text-xs font-medium text-indigo-600 hover:underline"
                (click)="setSelectedTenant(null)"
              >
                Bỏ chọn
              </button>
            </header>
            <div class="overflow-x-auto">
              <table class="min-w-full text-sm">
                <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th class="px-4 py-2 font-medium">Họ tên</th>
                    <th class="px-4 py-2 font-medium">Email</th>
                    <th class="px-4 py-2 font-medium">Phòng ban</th>
                    <th class="px-4 py-2 font-medium">Vai trò</th>
                    <th class="px-4 py-2 font-medium">Trạng thái</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  @for (m of selectedTenantMembers(); track m.id) {
                    <tr>
                      <td class="px-4 py-2 text-slate-800">{{ m.fullName || '—' }}</td>
                      <td class="px-4 py-2 text-slate-600">{{ m.email || '—' }}</td>
                      <td class="px-4 py-2 text-slate-600">{{ m.departmentName || '—' }}</td>
                      <td class="px-4 py-2">
                        <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                          {{ m.role }}
                          @if (m.isOwner) {
                            <span class="ml-1 text-amber-600">(Owner)</span>
                          }
                        </span>
                      </td>
                      <td class="px-4 py-2">
                        <span
                          class="rounded-full px-2 py-0.5 text-xs font-medium"
                          [ngClass]="m.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'"
                        >
                          {{ m.isActive ? 'Hoạt động' : 'Vô hiệu' }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </section>
        }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminTenantsComponent {
  private readonly api = inject(PlatformAdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly members = signal<PlatformMemberDto[]>([]);
  protected readonly searchQuery = signal('');
  protected readonly selectedTenantId = signal<string | null>(null);

  protected readonly filteredMembers = computed(() => {
    const q = this.searchQuery().trim().toLowerCase();
    if (!q) return this.members();
    return this.members().filter((m) =>
      `${m.fullName ?? ''} ${m.email ?? ''} ${m.role ?? ''}`.toLowerCase().includes(q),
    );
  });

  protected readonly tenantSummaries = computed<TenantSummary[]>(() => {
    const map = new Map<string, TenantSummary>();
    for (const m of this.filteredMembers()) {
      const cur =
        map.get(m.tenantId) ??
        ({
          tenantId: m.tenantId,
          ownerName: '',
          ownerEmail: '',
          memberCount: 0,
          activeCount: 0,
          hasSuperAdmin: false,
        } as TenantSummary);
      cur.memberCount++;
      if (m.isActive) cur.activeCount++;
      if (m.isOwner) {
        cur.ownerName = m.fullName ?? '';
        cur.ownerEmail = m.email ?? '';
      }
      if ((m.role || '').toLowerCase().includes('superadmin')) cur.hasSuperAdmin = true;
      map.set(m.tenantId, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.memberCount - a.memberCount);
  });

  protected readonly selectedTenantMembers = computed(() => {
    const id = this.selectedTenantId();
    if (!id) return [];
    return this.members().filter((m) => m.tenantId === id);
  });

  constructor() {
    this.refresh();
  }

  protected setSelectedTenant(tenantId: string | null): void {
    this.selectedTenantId.set(tenantId);
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
