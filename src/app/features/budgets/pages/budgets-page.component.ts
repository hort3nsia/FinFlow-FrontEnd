import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of, switchMap } from 'rxjs';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import {
  DepartmentsApiService,
  DepartmentTreeNodeResponse,
} from '../../departments/data/departments-api.service';
import {
  BudgetWorkspaceBudgetResponse,
  BudgetWorkspaceResponse,
  BudgetsApiService,
} from '../data/budgets-api.service';
import { createPagination } from '../../../shared/utils/pagination';

type DetailTab = 'summary' | 'activity' | 'trend' | 'audit';

interface DepartmentOption {
  id: string;
  name: string;
}

@Component({
  selector: 'app-budgets-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './budgets-page.component.html',
  styleUrl: './budgets-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BudgetsPageComponent {
  private readonly budgetsApi = inject(BudgetsApiService);
  private readonly departmentsApi = inject(DepartmentsApiService);
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);
  private readonly destroyRef = inject(DestroyRef);
  private lastAutoRefreshKey: string | null = null;

  protected readonly workspaceState = this.currentWorkspaceFacade.state;

  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly workspace = signal<BudgetWorkspaceResponse | null>(null);
  protected readonly searchQuery = signal('');
  protected readonly selectedBudgetId = signal<string | null>(null);
  protected readonly selectedMonth = signal(new Date().getMonth() + 1);
  protected readonly selectedYear = signal(new Date().getFullYear());
  protected readonly enforcementFilter = signal('Tất cả');
  protected readonly statusFilter = signal('Tất cả');
  protected readonly detailTab = signal<DetailTab>('summary');
  protected readonly showCreateModal = signal(false);
  protected readonly showCarryOverModal = signal(false);
  protected readonly departmentOptions = signal<DepartmentOption[]>([]);
  protected readonly isLoadingDepartments = signal(false);
  protected readonly createDepartmentId = signal('');
  protected readonly createAmount = signal('');
  protected readonly createEnforcementMode = signal('SoftBlock');
  protected readonly createError = signal<string | null>(null);
  protected readonly createSaving = signal(false);
  protected readonly editMode = signal(false);
  protected readonly editAmount = signal('');
  protected readonly editEnforcementMode = signal('SoftBlock');
  protected readonly editError = signal<string | null>(null);
  protected readonly editSaving = signal(false);
  protected readonly carryOverPercentage = signal('100');
  protected readonly carryError = signal<string | null>(null);
  protected readonly carrySaving = signal(false);
  protected readonly workflowMessage = signal<string | null>(null);
  protected readonly Math = Math;

  protected readonly months = Array.from({ length: 12 }, (_, index) => index + 1);
  protected readonly years = [2024, 2025, 2026].filter(
    (year) => year <= new Date().getFullYear() + 1,
  );
  protected readonly enforcementOptions = ['Tất cả', 'Theo dõi', 'Cảnh báo mềm', 'Chặn cứng'];
  protected readonly statusOptions = ['Tất cả', 'An toàn', 'Sắp giới hạn', 'Nguy cấp', 'Vượt ngân sách'];
  protected readonly detailTabs: { id: DetailTab; label: string }[] = [
    { id: 'summary', label: 'Tóm tắt' },
    { id: 'activity', label: 'Hoạt động' },
    { id: 'trend', label: 'Xu hướng' },
    { id: 'audit', label: 'Nhật ký' },
  ];

  protected readonly budgetCards = computed(() => this.workspace()?.budgets ?? []);

  protected readonly filteredBudgets = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    const enforcement = this.enforcementFilter();
    const status = this.statusFilter();

    return this.budgetCards().filter((budget) => {
      const matchesSearch =
        !query ||
        budget.departmentName.toLowerCase().includes(query) ||
        budget.departmentPath.toLowerCase().includes(query);
      const matchesEnforcement =
        enforcement === 'Tất cả' || this.enforcementLabel(budget.enforcementMode) === enforcement;
      const matchesStatus = status === 'Tất cả' || this.statusLabel(budget.status) === status;
      return matchesSearch && matchesEnforcement && matchesStatus;
    });
  });

  // ─── Pagination ─────────────────────────────────────────────────
  protected readonly budgetPagination = createPagination(this.filteredBudgets, 20);

  protected readonly selectedBudget = computed(() => {
    const id = this.selectedBudgetId();
    const cards = this.budgetCards();
    return (id ? cards.find((budget) => budget.id === id) : null)
      ?? this.workspace()?.selectedBudget
      ?? cards[0]
      ?? null;
  });

  constructor() {
    effect(() => {
      const tenantId = this.workspaceState().workspace?.tenantId;
      const month = this.selectedMonth();
      const year = this.selectedYear();
      if (tenantId) {
        this.refresh(month, year, false);
      }
    });
  }

  protected refresh(month = this.selectedMonth(), year = this.selectedYear(), force = true): void {
    const autoRefreshKey = `${month}-${year}`;
    if (!force && this.lastAutoRefreshKey === autoRefreshKey) {
      return;
    }
    if (!force) {
      this.lastAutoRefreshKey = autoRefreshKey;
    }

    this.isLoading.set(true);
    this.loadError.set(null);

    this.budgetsApi
      .getBudgetWorkspace(month, year, untracked(() => this.selectedBudgetId()))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (workspace) => {
          this.workspace.set(workspace);
          const currentSelected = this.selectedBudgetId();
          const exists = currentSelected
            ? workspace.budgets.some((budget) => budget.id === currentSelected)
            : false;
          if (!exists) {
            this.selectedBudgetId.set(workspace.selectedBudget?.id ?? workspace.budgets[0]?.id ?? null);
          }
          this.isLoading.set(false);
        },
        error: (error: Error) => {
          this.loadError.set(error.message);
          this.isLoading.set(false);
        },
      });
  }

  protected selectBudget(id: string): void {
    this.selectedBudgetId.set(id);
    this.detailTab.set('summary');
  }

  protected closeInspector(): void {
    this.selectedBudgetId.set(null);
  }

  protected setDetailTab(tab: DetailTab): void {
    this.detailTab.set(tab);
  }

  protected updateSearchQuery(query: string): void {
    this.searchQuery.set(query);
  }

  protected onMonthChange(value: string): void {
    const month = Number(value);
    if (!Number.isNaN(month)) {
      this.selectedMonth.set(month);
    }
  }

  protected onYearChange(value: string): void {
    const year = Number(value);
    if (!Number.isNaN(year)) {
      this.selectedYear.set(year);
    }
  }

  protected poolOf(budget: BudgetWorkspaceBudgetResponse): number {
    return budget.allocatedAmount + budget.carryOverAmount;
  }

  protected spentPct(budget: BudgetWorkspaceBudgetResponse): number {
    const pool = this.poolOf(budget);
    if (pool <= 0) return 0;
    return Math.min((budget.spentAmount / pool) * 100, 100);
  }

  protected committedPct(budget: BudgetWorkspaceBudgetResponse): number {
    const pool = this.poolOf(budget);
    if (pool <= 0) return 0;
    return Math.min((budget.committedAmount / pool) * 100, 100 - this.spentPct(budget));
  }

  protected formatMoney(value: number, currencyCode = this.workspace()?.summary.currencyCode ?? 'VND'): string {
    if (!Number.isFinite(value)) return '—';
    const amount = new Intl.NumberFormat('vi-VN', {
      maximumFractionDigits: currencyCode === 'VND' ? 0 : 2,
    }).format(Math.round(value));
    return currencyCode === 'VND' ? `₫${amount}` : `${amount} ${currencyCode}`;
  }

  protected formatDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  protected statusLabel(status: string): string {
    return {
      Healthy: 'An toàn',
      Approaching: 'Sắp giới hạn',
      Critical: 'Nguy cấp',
      Over: 'Vượt ngân sách',
      Archived: 'Đã lưu trữ',
    }[status] ?? status;
  }

  protected statusTone(status: string): 'healthy' | 'warning' | 'danger' | 'archived' {
    if (status === 'Archived') return 'archived';
    if (status === 'Over' || status === 'Critical') return 'danger';
    if (status === 'Approaching') return 'warning';
    return 'healthy';
  }

  protected enforcementLabel(mode: string): string {
    return {
      Off: 'Theo dõi',
      SoftBlock: 'Cảnh báo mềm',
      HardBlock: 'Chặn cứng',
    }[mode] ?? mode;
  }

  protected activityLabel(state: string): string {
    return {
      Approved: 'Đã duyệt',
      Paid: 'Đã thanh toán',
      Refunded: 'Hoàn tiền',
      Rejected: 'Từ chối',
      Draft: 'Bản nháp',
      Submitted: 'Đã gửi',
    }[state] ?? state;
  }

  protected openCreateModal(): void {
    this.createError.set(null);
    this.createAmount.set('');
    this.createEnforcementMode.set('SoftBlock');
    this.workflowMessage.set(null);
    this.showCreateModal.set(true);
    this.loadDepartmentOptions();
  }

  protected openCarryOverModal(): void {
    this.carryError.set(null);
    this.carryOverPercentage.set('100');
    this.workflowMessage.set(null);
    this.showCarryOverModal.set(true);
  }

  protected closeModal(): void {
    this.showCreateModal.set(false);
    this.showCarryOverModal.set(false);
    this.createSaving.set(false);
    this.carrySaving.set(false);
    this.createError.set(null);
    this.carryError.set(null);
  }

  protected updateCreateDepartmentId(value: string): void {
    this.createDepartmentId.set(value);
  }

  protected updateCreateAmount(value: string): void {
    this.createAmount.set(value);
  }

  protected updateCreateEnforcementMode(value: string): void {
    this.createEnforcementMode.set(value);
  }

  protected updateEditAmount(value: string): void {
    this.editAmount.set(value);
  }

  protected updateEditEnforcementMode(value: string): void {
    this.editEnforcementMode.set(value);
  }

  protected updateCarryOverPercentage(value: string): void {
    this.carryOverPercentage.set(value);
  }

  protected openEditMode(budget: BudgetWorkspaceBudgetResponse): void {
    this.editMode.set(true);
    this.editError.set(null);
    this.editAmount.set(String(Math.round(budget.allocatedAmount)));
    this.editEnforcementMode.set(budget.enforcementMode);
  }

  protected cancelEditMode(): void {
    this.editMode.set(false);
    this.editError.set(null);
  }

  protected saveCreateBudget(): void {
    const departmentId = this.createDepartmentId();
    const amount = this.parseAmount(this.createAmount());
    if (!departmentId) {
      this.createError.set('Vui lòng chọn phòng ban.');
      return;
    }
    if (amount <= 0) {
      this.createError.set('Số tiền cấp phát phải lớn hơn 0.');
      return;
    }

    this.createSaving.set(true);
    this.createError.set(null);
    this.budgetsApi
      .createBudget({
        departmentId,
        month: this.selectedMonth(),
        year: this.selectedYear(),
        amount,
      })
      .pipe(
        switchMap((createdBudget) => {
          const mode = this.createEnforcementMode();
          return mode === 'SoftBlock'
            ? of(createdBudget)
            : this.budgetsApi.setBudgetEnforcementMode({
                budgetId: createdBudget.id,
                mode,
              });
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.createSaving.set(false);
          this.closeModal();
          this.workflowMessage.set('Đã tạo ngân sách từ dữ liệu backend.');
          this.refresh();
        },
        error: (error: Error) => {
          this.createError.set(error.message);
          this.createSaving.set(false);
        },
      });
  }

  protected saveBudgetChanges(budget: BudgetWorkspaceBudgetResponse): void {
    const amount = this.parseAmount(this.editAmount());
    if (amount <= 0) {
      this.editError.set('Số tiền cấp phát phải lớn hơn 0.');
      return;
    }

    const mode = this.editEnforcementMode();
    this.editSaving.set(true);
    this.editError.set(null);

    forkJoin({
      budget: this.budgetsApi.updateBudget({ budgetId: budget.id, amount }),
      mode:
        mode !== budget.enforcementMode
          ? this.budgetsApi.setBudgetEnforcementMode({ budgetId: budget.id, mode })
          : of(null),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.editSaving.set(false);
          this.editMode.set(false);
          this.workflowMessage.set('Đã cập nhật ngân sách từ backend.');
          this.refresh();
        },
        error: (error: Error) => {
          this.editError.set(error.message);
          this.editSaving.set(false);
        },
      });
  }

  protected confirmCarryOver(): void {
    const percentage = Number(this.carryOverPercentage());
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      this.carryError.set('Tỷ lệ chuyển tiếp phải nằm trong khoảng 0-100%.');
      return;
    }

    const previous = this.previousPeriod(this.selectedMonth(), this.selectedYear());
    this.carrySaving.set(true);
    this.carryError.set(null);

    this.budgetsApi
      .carryOverBudgets({
        fromMonth: previous.month,
        fromYear: previous.year,
        toMonth: this.selectedMonth(),
        toYear: this.selectedYear(),
        carryOverPercentage: percentage,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (count) => {
          this.carrySaving.set(false);
          this.closeModal();
          this.workflowMessage.set(`Đã chuyển ${count} ngân sách từ kỳ trước.`);
          this.refresh();
        },
        error: (error: Error) => {
          this.carryError.set(error.message);
          this.carrySaving.set(false);
        },
      });
  }

  private loadDepartmentOptions(): void {
    if (this.departmentOptions().length || this.isLoadingDepartments()) return;

    this.isLoadingDepartments.set(true);
    this.departmentsApi
      .getDepartmentTree()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (nodes) => {
          const options = this.flattenDepartments(nodes);
          this.departmentOptions.set(options);
          if (!this.createDepartmentId() && options[0]) {
            this.createDepartmentId.set(options[0].id);
          }
          this.isLoadingDepartments.set(false);
        },
        error: (error: Error) => {
          this.createError.set(error.message);
          this.isLoadingDepartments.set(false);
        },
      });
  }

  private flattenDepartments(nodes: DepartmentTreeNodeResponse[]): DepartmentOption[] {
    const result: DepartmentOption[] = [];
    const visit = (node: DepartmentTreeNodeResponse, depth: number) => {
      if (node.isActive) {
        result.push({ id: node.id, name: `${'— '.repeat(depth)}${node.name}` });
      }
      for (const child of node.children ?? []) {
        visit(child, depth + 1);
      }
    };
    for (const node of nodes) {
      visit(node, 0);
    }
    return result;
  }

  private parseAmount(value: string): number {
    const normalized = value.replace(/[^\d.-]/g, '');
    const amount = Number(normalized);
    return Number.isFinite(amount) ? amount : 0;
  }

  private previousPeriod(month: number, year: number): { month: number; year: number } {
    if (month === 1) {
      return { month: 12, year: year - 1 };
    }
    return { month: month - 1, year };
  }
}
