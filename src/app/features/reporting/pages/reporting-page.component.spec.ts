import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApprovalsApiService } from '../../approvals/data/approvals-api.service';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { ReportingApiService } from '../data/reporting-api.service';
import { ReportingPageComponent } from './reporting-page.component';

describe('ReportingPageComponent', () => {
  let printSpy: ReturnType<typeof vi.spyOn>;

  const workspaceState = signal({
    workspace: {
      accountId: 'account-1',
      email: 'director.kim@meridian.test',
      membershipId: 'membership-1',
      role: 'TenantAdmin',
      tenantId: 'tenant-1',
      tenantCode: 'meridian',
      tenantName: 'Meridian Corp',
    },
    loading: false,
    error: null,
  });

  const reportingApi = {
    expenseSummary: vi.fn(),
    budgetUtilization: vi.fn(),
    topEmployees: vi.fn(),
    pendingPaymentQueue: vi.fn(),
    monthlyTrend: vi.fn(),
  };

  const approvalsApi = {
    getApprovalQueue: vi.fn(),
  };

  const createComponent = (): ComponentFixture<ReportingPageComponent> => {
    const fixture = TestBed.createComponent(ReportingPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    printSpy = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    reportingApi.expenseSummary.mockReset();
    reportingApi.budgetUtilization.mockReset();
    reportingApi.topEmployees.mockReset();
    reportingApi.pendingPaymentQueue.mockReset();
    reportingApi.monthlyTrend.mockReset();
    approvalsApi.getApprovalQueue.mockReset();

    reportingApi.expenseSummary.mockReturnValue(
      of({
        expenseCount: 0,
        totalInBaseCurrency: 0,
        baseCurrencyCode: 'VND',
        byCategory: [],
        byDepartment: [],
        byCurrency: [],
      }),
    );
    reportingApi.budgetUtilization.mockReturnValue(of([]));
    reportingApi.topEmployees.mockReturnValue(of([]));
    reportingApi.pendingPaymentQueue.mockReturnValue(of([]));
    reportingApi.monthlyTrend.mockReturnValue(of([]));
    approvalsApi.getApprovalQueue.mockReturnValue(
      of({
        items: [
          {
            documentId: 'document-1',
            title: 'BÁCH HÓA XANH · 21070052990051966',
            vendorName: 'BÁCH HÓA XANH',
            requester: 'Director Kim',
            requesterEmail: 'director.kim@meridian.test',
            department: 'Finance',
            amount: 187954,
            currency: 'VND',
            expenseDate: '2021-07-16',
            submittedAt: '2026-04-24T16:46:00Z',
            priority: 'Medium',
            status: 'ReadyForApproval',
            policySummary: 'Auto-approved by amount policy',
          },
          {
            documentId: 'document-2',
            title: 'BÁCH HÓA XANH · 21070052990051966',
            vendorName: 'BÁCH HÓA XANH',
            requester: 'Director Kim',
            requesterEmail: 'director.kim@meridian.test',
            department: 'Finance',
            amount: 187954,
            currency: 'VND',
            expenseDate: '2021-07-16',
            submittedAt: '2026-04-24T16:41:00Z',
            priority: 'Medium',
            status: 'ReadyForApproval',
            policySummary: null,
          },
          {
            documentId: 'document-3',
            title: 'abc · abc',
            vendorName: 'abc',
            requester: 'loin2181',
            requesterEmail: 'loin2181@gmail.com',
            department: 'Department unavailable',
            amount: 0.1,
            currency: 'VND',
            expenseDate: '1111-11-11',
            submittedAt: '2026-04-29T17:50:00Z',
            priority: 'Low',
            status: 'ReadyForApproval',
            policySummary: 'Auto-approved',
          },
        ],
        page: 1,
        pageSize: 20,
        totalCount: 3,
        totalPages: 1,
      }),
    );

    TestBed.configureTestingModule({
      imports: [ReportingPageComponent],
      providers: [
        provideRouter([]),
        { provide: CurrentWorkspaceFacade, useValue: { state: workspaceState.asReadonly() } },
        { provide: ReportingApiService, useValue: reportingApi },
        { provide: ApprovalsApiService, useValue: approvalsApi },
      ],
    });
  });

  afterEach(() => {
    printSpy.mockRestore();
  });

  it('renders MagicPath-style reporting workspace with real approval pipeline data', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(approvalsApi.getApprovalQueue).toHaveBeenCalledWith('PENDING', null, 1, 20);
    expect(text).toContain('Báo cáo & Phân tích');
    expect(text).toContain('Tháng này');
    expect(text).toContain('Tất cả phòng ban');
    expect(text).toContain('Đang chờ hoàn tiền');
    expect(text).toContain('375.908 ₫');
    expect(text).toContain('3 chứng từ');
    expect(text).toContain('Thời gian duyệt TB');
    expect(text).toContain('Top phòng ban chi tiêu');
    expect(text).toContain('Nguồn');
    expect(text).toContain('Finance');
    expect(text).toContain('Hàng đợi hoàn tiền');
    expect(text).toContain('Hóa đơn đã duyệt, đang chờ Accountant xử lý');
    expect(text).toContain('Nhân viên');
    expect(text).toContain('Mã hóa đơn');
    expect(text).toContain('Phòng ban');
    expect(text).toContain('Duyệt vào');
    expect(text).toContain('Tuổi');
    expect(text).toContain('Hành động');
    expect(text).toContain('Xử lý ngay');
    expect(text).toContain('abc · abc');
    expect(text).toContain('Chi tiêu theo danh mục');
    expect(text).toContain('Finance');
    expect(text).toContain('375.908 ₫');
    expect(text).toContain('T04/26');
    expect(text).not.toContain('Merchant');

    const header = fixture.nativeElement.querySelector('header');
    expect(header.className).not.toContain('sr-only');

    const exportButton = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Xuất PDF'),
    ) as HTMLButtonElement | undefined;
    expect(exportButton).toBeTruthy();

    exportButton?.click();
    expect(printSpy).toHaveBeenCalledOnce();
  });

  it('filters reporting APIs by selected department and routes reimbursement actions to payments', () => {
    reportingApi.expenseSummary.mockReturnValue(
      of({
        expenseCount: 2,
        totalInBaseCurrency: 375908,
        baseCurrencyCode: 'VND',
        byCategory: [],
        byDepartment: [
          {
            keyId: 'department-finance',
            keyName: 'Finance',
            amountInBaseCurrency: 375908,
            expenseCount: 2,
          },
        ],
        byCurrency: [],
      }),
    );
    reportingApi.budgetUtilization.mockReturnValue(
      of([
        {
          departmentId: 'department-finance',
          departmentName: 'Finance',
          month: 5,
          year: 2026,
          allocated: 50000000,
          committed: 0,
          spent: 375908,
          remaining: 49624092,
          utilizationPercent: 1,
          isApproachingLimit: false,
          isOverBudget: false,
          baseCurrencyCode: 'VND',
        },
      ]),
    );
    reportingApi.pendingPaymentQueue.mockReturnValue(
      of([
        {
          paymentId: 'payment-1',
          documentId: 'document-paid-1',
          reference: 'EXP-2026-0184',
          employeeName: 'Director Kim',
          departmentName: 'Finance',
          amount: 187954,
          currencyCode: 'VND',
          amountInBaseCurrency: 187954,
          baseCurrencyCode: 'VND',
          paymentMethod: 'BankTransfer',
          recordedAt: '2026-05-20T10:00:00Z',
          ageDays: 2,
        },
      ]),
    );

    const fixture = createComponent();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const root = fixture.nativeElement as HTMLElement;

    const departmentSelect = root.querySelector('[data-testid="reporting-department-filter"]') as HTMLSelectElement;
    expect(departmentSelect).toBeTruthy();

    departmentSelect.value = 'department-finance';
    departmentSelect.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(reportingApi.expenseSummary).toHaveBeenLastCalledWith({
      from: expect.any(String),
      to: expect.any(String),
      departmentId: 'department-finance',
    });
    expect(reportingApi.budgetUtilization).toHaveBeenLastCalledWith(5, 2026, 'department-finance');
    expect(reportingApi.monthlyTrend).toHaveBeenLastCalledWith(6, 'department-finance');

    const action = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Xử lý ngay'),
    ) as HTMLButtonElement;
    action.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/app/payments'], {
      queryParams: { q: 'EXP-2026-0184' },
    });
  });
});
