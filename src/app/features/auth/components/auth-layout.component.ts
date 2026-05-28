import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Shared auth layout with ProductContextPanel (left) + form slot (right).
 * Matches the MagicPath FinFlow Auth System design.
 */
@Component({
  selector: 'app-auth-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen w-full items-center justify-center bg-slate-50 px-4 py-8">
      <div class="mx-auto flex w-full max-w-5xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <!-- Product Context Panel (Left) -->
        <aside class="hidden h-auto w-[45%] flex-col border-r border-gray-100 bg-white px-10 py-12 md:flex">
          <!-- Brand -->
          <div class="mb-10">
            <div class="flex items-center gap-2">
              <span class="inline-flex h-5 w-5 items-center justify-center rounded-md bg-blue-600 text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" class="h-3 w-3">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
                  <polyline points="14 2 14 8 20 8" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
              <span class="text-[20px] font-bold tracking-tight text-slate-900">FinFlow</span>
            </div>
            <p class="mt-1.5 text-[13px] text-slate-500">Hệ thống quản lý chi phí &amp; hoàn tiền</p>
          </div>

          <!-- Approval timeline card -->
          <div class="mb-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div class="mb-3 flex items-start justify-between">
              <div>
                <p class="font-mono text-[11px] text-slate-400">EXP-2024-0039</p>
                <p class="mt-0.5 text-[13px] font-semibold text-slate-900">Vietnam Airlines · 24.600.000 ₫</p>
              </div>
              <span class="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Chờ xử lý</span>
            </div>
            <div class="mt-4 flex items-center">
              <div class="flex flex-col items-center">
                <span class="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="h-2.5 w-2.5 text-white"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <span class="mt-1.5 text-[10px] text-slate-500">Nộp</span>
              </div>
              <div class="mx-1 h-px flex-1 bg-emerald-500"></div>
              <div class="flex flex-col items-center">
                <span class="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="h-2.5 w-2.5 text-white"><polyline points="20 6 9 17 4 12"/></svg>
                </span>
                <span class="mt-1.5 text-[10px] text-slate-500">Duyệt</span>
              </div>
              <div class="mx-1 h-px flex-1 bg-gray-200"></div>
              <div class="flex flex-col items-center">
                <span class="relative flex h-4 w-4 items-center justify-center">
                  <span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-40"></span>
                  <span class="relative h-2.5 w-2.5 rounded-full bg-blue-600"></span>
                </span>
                <span class="mt-1.5 text-[10px] font-medium text-slate-900">Hoàn tiền</span>
              </div>
            </div>
          </div>

          <!-- Budget bar card -->
          <div class="mb-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p class="text-[11px] text-slate-400">Kỹ thuật · T5/2026</p>
            <div class="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-gray-200">
              <div class="h-full bg-emerald-500" style="width: 56%"></div>
              <div class="h-full bg-amber-400" style="width: 24%"></div>
            </div>
            <p class="mt-2 text-[11px] text-slate-500">
              80% · <span class="font-medium text-slate-700">10.000.000 ₫</span> còn lại
            </p>
          </div>

          <!-- Payment status chips -->
          <div class="mb-10 flex flex-wrap gap-2">
            <span class="inline-flex items-center gap-1.5 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
              <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>3 sẵn sàng
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700">
              <span class="h-1.5 w-1.5 rounded-full bg-blue-500"></span>5 đã lập lịch
            </span>
            <span class="inline-flex items-center gap-1.5 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[11px] font-medium text-red-700">
              <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>1 thất bại
            </span>
          </div>

          <!-- Trust indicators -->
          <div class="mt-auto space-y-3">
            <div class="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 shrink-0 text-emerald-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span class="text-[13px] text-slate-600">OCR tự động trích xuất hóa đơn</span>
            </div>
            <div class="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 shrink-0 text-emerald-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span class="text-[13px] text-slate-600">Kiểm soát ngân sách 3 trạng thái</span>
            </div>
            <div class="flex items-center gap-2.5">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 shrink-0 text-emerald-600"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
              <span class="text-[13px] text-slate-600">Audit log đầy đủ mọi thao tác</span>
            </div>
          </div>
        </aside>

        <!-- Form area (Right) -->
        <section class="flex w-full flex-col px-6 py-10 md:w-[55%] md:px-12 md:py-12">
          <div class="mx-auto w-full max-w-sm">
            <ng-content />
          </div>
        </section>
      </div>
    </div>
  `,
})
export class AuthLayoutComponent {}
