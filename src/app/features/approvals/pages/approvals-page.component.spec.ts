import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApprovalsApiService } from '../data/approvals-api.service';
import { DocumentsApiService } from '../../documents/data/documents-api.service';
import { ApprovalsPageComponent } from './approvals-page.component';

describe('ApprovalsPageComponent', () => {
  const approvalsApi = {
    getApprovalQueue: vi.fn(),
    getApprovalDetail: vi.fn(),
    exportApprovalQueue: vi.fn(),
    approveReviewedDocument: vi.fn(),
    rejectReviewedDocument: vi.fn(),
  };
  const documentsApi = {
    getMySubmittedDocument: vi.fn(),
  };

  const queueResponse = {
    items: [
      {
        documentId: 'approval-1',
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
    ],
    page: 1,
    pageSize: 20,
    totalCount: 1,
    totalPages: 1,
  };

  const emptyQueueResponse = {
    items: [],
    page: 1,
    pageSize: 20,
    totalCount: 0,
    totalPages: 1,
  };

  const createComponent = (): ComponentFixture<ApprovalsPageComponent> => {
    const fixture = TestBed.createComponent(ApprovalsPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    approvalsApi.getApprovalQueue.mockReset();
    approvalsApi.getApprovalDetail.mockReset();
    approvalsApi.exportApprovalQueue.mockReset();
    approvalsApi.approveReviewedDocument.mockReset();
    approvalsApi.rejectReviewedDocument.mockReset();
    documentsApi.getMySubmittedDocument.mockReset();

    approvalsApi.getApprovalQueue.mockImplementation((status: string) => {
      if (status === 'ALL' || status === 'PENDING') {
        return of(queueResponse);
      }

      return of(emptyQueueResponse);
    });
    approvalsApi.getApprovalDetail.mockReturnValue(
      of({
        documentId: 'approval-1',
        requestCode: 'APR-APPROVAL1',
        title: 'BÁCH HÓA XANH · 21070052990051966',
        vendorName: 'BÁCH HÓA XANH',
        requesterName: 'Director Kim',
        requesterEmail: 'director.kim@meridian.test',
        department: 'Finance',
        amount: 187954,
        currency: 'VND',
        expenseDate: '2021-07-16',
        submittedAt: '2026-04-24T16:46:00Z',
        priority: 'Medium',
        status: 'ReadyForApproval',
        policySummary: 'Auto-approved by amount policy',
        lineItems: [
          {
            description: 'BẦU SAO',
            quantity: 1.17,
            unitPrice: 42000,
            total: 49308,
          },
        ],
      }),
    );
    documentsApi.getMySubmittedDocument.mockReturnValue(
      of({
        documentId: 'approval-1',
        originalFileName: 'hoadon.jpg',
        contentType: 'image/jpeg',
        hasPreviewImage: true,
        previewImageDataUrl: 'data:image/jpeg;base64,ZmFrZS1pbWFnZQ==',
        vendorName: 'BÁCH HÓA XANH',
        reference: '21070052990051966',
        documentDate: '2021-07-16',
        category: 'PHIẾU THANH TOÁN',
        vendorTaxId: '',
        subtotal: 187500,
        vat: 454,
        totalAmount: 187954,
        currencyCode: 'VND',
        exchangeRate: 1,
        baseCurrencyCode: 'VND',
        totalAmountInBaseCurrency: 187954,
        source: 'OCR',
        status: 'Submitted',
        submittedByEmail: 'director.kim@meridian.test',
        submittedAt: '2026-04-24T16:46:00Z',
        lastUpdatedAt: '2026-04-24T16:46:00Z',
        rejectionReason: null,
        lineItems: [],
        taxLines: [],
      }),
    );

    TestBed.configureTestingModule({
      imports: [ApprovalsPageComponent],
      providers: [
        {
          provide: ApprovalsApiService,
          useValue: approvalsApi,
        },
        {
          provide: DocumentsApiService,
          useValue: documentsApi,
        },
      ],
    });
  });

  it('renders a MagicPath-style approval workspace and inspector hierarchy', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Giai đoạn 2 / 3');
    expect(text).toContain('Hàng đợi phê duyệt');
    expect(text).toContain('Tìm nhà cung cấp, người gửi, mã yêu cầu');
    expect(text).toContain('Mã yêu cầu');
    expect(text).toContain('Người gửi');
    expect(text).toContain('Nhà cung cấp');
    expect(text).toContain('Tín hiệu');
    expect(text).toContain('₫187,954');
    expect(text).toContain('BÁCH HÓA XANH');
    expect(text).toContain('Chi tiết');
    expect(text).toContain('Hoá đơn');
    expect(text).toContain('Ghi chú');
    expect(text).toContain('Lịch sử');
    expect(text).toContain('Hành động');
    expect(text).toContain('Người gửi');
    expect(text).toContain('Thông tin chi phí');
    expect(text).toContain('Diễn giải nghiệp vụ');
    expect(text).toContain('Tài chính');
  });

  it('does not duplicate the shell breadcrumb inside the page body', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).not.toContain('Phê duyệt / Hàng đợi duyệt');
  });

  it('renders the approval inspector with MagicPath financial breakdown hierarchy', () => {
    const fixture = createComponent();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent ?? '';

    expect(root.querySelector('[data-testid="approval-inspector-panel"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="approval-inspector-hero"]')).toBeTruthy();
    expect(root.querySelector('[data-testid="approval-financial-breakdown"]')).toBeTruthy();
    expect(text).toContain('PHÂN TÍCH TÀI CHÍNH');
    expect(text).toContain('Dòng chi phí');
    expect(text).toContain('MÔ TẢ');
    expect(text).toContain('SL');
    expect(text).toContain('ĐƠN GIÁ');
    expect(text).toContain('TẠM TÍNH');
    expect(text).toContain('THÀNH TIỀN');
    expect(text).toContain('Số tiền cần thanh toán');
  });

  it('keeps approve and reject actions in the Actions inspector tab', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.setInspectorTab('actions');
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Ghi chú quyết định');
    expect(text).toContain('Duyệt yêu cầu');
    expect(text).toContain('Từ chối');
  });

  it('renders the invoice attachment preview when document API returns preview data', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.setInspectorTab('invoice');
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector(
      '[data-testid="approval-invoice-preview-image"]',
    ) as HTMLImageElement | null;

    expect(documentsApi.getMySubmittedDocument).toHaveBeenCalledWith('approval-1');
    expect(image).toBeTruthy();
    expect(image?.src).toBe('data:image/jpeg;base64,ZmFrZS1pbWFnZQ==');
    expect(image?.alt).toBe('hoadon.jpg');
  });

  it('reuses loaded approval details when switching back to a previous row', () => {
    const secondQueueItem = {
      ...queueResponse.items[0],
      documentId: 'approval-2',
      title: 'Highlands Coffee · INV-2026-0021',
      vendorName: 'Highlands Coffee',
      amount: 450000,
    };
    const firstDetail = {
      documentId: 'approval-1',
      requestCode: 'APR-APPROVAL1',
      title: 'BÁCH HÓA XANH · 21070052990051966',
      vendorName: 'BÁCH HÓA XANH',
      requesterName: 'Director Kim',
      requesterEmail: 'director.kim@meridian.test',
      department: 'Finance',
      amount: 187954,
      currency: 'VND',
      expenseDate: '2021-07-16',
      submittedAt: '2026-04-24T16:46:00Z',
      priority: 'Medium',
      status: 'ReadyForApproval',
      policySummary: 'Auto-approved by amount policy',
      lineItems: [
        {
          description: 'BẦU SAO',
          quantity: 1.17,
          unitPrice: 42000,
          total: 49308,
        },
      ],
    };
    const secondDetail = {
      ...firstDetail,
      documentId: 'approval-2',
      requestCode: 'APR-APPROVAL2',
      title: 'Highlands Coffee · INV-2026-0021',
      vendorName: 'Highlands Coffee',
      amount: 450000,
    };
    approvalsApi.getApprovalQueue.mockImplementation((status: string) => {
      if (status === 'ALL' || status === 'PENDING') {
        return of({
          ...queueResponse,
          items: [queueResponse.items[0], secondQueueItem],
          totalCount: 2,
        });
      }

      return of(emptyQueueResponse);
    });
    approvalsApi.getApprovalDetail.mockImplementation((approvalId: string) =>
      of(approvalId === 'approval-2' ? secondDetail : firstDetail),
    );

    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    expect(approvalsApi.getApprovalDetail).toHaveBeenCalledTimes(1);

    component.selectApproval('approval-2');
    fixture.detectChanges();

    expect(approvalsApi.getApprovalDetail).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Highlands Coffee');

    component.selectApproval('approval-1');
    fixture.detectChanges();

    expect(approvalsApi.getApprovalDetail).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('BÁCH HÓA XANH');
  });
});
