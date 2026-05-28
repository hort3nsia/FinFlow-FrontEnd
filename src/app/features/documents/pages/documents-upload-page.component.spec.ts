import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CurrentSubscriptionFacade } from '../../subscription/data/current-subscription.facade';
import { DocumentsApiService } from '../data/documents-api.service';
import { DocumentsUploadPageComponent } from './documents-upload-page.component';

describe('DocumentsUploadPageComponent', () => {
  const documentsApi = {
    uploadDocumentForReview: vi.fn(),
    getMyCategories: vi.fn(() => of([] as unknown[])),
    getMyDocumentDraft: vi.fn(() => of()),
    saveReviewedOcrDraft: vi.fn(),
    submitReviewedDocument: vi.fn(),
  };
  const currentSubscriptionFacade = {
    recordOcrUsage: vi.fn(),
    refresh: vi.fn(),
  };
  const router = {
    navigate: vi.fn(),
  };

  const createComponent = (): ComponentFixture<DocumentsUploadPageComponent> => {
    const fixture = TestBed.createComponent(DocumentsUploadPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    documentsApi.uploadDocumentForReview.mockReset();
    documentsApi.getMyCategories.mockReset();
    documentsApi.getMyCategories.mockReturnValue(
      of([
        {
          id: 'cat-1',
          name: 'Office Supplies',
          categoryType: 'OfficeSupplies',
          isActive: true,
          displayOrder: 1,
        },
      ]),
    );
    documentsApi.getMyDocumentDraft.mockReset();
    documentsApi.getMyDocumentDraft.mockReturnValue(of());
    documentsApi.saveReviewedOcrDraft.mockReset();
    documentsApi.submitReviewedDocument.mockReset();
    currentSubscriptionFacade.recordOcrUsage.mockReset();
    currentSubscriptionFacade.refresh.mockReset();
    router.navigate.mockReset();

    TestBed.configureTestingModule({
      imports: [DocumentsUploadPageComponent],
      providers: [
        {
          provide: DocumentsApiService,
          useValue: documentsApi,
        },
        {
          provide: CurrentSubscriptionFacade,
          useValue: currentSubscriptionFacade,
        },
        {
          provide: Router,
          useValue: router,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    });
  });

  it('cập nhật OCR usage facade sau khi upload OCR thành công', async () => {
    documentsApi.uploadDocumentForReview.mockReturnValue(
      of({
        documentId: 'draft-1',
        originalFileName: 'invoice.pdf',
        contentType: 'application/pdf',
        vendorName: 'Vendor Co',
        reference: 'INV-001',
        documentDate: '2026-05-01',
        category: 'Office Supplies',
        vendorTaxId: 'TX-123',
        subtotal: 100,
        vat: 10,
        totalAmount: 110,
        source: 'OCR',
        reviewedByStaff: 'staff@finflow.test',
        confidenceLabel: 'High',
        processedPageCount: 4,
        lineItems: [],
        taxLines: [
          {
            taxType: 'VAT',
            rate: 10,
            taxableAmount: 100,
            taxAmount: 10,
          },
        ],
      }),
    );

    const fixture = createComponent();
    const component = fixture.componentInstance;

    const file = new File(['fake-pdf'], 'invoice.pdf', { type: 'application/pdf' });
    await component['handleSelectedFile'](file);

    expect(currentSubscriptionFacade.recordOcrUsage).toHaveBeenCalledTimes(1);
    expect(currentSubscriptionFacade.recordOcrUsage).toHaveBeenCalledWith(4);
    expect(currentSubscriptionFacade.refresh).toHaveBeenCalledWith({ silent: true });
  });

  it('render workspace OCR với upload và panel quy trình', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Tải lên với OCR');
    expect(text).toContain('Tải chứng từ');
    expect(text).toContain('Quy trình OCR');
  });

  it('render review OCR với cột đơn giá, tạm tính, giảm giá và thành tiền rõ nghĩa', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.phase.set('review');
    component.selectedFileName.set('hoadon.jpg');
    component.reviewState.set({
      vendorName: 'BÁCH HÓA XANH',
      reference: '21070052990051966',
      documentDate: '2021-07-16',
      category: 'PHIẾU THANH TOÁN',
      vendorTaxId: '',
    });
    component.lineItems.set([
      {
        itemName: 'BẦU SAO',
        quantity: 1.17,
        unitPrice: 42000,
        discountAmount: 1000,
        total: 48140,
        kind: 'standard',
      },
    ]);
    component.taxAmount.set(454);

    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Đơn giá');
    expect(text).toContain('Giảm giá');
    expect(text).toContain('Thành tiền');
    expect(text).toContain('Tạm tính');
    expect(text).toContain('Tổng giảm giá');
    expect(text).not.toContain('Đơn giá gross');
    expect(text).not.toContain('Thành tiền net');
  });

  it('dùng selection hạng mục thật trên màn review OCR', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.phase.set('review');
    component.reviewState.set({
      vendorName: 'BÁCH HÓA XANH',
      reference: '21070052990051966',
      documentDate: '2021-07-16',
      category: 'PHIẾU THANH TOÁN',
      vendorTaxId: '',
    });

    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector('[data-testid="ocr-category-select"]');

    expect(documentsApi.getMyCategories).toHaveBeenCalledWith();
    expect(select).not.toBeNull();
    expect(select.textContent).toContain('PHIẾU THANH TOÁN');
    expect(select.textContent).toContain('Office Supplies');
  });

  it('gửi payload OCR bằng thành tiền sau giảm giá', async () => {
    documentsApi.saveReviewedOcrDraft.mockReturnValue(of('draft-1'));
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.selectedDraftId.set('draft-1');
    component.reviewState.set({
      vendorName: 'BÁCH HÓA XANH',
      reference: '21070052990051966',
      documentDate: '2021-07-16',
      category: 'PHIẾU THANH TOÁN',
      vendorTaxId: '',
    });
    component.lineItems.set([
      {
        itemName: 'BẦU SAO',
        quantity: 2,
        unitPrice: 42000,
        discountAmount: 1000,
        total: 83000,
        kind: 'standard',
      },
    ]);
    component.taxRate.set(10);
    component.taxAmount.set(7000);

    await component.saveDraft();

    expect(documentsApi.saveReviewedOcrDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'draft-1',
        subtotal: 83000,
        vat: 7000,
        totalAmount: 90000,
        taxLines: [
          {
            taxType: 'VAT',
            rate: 10,
            taxableAmount: 83000,
            taxAmount: 7000,
          },
        ],
        lineItems: [
          {
            itemName: 'BẦU SAO',
            quantity: 2,
            unitPrice: 42000,
            discountPercent: null,
            discountAmount: 1000,
            taxRate: null,
            taxableAmount: 0,
            taxAmount: 0,
            total: 83000,
          },
        ],
      }),
    );
  });

  it('hiển thị hóa đơn khuyến mãi tổng bằng không với giảm giá được suy ra từ OCR', async () => {
    documentsApi.uploadDocumentForReview.mockReturnValue(
      of({
        documentId: 'draft-promotion',
        originalFileName: 'promotion-receipt.jpg',
        contentType: 'image/jpeg',
        vendorName: 'BIG C DI AN',
        reference: '025000112',
        documentDate: '2018-10-02',
        category: 'Groceries',
        vendorTaxId: '3702058398',
        subtotal: 17000,
        vat: 0,
        totalAmount: 0,
        source: 'OCR',
        reviewedByStaff: 'staff@finflow.test',
        confidenceLabel: 'High',
        processedPageCount: 1,
        lineItems: [
          {
            itemName: 'SCU TT NUTI DAU 11',
            quantity: 1,
            unitPrice: 17000,
            total: 17000,
          },
        ],
        taxLines: [],
      }),
    );

    const fixture = createComponent();
    const component = fixture.componentInstance as any;
    const file = new File(['image'], 'promotion-receipt.jpg', { type: 'image/jpeg' });

    await component.handleSelectedFile(file);

    expect(component.lineItems()[0].discountAmount).toBe(17000);
    expect(component.totalAmount()).toBe(0);
  });
});
