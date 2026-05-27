import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CurrentSubscriptionFacade } from '../../subscription/data/current-subscription.facade';
import { DocumentsApiService } from '../data/documents-api.service';
import { DocumentsManualPageComponent } from './documents-manual-page.component';

describe('DocumentsManualPageComponent', () => {
  const documentsApi = {
    uploadDocumentForReview: vi.fn(),
    uploadManualAttachmentDraft: vi.fn(),
    getMyCategories: vi.fn(() => of([] as unknown[])),
    getMyDocumentDraft: vi.fn(() => of()),
    saveManualDraft: vi.fn(),
    saveReviewedOcrDraft: vi.fn(),
    submitReviewedDocument: vi.fn(),
  };
  const currentSubscriptionFacade = {
    recordOcrUsage: vi.fn(),
    refresh: vi.fn(),
  };

  const createComponent = (): ComponentFixture<DocumentsManualPageComponent> => {
    const fixture = TestBed.createComponent(DocumentsManualPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    documentsApi.uploadDocumentForReview.mockReset();
    documentsApi.uploadManualAttachmentDraft.mockReset();
    documentsApi.getMyCategories.mockReset();
    documentsApi.getMyCategories.mockReturnValue(
      of([
        {
          id: 'cat-1',
          name: 'Văn phòng phẩm',
          categoryType: 'OfficeSupplies',
          isActive: true,
          displayOrder: 1,
        },
      ]),
    );
    documentsApi.getMyDocumentDraft.mockReset();
    documentsApi.getMyDocumentDraft.mockReturnValue(of());
    documentsApi.saveManualDraft.mockReset();
    documentsApi.saveReviewedOcrDraft.mockReset();
    documentsApi.submitReviewedDocument.mockReset();
    currentSubscriptionFacade.recordOcrUsage.mockReset();
    currentSubscriptionFacade.refresh.mockReset();

    TestBed.configureTestingModule({
      imports: [DocumentsManualPageComponent],
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
          provide: ActivatedRoute,
          useValue: {
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    });
  });

  it('không cập nhật OCR usage khi manual submit chỉ tải tệp đính kèm', async () => {
    documentsApi.uploadManualAttachmentDraft.mockReturnValue(
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
    await component['resolveDraftForSubmit'](file);

    expect(documentsApi.uploadManualAttachmentDraft).toHaveBeenCalledWith(
      'invoice.pdf',
      'application/pdf',
      expect.any(String),
    );
    expect(documentsApi.uploadDocumentForReview).not.toHaveBeenCalled();
    expect(currentSubscriptionFacade.recordOcrUsage).not.toHaveBeenCalled();
    expect(currentSubscriptionFacade.refresh).not.toHaveBeenCalled();
  });

  it('renders the manual expense workspace with magicpath-style sections', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Quay lại danh sách');
    expect(text).toContain('Chi phí thủ công mới');
    expect(text).toContain('Thông tin nhà cung cấp');
    expect(text).toContain('Tổng tài chính');
  });

  it('dùng danh sách hạng mục thật thay vì ô nhập text tự do', () => {
    const fixture = createComponent();
    const select = fixture.nativeElement.querySelector('[data-testid="manual-category-select"]');

    expect(documentsApi.getMyCategories).toHaveBeenCalledWith();
    expect(select).not.toBeNull();
    expect(select.textContent).toContain('Văn phòng phẩm');
    expect(fixture.nativeElement.textContent).not.toContain('Acme Ltd.');
    expect(fixture.nativeElement.textContent).not.toContain('Office Supplies');
  });

  it('saves manual drafts with explicit VAT rate and tax amount', async () => {
    documentsApi.saveManualDraft.mockReturnValue(of('draft-1'));
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.formState.set({
      vendorSupplier: 'BÁCH HÓA XANH',
      invoiceNumber: '21070052990051966',
      invoiceDate: '2021-07-16',
      category: 'PHIẾU THANH TOÁN',
      taxId: '',
    });
    component.lineItems.set([
      {
        type: 'standard',
        description: 'BẦU SAO',
        quantity: 2,
        grossAmount: 84000,
        discountAmount: 1000,
      },
    ]);
    component.taxRate.set(10);
    component.taxAmount.set(8300);

    await component.saveDraft();

    expect(documentsApi.saveManualDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: 83000,
        vat: 8300,
        totalAmount: 91300,
        taxLines: [
          {
            taxType: 'VAT',
            rate: 10,
            taxableAmount: 83000,
            taxAmount: 8300,
          },
        ],
      }),
    );
  });

  it('preserves an attached manual receipt preview by saving through the uploaded draft flow', async () => {
    documentsApi.uploadManualAttachmentDraft.mockReturnValue(
      of({
        documentId: 'draft-with-file',
        originalFileName: 'manual-receipt.jpg',
        contentType: 'image/jpeg',
        vendorName: '',
        reference: '',
        documentDate: '2026-05-01',
        category: '',
        vendorTaxId: '',
        subtotal: 0,
        vat: 0,
        totalAmount: 0,
        source: 'OCR',
        reviewedByStaff: 'staff@finflow.test',
        confidenceLabel: 'Uploaded attachment',
        processedPageCount: 1,
        lineItems: [],
        taxLines: [],
      }),
    );
    documentsApi.saveReviewedOcrDraft.mockReturnValue(of('draft-with-file'));
    const fixture = createComponent();
    const component = fixture.componentInstance as any;

    component.selectedFile.set(new File(['fake-image'], 'manual-receipt.jpg', { type: 'image/jpeg' }));
    component.selectedFileName.set('manual-receipt.jpg');
    component.selectedFileType.set('image/jpeg');
    component.formState.set({
      vendorSupplier: 'BÁCH HÓA XANH',
      invoiceNumber: '21070052990051966',
      invoiceDate: '2021-07-16',
      category: 'PHIẾU THANH TOÁN',
      taxId: '',
    });

    await component.saveDraft();

    expect(documentsApi.uploadManualAttachmentDraft).toHaveBeenCalledWith(
      'manual-receipt.jpg',
      'image/jpeg',
      expect.any(String),
    );
    expect(documentsApi.uploadDocumentForReview).not.toHaveBeenCalled();
    expect(currentSubscriptionFacade.recordOcrUsage).not.toHaveBeenCalled();
    expect(currentSubscriptionFacade.refresh).not.toHaveBeenCalled();
    expect(documentsApi.saveManualDraft).not.toHaveBeenCalled();
    expect(documentsApi.saveReviewedOcrDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: 'draft-with-file',
        vendorName: 'BÁCH HÓA XANH',
        reference: '21070052990051966',
        confidenceLabel: 'Manual entry',
      }),
    );
  });
});
