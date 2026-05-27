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

interface TenantRow {
  tenantId: string;
  ownerEmail: string;
  ownerName: string;
  memberCount: number;
}

@Component({
  selector: 'app-admin-subscriptions',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      <header>
        <h1 class="text-2xl font-semibold text-slate-900">Quản lý Subscription</h1>
        <p class="mt-1 text-sm text-slate-500">
          Pause/resume/reactivate gói cho từng tenant.
        </p>
      </header>

      @if (isLoading()) {
        <p class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">Đang tải tenant…</p>
      } @else if (errorMessage()) {
        <div class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{{ errorMessage() }}</div>
      } @else {
        <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead class="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th class="px-4 py-2 font-medium">Tenant ID</th>
                  <th class="px-4 py-2 font-medium">Owner</th>
                  <th class="px-4 py-2 text-right font-medium">Thành viên</th>
                  <th class="px-4 py-2 font-medium">Hành động</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100">
                @for (t of tenants(); track t.tenantId) {
                  <tr>
                    <td class="px-4 py-2 font-mono text-xs text-slate-600">{{ t.tenantId }}</td>
                    <td class="px-4 py-2 text-slate-800">
                      <p class="font-medium">{{ t.ownerName || '—' }}</p>
                      <p class="text-xs text-slate-500">{{ t.ownerEmail }}</p>
                    </td>
                    <td class="px-4 py-2 text-right text-slate-700">{{ t.memberCount }}</td>
                    <td class="px-4 py-2">
                      <div class="flex flex-wrap gap-2">
                        <button
                          type="button"
                          class="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          [disabled]="actingId() === t.tenantId + ':pause'"
                          (click)="pauseTenant(t.tenantId)"
                        >
                          @if (actingId() === t.tenantId + ':pause') { Đang pause… } @else { Pause }
                        </button>
                        <button
                          type="button"
                          class="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                          [disabled]="actingId() === t.tenantId + ':resume'"
                          (click)="resumeTenant(t.tenantId)"
                        >
                          @if (actingId() === t.tenantId + ':resume') { Đang resume… } @else { Resume }
                        </button>
                        <button
                          type="button"
                          class="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 transition hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                          [disabled]="actingId() === t.tenantId + ':reactivate'"
                          (click)="reactivateTenant(t.tenantId)"
                        >
                          @if (actingId() === t.tenantId + ':reactivate') { Đang xử lý… } @else { Reactivate }
                        </button>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>

        @if (lastResult(); as result) {
          <div
            class="rounded-xl border p-3 text-sm"
            [ngClass]="result.success
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-rose-200 bg-rose-50 text-rose-700'"
          >
            <strong class="font-semibold">{{ result.success ? 'Thành công.' : 'Thất bại.' }}</strong>
            {{ result.message ?? '' }}
          </div>
        }
      }
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSubscriptionsComponent {
  private readonly api = inject(PlatformAdminApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly members = signal<PlatformMemberDto[]>([]);
  protected readonly actingId = signal<string | null>(null);
  protected readonly lastResult = signal<{ success: boolean; message: string | null } | null>(
    null,
  );

  protected readonly tenants = computed<TenantRow[]>(() => {
    const map = new Map<string, TenantRow>();
    for (const m of this.members()) {
      const row =
        map.get(m.tenantId) ??
        ({ tenantId: m.tenantId, ownerName: '', ownerEmail: '', memberCount: 0 } as TenantRow);
      row.memberCount++;
      if (m.isOwner) {
        row.ownerName = m.fullName ?? '';
        row.ownerEmail = m.email ?? '';
      }
      map.set(m.tenantId, row);
    }
    return Array.from(map.values()).sort((a, b) => b.memberCount - a.memberCount);
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

  protected pauseTenant(tenantId: string): void {
    this.runAction(tenantId, 'pause', this.api.pauseSubscription(tenantId));
  }
  protected resumeTenant(tenantId: string): void {
    this.runAction(tenantId, 'resume', this.api.resumeSubscription(tenantId));
  }
  protected reactivateTenant(tenantId: string): void {
    this.runAction(tenantId, 'reactivate', this.api.reactivateSubscription(tenantId));
  }

  private runAction(
    tenantId: string,
    action: string,
    obs: import('rxjs').Observable<{ success: boolean; message: string | null }>,
  ): void {
    this.actingId.set(`${tenantId}:${action}`);
    this.lastResult.set(null);
    obs.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (r) => {
        this.lastResult.set(r);
        this.actingId.set(null);
      },
      error: (err: Error) => {
        this.lastResult.set({ success: false, message: err.message });
        this.actingId.set(null);
      },
    });
  }
}
