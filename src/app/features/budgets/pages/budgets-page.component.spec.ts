import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { DepartmentsApiService } from '../../departments/data/departments-api.service';
import { BudgetsApiService } from '../data/budgets-api.service';
import { BudgetsPageComponent } from './budgets-page.component';

describe('BudgetsPageComponent', () => {
  const workspaceState = signal({
    workspace: { tenantId: 'tenant-1' } as any,
    loading: false,
    error: null,
  });

  const budgetsApi = {
    getBudgetWorkspace: vi.fn(),
    createBudget: vi.fn(),
    updateBudget: vi.fn(),
    setBudgetEnforcementMode: vi.fn(),
    carryOverBudgets: vi.fn(),
  };

  const departmentsApi = {
    getDepartmentTree: vi.fn(),
  };

  const workspace = {
    summary: {
      periodLabel: 'Tháng 5/2026',
      totalAllocated: 50000000,
      totalCommitted: 8000000,
      totalSpent: 17000000,
      availablePool: 25000000,
      activeBudgetCount: 1,
      overBudgetCount: 0,
      committedDocumentCount: 3,
      paidDocumentCount: 12,
      allWithinBudget: true,
      currencyCode: 'VND',
      managerScopeDepartmentName: 'Kỹ thuật',
    },
    budgets: [
      {
        id: 'budget-engineering',
        departmentId: 'department-engineering',
        departmentName: 'Kỹ thuật',
        departmentPath: 'Meridian Corp › Kỹ thuật',
        periodLabel: 'Tháng 5/2026',
        allocatedAmount: 50000000,
        carryOverAmount: 0,
        committedAmount: 8000000,
        spentAmount: 17000000,
        availableAmount: 25000000,
        utilizationPct: 50,
        enforcementMode: 'SoftBlock',
        status: 'Healthy',
        isActive: true,
        updatedAt: '2026-05-19T10:00:00Z',
        activeExpenseCount: 12,
        committedDocumentCount: 3,
        paidDocumentCount: 12,
        setByName: 'Director Kim',
        setOn: '2026-05-01T00:00:00Z',
        currencyCode: 'VND',
        activity: [
          {
            id: 'activity-1',
            reference: 'EXP-2026-0184',
            employeeName: 'Nguyễn Văn An',
            amount: 2400000,
            state: 'Paid',
            date: '2026-05-19T00:00:00Z',
          },
        ],
        trend: [
          {
            monthLabel: 'Thg 5',
            allocatedAmount: 50000000,
            spentAmount: 17000000,
            committedAmount: 8000000,
          },
        ],
        audit: [
          {
            id: 'audit-1',
            type: 'created',
            title: 'Ngân sách đã được tạo',
            actorName: 'Director Kim',
            timestamp: '2026-05-01T09:12:00Z',
            detail: 'Cấp phát 50.000.000 ₫ cho kỳ này.',
          },
        ],
      },
    ],
    selectedBudget: null,
  };

  const createComponent = (): ComponentFixture<BudgetsPageComponent> => {
    const fixture = TestBed.createComponent(BudgetsPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    budgetsApi.getBudgetWorkspace.mockReset();
    budgetsApi.createBudget.mockReset();
    budgetsApi.updateBudget.mockReset();
    budgetsApi.setBudgetEnforcementMode.mockReset();
    budgetsApi.carryOverBudgets.mockReset();
    departmentsApi.getDepartmentTree.mockReset();
    budgetsApi.getBudgetWorkspace.mockReturnValue(of(workspace));
    budgetsApi.createBudget.mockReturnValue(of({ id: 'budget-finance' }));
    budgetsApi.updateBudget.mockReturnValue(of({ id: 'budget-engineering' }));
    budgetsApi.setBudgetEnforcementMode.mockReturnValue(of({ id: 'budget-engineering' }));
    budgetsApi.carryOverBudgets.mockReturnValue(of(1));
    departmentsApi.getDepartmentTree.mockReturnValue(
      of([
        {
          id: 'department-finance',
          name: 'Tài chính',
          parentId: null,
          isActive: true,
          memberCount: 3,
          childCount: 0,
          budgetUtilizationPct: null,
          children: [],
        },
      ]),
    );

    TestBed.configureTestingModule({
      imports: [BudgetsPageComponent],
      providers: [
        { provide: BudgetsApiService, useValue: budgetsApi },
        { provide: DepartmentsApiService, useValue: departmentsApi },
        { provide: CurrentWorkspaceFacade, useValue: { state: workspaceState.asReadonly() } },
      ],
    });
  });

  it('renders the MagicPath budget control workspace with cards and sticky detail', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Kiểm soát ngân sách');
    expect(text).toContain('Mô hình cấp phát 3 trạng thái');
    expect(text).toContain('Tháng 5/2026');
    expect(text).toContain('Tất cả phòng ban');
    expect(text).toContain('Chế độ kiểm soát');
    expect(text).toContain('Trạng thái');
    expect(text).toContain('Chuyển ngân sách từ tháng trước');
    expect(text).toContain('Tạo ngân sách');
    expect(text).toContain('Tổng đã cấp');
    expect(text).toContain('Đã cam kết');
    expect(text).toContain('Đã chi');
    expect(text).toContain('Còn khả dụng');
    expect(text).toContain('Kỹ thuật');
    expect(text).toContain('Tóm tắt');
    expect(text).toContain('Hoạt động');
    expect(text).toContain('Xu hướng');
    expect(text).toContain('Nhật ký');
    expect(text).toContain('EXP-2026-0184');
    expect(budgetsApi.getBudgetWorkspace).toHaveBeenCalledOnce();
  });

  it('saves new budgets, updates selected budget, and carries over through real mutations', () => {
    const fixture = createComponent();
    const root = fixture.nativeElement as HTMLElement;

    const createButton = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Tạo ngân sách'),
    ) as HTMLButtonElement;
    createButton.click();
    fixture.detectChanges();

    const departmentSelect = root.querySelector('[data-testid="budget-create-department"]') as HTMLSelectElement;
    const amountInput = root.querySelector('[data-testid="budget-create-amount"]') as HTMLInputElement;
    const enforcementSelect = root.querySelector('[data-testid="budget-create-enforcement"]') as HTMLSelectElement;
    departmentSelect.value = 'department-finance';
    departmentSelect.dispatchEvent(new Event('change'));
    amountInput.value = '25000000';
    amountInput.dispatchEvent(new Event('input'));
    enforcementSelect.value = 'HardBlock';
    enforcementSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    const saveCreateButton = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Lưu ngân sách'),
    ) as HTMLButtonElement;
    saveCreateButton.click();
    fixture.detectChanges();

    expect(budgetsApi.createBudget).toHaveBeenCalledWith({
      departmentId: 'department-finance',
      month: 5,
      year: 2026,
      amount: 25000000,
    });
    expect(budgetsApi.setBudgetEnforcementMode).toHaveBeenCalledWith({
      budgetId: 'budget-finance',
      mode: 'HardBlock',
    });

    const editButton = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Chỉnh sửa'),
    ) as HTMLButtonElement;
    editButton.click();
    fixture.detectChanges();

    const editAmount = root.querySelector('[data-testid="budget-edit-amount"]') as HTMLInputElement;
    editAmount.value = '55000000';
    editAmount.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const saveEditButton = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Lưu thay đổi'),
    ) as HTMLButtonElement;
    saveEditButton.click();
    fixture.detectChanges();

    expect(budgetsApi.updateBudget).toHaveBeenCalledWith({
      budgetId: 'budget-engineering',
      amount: 55000000,
    });

    const carryButton = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Chuyển ngân sách từ tháng trước'),
    ) as HTMLButtonElement;
    carryButton.click();
    fixture.detectChanges();

    const confirmCarryButton = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Xác nhận chuyển'),
    ) as HTMLButtonElement;
    confirmCarryButton.click();
    fixture.detectChanges();

    expect(budgetsApi.carryOverBudgets).toHaveBeenCalledWith({
      fromMonth: 4,
      fromYear: 2026,
      toMonth: 5,
      toYear: 2026,
      carryOverPercentage: 100,
    });
  });
});
