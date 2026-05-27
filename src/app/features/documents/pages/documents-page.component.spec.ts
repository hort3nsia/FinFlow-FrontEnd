import { ComponentFixture, TestBed } from '@angular/core/testing';
import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { CurrentSubscriptionFacade } from '../../subscription/data/current-subscription.facade';
import { DocumentsApiService } from '../data/documents-api.service';
import { DocumentsPageComponent } from './documents-page.component';

describe('DocumentsPageComponent', () => {
  const documentsApi = {
    getMyDocumentDrafts: vi.fn(),
    getMySubmittedDocuments: vi.fn(),
  };
  const router = {
    navigate: vi.fn(),
  };
  const currentWorkspaceFacade = {
    state: () => ({
      workspace: {
        tenantId: 'tenant-1',
      },
      loading: false,
      error: null,
    }),
  };
  const proSubscriptionState = {
    subscription: {
      planTier: 'Pro',
      status: 'Active',
      currentPeriodStart: '2026-05-01T00:00:00.000Z',
      currentPeriodEnd: '2026-06-01T00:00:00.000Z',
      entitlements: {
        documentsManualEntryEnabled: true,
        documentsOcrEnabled: true,
        chatbotEnabled: true,
        storageLimitBytes: 10_737_418_240,
        workspaceMonthlyOcrPages: 1000,
        memberMonthlyOcrPages: 100,
        workspaceMonthlyChatbotMessages: 10000,
        memberMonthlyChatbotMessages: 500,
      },
      usage: {
        ocrPagesUsed: 0,
        chatbotMessagesUsed: 0,
        storageUsedBytes: 0,
      },
      currentMemberUsage: {
        ocrPagesUsed: 0,
        chatbotMessagesUsed: 0,
        remainingOcrPages: 100,
        remainingChatbotMessages: 500,
      },
    },
    loading: false,
    error: null,
    tenantId: 'tenant-1',
  };
  let subscriptionState = proSubscriptionState;
  const currentSubscriptionFacade = {
    state: () => subscriptionState,
    ensureLoaded: vi.fn(),
  };

  const createComponent = (): ComponentFixture<DocumentsPageComponent> => {
    const fixture = TestBed.createComponent(DocumentsPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    documentsApi.getMyDocumentDrafts.mockReset();
    documentsApi.getMySubmittedDocuments.mockReset();
    router.navigate.mockReset();
    currentSubscriptionFacade.ensureLoaded.mockReset();
    subscriptionState = proSubscriptionState;

    documentsApi.getMyDocumentDrafts.mockReturnValue(
      of([
        {
          documentId: 'draft-1',
          originalFileName: 'inv-1.pdf',
          vendorName: 'Acme Supplies Ltd.',
          reference: 'INV-2024-0041',
          totalAmount: 4850,
          category: 'Office Supplies',
          source: 'Manual',
          confidenceLabel: 'High',
          ownerEmail: 'staff@finflow.test',
          uploadedAt: '2026-05-20T10:00:00Z',
        },
      ]),
    );
    documentsApi.getMySubmittedDocuments.mockReturnValue(of([]));

    TestBed.configureTestingModule({
      imports: [DocumentsPageComponent],
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
            queryParamMap: of(convertToParamMap({ tab: 'drafts' })),
          },
        },
        { provide: CurrentWorkspaceFacade, useValue: currentWorkspaceFacade },
        { provide: CurrentSubscriptionFacade, useValue: currentSubscriptionFacade },
      ],
    });
  });

  it('renders the documents workspace actions and draft row', () => {
    const fixture = createComponent();
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Tài liệu chi phí');
    expect(text).toContain('Tải lên với OCR');
    expect(text).toContain('Nhập thủ công');
    expect(text).toContain('INV-2024-0041');
    expect(text).toContain('Acme Supplies Ltd.');
    expect(currentSubscriptionFacade.ensureLoaded).toHaveBeenCalledWith('tenant-1');
  });

  it('replaces OCR upload with an upgrade action when OCR is not included in the plan', () => {
    subscriptionState = {
      subscription: {
        planTier: 'Free',
        status: 'Active',
        currentPeriodStart: '2026-05-01T00:00:00.000Z',
        currentPeriodEnd: '2026-06-01T00:00:00.000Z',
        entitlements: {
          documentsManualEntryEnabled: true,
          documentsOcrEnabled: false,
          chatbotEnabled: false,
          storageLimitBytes: 1_073_741_824,
          workspaceMonthlyOcrPages: 0,
          memberMonthlyOcrPages: 0,
          workspaceMonthlyChatbotMessages: 0,
          memberMonthlyChatbotMessages: 0,
        },
        usage: {
          ocrPagesUsed: 0,
          chatbotMessagesUsed: 0,
          storageUsedBytes: 0,
        },
        currentMemberUsage: {
          ocrPagesUsed: 0,
          chatbotMessagesUsed: 0,
          remainingOcrPages: 0,
          remainingChatbotMessages: 0,
        },
      },
      loading: false,
      error: null,
      tenantId: 'tenant-1',
    };

    const fixture = createComponent();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="documents-ocr-action"]')).toBeFalsy();
    expect(root.querySelector('[data-testid="documents-ocr-upgrade-action"]')?.textContent).toContain('Nâng cấp OCR');
    expect(root.textContent).not.toContain('Tải lên với OCR');
    expect(root.querySelector('[data-testid="documents-manual-action"]')).toBeTruthy();
  });

  it('keeps document references compact and reveals row actions on hover or focus', () => {
    const fixture = createComponent();
    const root = fixture.nativeElement as HTMLElement;

    const referenceCell = root.querySelector('[data-testid="document-reference-cell"]');
    const referenceValue = root.querySelector('[data-testid="document-reference-value"]');
    const referenceId = root.querySelector('[data-testid="document-reference-id"]');
    const rowAction = root.querySelector('[data-testid="document-row-action"]');

    expect(referenceCell?.className).toContain('w-[220px]');
    expect(referenceValue?.className).toContain('truncate');
    expect(referenceId?.className).toContain('truncate');
    expect(rowAction?.className).toContain('opacity-0');
    expect(rowAction?.className).toContain('group-hover:opacity-100');
    expect(rowAction?.className).toContain('group-focus-within:opacity-100');
  });

  it('routes draft rows into the draft detail page', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['handleRowAction']({
      documentId: 'draft-1',
      reference: 'INV-2024-0041',
      vendor: 'Acme Supplies Ltd.',
      category: 'Office Supplies',
      source: 'Manual',
      amount: '$4,850.00',
      status: 'Bản nháp',
      statusTone: 'draft',
      updated: '2 giờ trước',
      actionMode: 'resume',
    });

    expect(router.navigate).toHaveBeenCalledWith(['/app/documents', 'draft-1']);
  });
});
