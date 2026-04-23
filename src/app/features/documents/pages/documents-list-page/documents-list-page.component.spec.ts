import 'zone.js';

import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { DocumentsApiService } from '../../data/documents.api.service';
import { DocumentStatusBadgeComponent } from '../../ui/document-status-badge/document-status-badge.component';
import { DocumentsListPageComponent } from './documents-list-page.component';

describe('DocumentsListPageComponent', () => {
  const documentsApiService = {
    getDrafts: vi.fn(),
    getSubmitted: vi.fn(),
  };

  beforeEach(async () => {
    documentsApiService.getDrafts.mockReset();
    documentsApiService.getSubmitted.mockReset();

    documentsApiService.getDrafts.mockReturnValue(
      of({
        items: [
          {
            documentId: 'draft-001',
            originalFileName: 'draft-invoice.pdf',
            vendorName: 'Acme Supplies',
            reference: 'INV-001',
            totalAmount: 1250.5,
            confidenceLabel: 'High',
            ownerEmail: 'owner@finflow.local',
            uploadedAt: '2026-04-21T08:00:00Z',
          },
        ],
        totalCount: 24,
        skip: 0,
        take: 10,
      }),
    );
    documentsApiService.getSubmitted.mockReturnValue(
      of({
        items: [
          {
            documentId: 'submitted-001',
            originalFileName: 'submitted-invoice.pdf',
            vendorName: 'Contoso Paper',
            reference: 'SUB-001',
            totalAmount: 890,
            status: 'Submitted',
            submittedByEmail: 'reviewer@finflow.local',
            submittedAt: '2026-04-20T08:00:00Z',
            lastUpdatedAt: '2026-04-20T09:00:00Z',
            rejectionReason: null,
          },
        ],
        totalCount: 12,
        skip: 0,
        take: 10,
      }),
    );

    await TestBed.configureTestingModule({
      imports: [DocumentsListPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: DocumentsApiService,
          useValue: documentsApiService,
        },
      ],
    }).compileComponents();
  });

  it('renders draft and submitted documents with their statuses', () => {
    const fixture = TestBed.createComponent(DocumentsListPageComponent);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('draft-invoice.pdf');
    expect(textContent).toContain('submitted-invoice.pdf');
    expect(textContent).toContain('Draft');
    expect(textContent).toContain('Submitted');
    expect(textContent).toContain('Showing 1 of 24 drafts');
    expect(textContent).toContain('Showing 1 of 12 submitted');
  });

  it('renders hero action links to upload and manual entry pages', () => {
    const fixture = TestBed.createComponent(DocumentsListPageComponent);
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('.documents-list-page__actions a'),
      (link: Element) => ({
        text: link.textContent?.trim(),
        href: link.getAttribute('href'),
      }),
    );

    expect(links).toEqual([
      {
        text: 'Upload OCR',
        href: '/app/documents/upload',
      },
      {
        text: 'Manual Entry',
        href: '/app/documents/manual',
      },
    ]);
  });

  it('renders detail links for draft and submitted rows', () => {
    const fixture = TestBed.createComponent(DocumentsListPageComponent);
    fixture.detectChanges();

    const links = Array.from(
      fixture.nativeElement.querySelectorAll('.documents-table__link'),
      (link: Element) => link.getAttribute('href'),
    );

    expect(links).toEqual(['/app/documents/draft-001', '/app/documents/submitted-001']);
  });

  it('renders the empty state when both queues are empty', () => {
    documentsApiService.getDrafts.mockReturnValue(
      of({
        items: [],
        totalCount: 0,
        skip: 0,
        take: 10,
      }),
    );
    documentsApiService.getSubmitted.mockReturnValue(
      of({
        items: [],
        totalCount: 0,
        skip: 0,
        take: 10,
      }),
    );

    const fixture = TestBed.createComponent(DocumentsListPageComponent);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('No documents yet');
    expect(textContent).not.toContain('Loading documents...');
  });

  it('renders drafts and an inline warning when submitted fails', () => {
    documentsApiService.getSubmitted.mockReturnValue(
      throwError(() => new Error('Submitted query failed.')),
    );

    const fixture = TestBed.createComponent(DocumentsListPageComponent);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('draft-invoice.pdf');
    expect(textContent).toContain('Showing 1 of 24 drafts');
    expect(textContent).toContain('Submitted documents are temporarily unavailable.');
    expect(textContent).toContain('Submitted query failed.');
    expect(textContent).not.toContain('Unable to load documents');
  });

  it('renders submitted documents and an inline warning when drafts fail', () => {
    documentsApiService.getDrafts.mockReturnValue(
      throwError(() => new Error('Drafts query failed.')),
    );

    const fixture = TestBed.createComponent(DocumentsListPageComponent);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('submitted-invoice.pdf');
    expect(textContent).toContain('Showing 1 of 12 submitted');
    expect(textContent).toContain('Draft documents are temporarily unavailable.');
    expect(textContent).toContain('Drafts query failed.');
    expect(textContent).not.toContain('Unable to load documents');
  });

  it('renders the full-page error state when both queues fail', () => {
    documentsApiService.getDrafts.mockReturnValue(
      throwError(() => new Error('Drafts query failed.')),
    );
    documentsApiService.getSubmitted.mockReturnValue(
      throwError(() => new Error('Submitted query failed.')),
    );

    const fixture = TestBed.createComponent(DocumentsListPageComponent);
    fixture.detectChanges();

    const textContent = fixture.nativeElement.textContent;

    expect(textContent).toContain('Unable to load documents');
    expect(textContent).toContain('Drafts query failed.');
    expect(textContent).toContain('Submitted query failed.');
  });
});

describe('DocumentStatusBadgeComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DocumentStatusBadgeComponent],
    }).compileComponents();
  });

  it.each([
    ['Draft', 'Draft', 'document-status-badge--draft'],
    ['Submitted', 'Submitted', 'document-status-badge--submitted'],
    ['Approved', 'Approved', 'document-status-badge--approved'],
    ['Rejected', 'Rejected', 'document-status-badge--rejected'],
    ['ReadyForApproval', 'Ready for approval', 'document-status-badge--ready-for-approval'],
    ['LegacyPending', 'Unknown', 'document-status-badge--unknown'],
  ])('renders %s status as %s', (inputStatus, expectedLabel, expectedClass) => {
    const fixture = TestBed.createComponent(DocumentStatusBadgeComponent);

    fixture.componentRef.setInput('status', inputStatus);
    fixture.detectChanges();

    const badge = fixture.nativeElement.querySelector('.document-status-badge');

    expect(badge.textContent?.trim()).toBe(expectedLabel);
    expect(badge.className).toContain(expectedClass);
  });
});
