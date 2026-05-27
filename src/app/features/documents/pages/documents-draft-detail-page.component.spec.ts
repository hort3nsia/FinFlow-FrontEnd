import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DocumentsApiService } from '../data/documents-api.service';
import { DocumentsDraftDetailPageComponent } from './documents-draft-detail-page.component';

describe('DocumentsDraftDetailPageComponent', () => {
  const documentsApi = {
    getMyDocumentDraft: vi.fn(),
    submitReviewedDocument: vi.fn(),
  };
  const router = {
    navigate: vi.fn(),
  };

  const createComponent = (): ComponentFixture<DocumentsDraftDetailPageComponent> => {
    const fixture = TestBed.createComponent(DocumentsDraftDetailPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    documentsApi.getMyDocumentDraft.mockReset();
    documentsApi.submitReviewedDocument.mockReset();
    router.navigate.mockReset();
    documentsApi.submitReviewedDocument.mockReturnValue(
      of({
        documentId: 'submitted-1',
        status: 'ReadyForApproval',
        submittedAt: '2026-05-20T08:00:00Z',
        vendorName: 'Acme Supplies Ltd.',
        reference: 'INV-2024-0041',
        totalAmount: 198,
        reviewedByStaff: 'staff@finflow.test',
      }),
    );

    documentsApi.getMyDocumentDraft.mockReturnValue(
      of({
        documentId: 'draft-1',
        originalFileName: 'invoice.pdf',
        contentType: 'application/pdf',
        vendorName: 'Acme Supplies Ltd.',
        reference: 'INV-2024-0041',
        documentDate: '2026-05-20',
        category: 'Office Supplies',
        vendorTaxId: 'TX-10',
        subtotal: 180,
        vat: 18,
        totalAmount: 198,
        currencyCode: 'USD',
        source: 'manual-entry',
        reviewedByStaff: 'staff@finflow.test',
        confidenceLabel: 'Manual entry',
        lineItems: [
          {
            itemName: 'Office Chair Pro',
            quantity: 2,
            unitPrice: 100,
            total: 180,
          },
        ],
        taxLines: [
          {
            taxType: 'VAT',
            rate: 10,
            taxableAmount: 180,
            taxAmount: 18,
          },
        ],
      }),
    );

    TestBed.configureTestingModule({
      imports: [DocumentsDraftDetailPageComponent],
      providers: [
        {
          provide: DocumentsApiService,
          useValue: documentsApi,
        },
        {
          provide: Router,
          useValue: router,
        },
        {
          provide: ActivatedRoute,
          useValue: {
            paramMap: of(convertToParamMap({ id: 'draft-1' })),
          },
        },
      ],
    });
  });

  it('renders the draft detail workspace with magicpath-style hierarchy', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Quay lại danh sách');
    expect(text).toContain('Supporting Document');
    expect(text).toContain('Expense Details');
    expect(text).toContain('Tổng cộng');
    expect(text).toContain('Acme Supplies Ltd.');
  });

  it('renders Vietnamese finance columns and clarifies VAT amount on draft detail', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Đơn giá');
    expect(text).toContain('Tạm tính');
    expect(text).toContain('Giảm giá');
    expect(text).toContain('Thành tiền');
    expect(text).not.toContain('Đơn giá gross');
    expect(text).not.toContain('Net');
    expect(text).toContain('Tổng giảm giá');
    expect(text).toContain('VAT 10%');
    expect(text).toContain('-$20.00');
  });

  it('does not render manual-entry as a fake attachment filename', () => {
    documentsApi.getMyDocumentDraft.mockReturnValue(
      of({
        documentId: 'draft-manual-only',
        originalFileName: 'manual-entry',
        contentType: 'manual-entry',
        vendorName: 'Manual Vendor',
        reference: 'MAN-001',
        documentDate: '2026-05-20',
        category: 'Office Supplies',
        vendorTaxId: '',
        subtotal: 100,
        vat: 0,
        totalAmount: 100,
        currencyCode: 'USD',
        source: 'manual-entry',
        reviewedByStaff: 'staff@finflow.test',
        confidenceLabel: 'Manual entry',
        lineItems: [],
        taxLines: [],
      }),
    );

    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Chưa có tệp đính kèm');
    expect(text).toContain('Chứng từ nhập tay này không có file đi kèm.');
    expect(text).not.toContain('manual-entry');
    expect(text).not.toContain('Preview của chứng từ này chưa được frontend nhận về');
  });

  it('submits a draft directly from detail with clear Vietnamese action wording', async () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Chỉnh sửa bản nháp');
    expect(text).toContain('Gửi phê duyệt');
    expect(text).not.toContain('Mở màn chỉnh sửa');

    await component['submitDraft']();

    expect(documentsApi.submitReviewedDocument).toHaveBeenCalledWith({
      draftId: 'draft-1',
      originalFileName: 'invoice.pdf',
      vendorName: 'Acme Supplies Ltd.',
      reference: 'INV-2024-0041',
      documentDate: '2026-05-20',
      category: 'Office Supplies',
      vendorTaxId: 'TX-10',
      subtotal: 180,
      vat: 18,
      totalAmount: 198,
      source: 'manual-entry',
      confidenceLabel: 'Manual entry',
      lineItems: [
        {
          itemName: 'Office Chair Pro',
          quantity: 2,
          unitPrice: 100,
          total: 180,
        },
      ],
      taxLines: [
        {
          taxType: 'VAT',
          rate: 10,
          taxableAmount: 180,
          taxAmount: 18,
        },
      ],
    });
    expect(router.navigate).toHaveBeenCalledWith(['/app/documents/list'], {
      queryParams: { tab: 'submitted' },
    });
  });

  it('routes manual drafts back to the manual editor', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['editDraft']();

    expect(router.navigate).toHaveBeenCalledWith(['/app/documents/manual'], {
      queryParams: { draftId: 'draft-1' },
    });
  });
});
