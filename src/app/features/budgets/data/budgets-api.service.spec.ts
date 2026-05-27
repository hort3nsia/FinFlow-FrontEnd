import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { BudgetsApiService } from './budgets-api.service';

describe('BudgetsApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  it('queries the MagicPath-style budget workspace read model', () => {
    const service = TestBed.inject(BudgetsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);

    let result: unknown;
    service.getBudgetWorkspace(5, 2026, 'budget-engineering').subscribe((workspace) => {
      result = workspace;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.method).toBe('POST');
    expect(request.request.body.query).toContain('budgetWorkspace');
    expect(request.request.body.query).toContain('totalCommitted');
    expect(request.request.body.query).toContain('selectedBudget');
    expect(request.request.body.query).toContain('activity');
    expect(request.request.body.query).toContain('trend');
    expect(request.request.body.query).toContain('audit');
    expect(request.request.body.variables).toEqual({
      month: 5,
      year: 2026,
      selectedBudgetId: 'budget-engineering',
    });

    request.flush({
      data: {
        budgetWorkspace: {
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
            managerScopeDepartmentName: null,
          },
          budgets: [],
          selectedBudget: null,
        },
      },
    });

    expect(result).toEqual({
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
        managerScopeDepartmentName: null,
      },
      budgets: [],
      selectedBudget: null,
    });
    httpTesting.verify();
  });

  it('calls budget mutations with real GraphQL payloads', () => {
    const service = TestBed.inject(BudgetsApiService);
    const httpTesting = TestBed.inject(HttpTestingController);

    service.createBudget({
      departmentId: 'department-finance',
      month: 5,
      year: 2026,
      amount: 25000000,
    }).subscribe();

    let request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('mutation CreateBudget');
    expect(request.request.body.variables.input).toEqual({
      departmentId: 'department-finance',
      month: 5,
      year: 2026,
      amount: 25000000,
    });
    request.flush({ data: { createBudget: { id: 'budget-1' } } });

    service.updateBudget({
      budgetId: 'budget-1',
      amount: 30000000,
    }).subscribe();

    request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('mutation UpdateBudget');
    expect(request.request.body.variables.input).toEqual({
      budgetId: 'budget-1',
      amount: 30000000,
    });
    request.flush({ data: { updateBudget: { id: 'budget-1' } } });

    service.setBudgetEnforcementMode({
      budgetId: 'budget-1',
      mode: 'HardBlock',
    }).subscribe();

    request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('mutation SetBudgetEnforcementMode');
    expect(request.request.body.variables.input).toEqual({
      budgetId: 'budget-1',
      mode: 'HardBlock',
    });
    request.flush({ data: { setBudgetEnforcementMode: { id: 'budget-1' } } });

    service.carryOverBudgets({
      fromMonth: 4,
      fromYear: 2026,
      toMonth: 5,
      toYear: 2026,
      carryOverPercentage: 100,
    }).subscribe();

    request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('mutation CarryOverBudgets');
    expect(request.request.body.variables.input).toEqual({
      fromMonth: 4,
      fromYear: 2026,
      toMonth: 5,
      toYear: 2026,
      carryOverPercentage: 100,
    });
    request.flush({ data: { carryOverBudgets: 2 } });

    httpTesting.verify();
  });
});
