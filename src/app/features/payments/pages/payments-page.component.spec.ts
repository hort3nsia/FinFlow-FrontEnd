import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { PaymentsApiService } from '../data/payments-api.service';
import { PaymentsPageComponent } from './payments-page.component';

describe('PaymentsPageComponent', () => {
  const paymentsApi = {
    getPaymentQueue: vi.fn(),
    getPaymentDetail: vi.fn(),
    recordPayment: vi.fn(),
    confirmPayment: vi.fn(),
    rejectPayment: vi.fn(),
  };

  const queueItem = {
    paymentId: 'pay-1',
    documentId: 'doc-1',
    reference: 'EXP-2026-0184',
    documentFileName: 'hoa-don-bach-hoa-xanh.jpg',
    employeeName: 'Nguyễn Văn An',
    employeeMembershipId: 'MBS-0091',
    employeeCode: 'EMP-0041',
    merchantName: 'BÁCH HÓA XANH',
    department: 'Vận hành',
    amount: 187954,
    currencyCode: 'VND',
    amountInBaseCurrency: 187954,
    expenseDate: '2021-07-16T00:00:00Z',
    submittedAt: '2026-05-18T09:42:00Z',
    queueStatus: 'ReadyToPay' as const,
    paymentMethod: null,
    recordedAt: null,
    confirmedAt: null,
    rejectionReason: null,
    notes: null,
  };

  const oldQueueItem = {
    ...queueItem,
    paymentId: 'pay-2',
    documentId: 'doc-2',
    reference: 'EXP-2026-0001',
    employeeName: 'Trần Thị Bình',
    submittedAt: '2026-04-18T09:42:00Z',
  };

  const detail = {
    paymentId: 'pay-1',
    documentId: 'doc-1',
    reference: 'EXP-2026-0184',
    settlementRef: 'SET-2026-0091',
    approvalRecordId: 'APR-2026-0184',
    employeeName: 'Nguyễn Văn An',
    employeeMembershipId: 'MBS-0091',
    employeeCode: 'EMP-0041',
    merchantName: 'BÁCH HÓA XANH',
    department: 'Vận hành',
    costCenter: 'CC-OPS-01',
    amount: 187954,
    currencyCode: 'VND',
    amountInBaseCurrency: 187954,
    expenseDate: '2021-07-16T00:00:00Z',
    paymentMethod: null,
    queueStatus: 'ReadyToPay',
    documentFileName: 'hoa-don-bach-hoa-xanh.jpg',
    documentDownloadUrl: '/files/hoa-don-bach-hoa-xanh.jpg',
    documentViewUrl: '/files/view/hoa-don-bach-hoa-xanh.jpg',
    auditTrail: [
      {
        type: 'approved',
        title: 'Khoản chi đã được phê duyệt',
        actor: 'Manager Lê',
        timestamp: '2026-05-18T09:42:00Z',
        note: 'Đã kiểm tra chứng từ.',
      },
    ],
    methodSource: null,
    methodEditable: true,
  };

  const createComponent = (): ComponentFixture<PaymentsPageComponent> => {
    const fixture = TestBed.createComponent(PaymentsPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    paymentsApi.getPaymentQueue.mockReset();
    paymentsApi.getPaymentDetail.mockReset();
    paymentsApi.recordPayment.mockReset();
    paymentsApi.confirmPayment.mockReset();
    paymentsApi.rejectPayment.mockReset();

    paymentsApi.getPaymentQueue.mockReturnValue(of([queueItem]));
    paymentsApi.getPaymentDetail.mockReturnValue(of(detail));

    TestBed.configureTestingModule({
      imports: [PaymentsPageComponent],
      providers: [{ provide: PaymentsApiService, useValue: paymentsApi }],
    });
  });

  it('renders the MagicPath payment queue hierarchy and loads selected payment details', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Giai đoạn 3 / 3');
    expect(text).toContain('Hàng đợi hoàn tiền');
    expect(text).toContain('Sẵn sàng thanh toán');
    expect(text).toContain('Nhân viên');
    expect(text).toContain('Mã khoản chi');
    expect(text).toContain('Nhà cung cấp');
    expect(text).toContain('Số tiền');
    expect(text).toContain('Ngân hàng');
    expect(text).toContain('Trạng thái');
    expect(text).toContain('Tuổi');
    expect(text).toContain('Thông tin ngân hàng');
    expect(text).toContain('Chứng từ và tài liệu');
    expect(text).toContain('Nhật ký xử lý');
    expect(text).toContain('Lên lịch chi trả');
    expect(text).toContain('₫187.954');
    expect(paymentsApi.getPaymentDetail).toHaveBeenCalledWith('pay-1', 'doc-1');
  });

  it('shows an actual empty queue instead of injecting demonstration payment data', () => {
    paymentsApi.getPaymentQueue.mockReturnValue(of([]));

    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Không có khoản chi nào trong nhóm này');
    expect(text).not.toContain('Vertex Cloud Services');
    expect(text).not.toContain('Sarah Mitchell');
    expect(paymentsApi.getPaymentDetail).not.toHaveBeenCalled();
  });

  it('toggles actual filters instead of rendering inert header controls', () => {
    paymentsApi.getPaymentQueue.mockReturnValue(of([queueItem, oldQueueItem]));

    const fixture = createComponent();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('Nguyễn Văn An');
    expect(root.textContent).toContain('Trần Thị Bình');

    const periodButton = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Tháng này'),
    ) as HTMLButtonElement;
    periodButton.click();
    fixture.detectChanges();

    expect(root.textContent).toContain('Nguyễn Văn An');
    expect(root.textContent).not.toContain('Trần Thị Bình');

    const filterButton = [...root.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Bộ lọc'),
    ) as HTMLButtonElement;
    filterButton.click();
    fixture.detectChanges();

    expect(root.querySelector('[data-testid="payments-advanced-filters"]')).toBeTruthy();
  });

  it('reuses loaded payment details when returning to a previously selected row', () => {
    const secondDetail = {
      ...detail,
      paymentId: 'pay-2',
      documentId: 'doc-2',
      reference: 'EXP-2026-0001',
      employeeName: 'Trần Thị Bình',
    };
    paymentsApi.getPaymentQueue.mockReturnValue(of([queueItem, oldQueueItem]));
    paymentsApi.getPaymentDetail.mockImplementation((paymentId: string) =>
      of(paymentId === 'pay-2' ? secondDetail : detail),
    );

    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    expect(paymentsApi.getPaymentDetail).toHaveBeenCalledTimes(1);

    component.selectPayment('pay-2');
    fixture.detectChanges();

    expect(paymentsApi.getPaymentDetail).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Trần Thị Bình');

    component.selectPayment('pay-1');
    fixture.detectChanges();

    expect(paymentsApi.getPaymentDetail).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Nguyễn Văn An');
  });
});
