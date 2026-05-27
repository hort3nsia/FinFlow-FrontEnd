import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DocumentsApiService } from '../data/documents-api.service';
import { DocumentsSubmittedDetailPageComponent } from './documents-submitted-detail-page.component';

describe('DocumentsSubmittedDetailPageComponent', () => {
  const documentsApi = {
    getMySubmittedDocument: vi.fn(),
  };
  const router = {
    navigate: vi.fn(),
  };

  const createComponent = (): ComponentFixture<DocumentsSubmittedDetailPageComponent> => {
    const fixture = TestBed.createComponent(DocumentsSubmittedDetailPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    documentsApi.getMySubmittedDocument.mockReset();
    router.navigate.mockReset();

    documentsApi.getMySubmittedDocument.mockReturnValue(
      of({
        documentId: 'submitted-manual-only',
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
        status: 'Submitted',
        submittedByEmail: 'staff@finflow.test',
        submittedAt: '2026-05-20T08:00:00Z',
        lastUpdatedAt: '2026-05-20T08:00:00Z',
        rejectionReason: null,
        lineItems: [],
        taxLines: [],
      }),
    );

    TestBed.configureTestingModule({
      imports: [DocumentsSubmittedDetailPageComponent],
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
            paramMap: of(convertToParamMap({ id: 'submitted-manual-only' })),
          },
        },
      ],
    });
  });

  it('does not render manual-entry as a fake submitted attachment filename', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Chưa có tệp đính kèm');
    expect(text).toContain('Chứng từ nhập tay này không có file đi kèm.');
    expect(text).not.toContain('manual-entry');
    expect(text).not.toContain('Preview của chứng từ này chưa được frontend nhận về');
  });
});
