import 'zone.js';

import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { DocumentsApiService } from '../../data/documents.api.service';
import { DocumentDetailPageComponent } from './document-detail-page.component';

describe('DocumentDetailPageComponent', () => {
  const documentsApiService = {
    getDraft: vi.fn(),
    deleteDraft: vi.fn(),
    submitReviewedDocument: vi.fn(),
  };

  beforeEach(async () => {
    Object.values(documentsApiService).forEach((mockFn) => mockFn.mockReset());

    documentsApiService.getDraft.mockReturnValue(
      of({
        documentId: 'draft-1',
        originalFileName: 'april-invoice.pdf',
        contentType: 'application/pdf',
        vendorName: 'Acme Supplies',
        reference: 'INV-2026-0042',
        documentDate: '2026-04-10',
        dueDate: '2026-04-30',
        category: 'Office',
        vendorTaxId: 'TAX-9988',
        subtotal: 1200,
        vat: 120,
        totalAmount: 1320,
        source: 'Upload',
        reviewedByStaff: 'reviewer@finflow.local',
        confidenceLabel: 'High',
        hasImage: true,
        lineItems: [
          {
            itemName: 'Printer paper',
            quantity: 10,
            unitPrice: 12,
            total: 120,
          },
          {
            itemName: 'Ink cartridge',
            quantity: 4,
            unitPrice: 75,
            total: 300,
          },
        ],
      }),
    );

    await TestBed.configureTestingModule({
      imports: [DocumentDetailPageComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({
                id: 'draft-1',
              }),
            },
            paramMap: of(
              convertToParamMap({
                id: 'draft-1',
              }),
            ),
          },
        },
        {
          provide: DocumentsApiService,
          useValue: documentsApiService,
        },
      ],
    }).compileComponents();
  });

  it('renders the loaded draft vendor and review actions', () => {
    const fixture = TestBed.createComponent(DocumentDetailPageComponent);
    fixture.detectChanges();

    expect(documentsApiService.getDraft).toHaveBeenCalledWith('draft-1');
    expect(fixture.nativeElement.textContent).toContain('Acme Supplies');
    expect(fixture.nativeElement.textContent).toContain('Delete');
    expect(fixture.nativeElement.textContent).toContain('Submit');
  });

  it('renders line items and an attachment state message when the draft has an image', () => {
    const fixture = TestBed.createComponent(DocumentDetailPageComponent);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('Printer paper');
    expect(textContent).toContain('Ink cartridge');
    expect(textContent).toContain('Attachment preview is not available in this screen.');
  });
});
