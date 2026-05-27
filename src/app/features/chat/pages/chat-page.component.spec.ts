import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { CurrentSubscriptionFacade } from '../../subscription/data/current-subscription.facade';
import { ChatApiService } from '../data/chat-api.service';
import { ChatPageComponent } from './chat-page.component';

describe('ChatPageComponent', () => {
  const workspaceState = signal({
    workspace: {
      accountId: 'account-1',
      email: 'staff@finflow.local',
      membershipId: 'membership-1',
      role: 'Staff',
      tenantId: 'tenant-1',
      tenantCode: 'alpha',
      tenantName: 'Alpha Finance',
    },
    loading: false,
    error: null as string | null,
  });

  const chatApi = {
    getSessions: vi.fn(() =>
      of([
        {
          id: 'session-1',
          title: 'Phân tích chi tiêu tháng 5',
          messageCount: 4,
          lastMessageAt: '2026-05-25T02:00:00Z',
        },
        {
          id: 'session-2',
          title: 'Hóa đơn chờ duyệt',
          messageCount: 2,
          lastMessageAt: '2026-05-24T10:00:00Z',
        },
      ]),
    ),
    getHistory: vi.fn(() => of([])),
    sendMessage: vi.fn(),
  };
  const subscriptionState = signal({
    subscription: {
      planTier: 'Pro',
      status: 'Active',
      currentPeriodStart: '2026-05-01T00:00:00Z',
      currentPeriodEnd: '2026-06-01T00:00:00Z',
      entitlements: {
        documentsManualEntryEnabled: true,
        documentsOcrEnabled: true,
        chatbotEnabled: true,
        storageLimitBytes: 10_000,
        workspaceMonthlyOcrPages: 1_000,
        memberMonthlyOcrPages: 100,
        workspaceMonthlyChatbotMessages: 100,
        memberMonthlyChatbotMessages: 100,
      },
      usage: {
        ocrPagesUsed: 8,
        chatbotMessagesUsed: 91,
        storageUsedBytes: 256,
      },
      currentMemberUsage: {
        ocrPagesUsed: 0,
        chatbotMessagesUsed: 91,
        remainingOcrPages: 100,
        remainingChatbotMessages: 9,
      },
    },
    loading: false,
    error: null,
    tenantId: 'tenant-1',
  });
  const currentSubscriptionFacade = {
    state: subscriptionState.asReadonly(),
    ensureLoaded: vi.fn(),
    recordChatbotUsage: vi.fn(),
    refresh: vi.fn(),
  };

  const createComponent = (role = 'Staff'): ComponentFixture<ChatPageComponent> => {
    workspaceState.set({
      workspace: {
        accountId: 'account-1',
        email: 'staff@finflow.local',
        membershipId: 'membership-1',
        role,
        tenantId: 'tenant-1',
        tenantCode: 'alpha',
        tenantName: 'Alpha Finance',
      },
      loading: false,
      error: null,
    });

    const fixture = TestBed.createComponent(ChatPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    chatApi.getSessions.mockClear();
    chatApi.getHistory.mockClear();
    chatApi.sendMessage.mockReset();
    currentSubscriptionFacade.ensureLoaded.mockReset();
    currentSubscriptionFacade.recordChatbotUsage.mockReset();
    currentSubscriptionFacade.refresh.mockReset();

    TestBed.configureTestingModule({
      imports: [ChatPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ChatApiService,
          useValue: chatApi,
        },
        {
          provide: CurrentWorkspaceFacade,
          useValue: {
            state: workspaceState.asReadonly(),
          },
        },
        {
          provide: CurrentSubscriptionFacade,
          useValue: currentSubscriptionFacade,
        },
      ],
    });
  });

  it('render MagicPath-style AI assistant workspace with real sessions and quota data', () => {
    const fixture = createComponent('Accountant');
    const text = fixture.nativeElement.textContent;

    expect(currentSubscriptionFacade.ensureLoaded).toHaveBeenCalledWith('tenant-1');
    expect(chatApi.getSessions).toHaveBeenCalledWith(20);
    expect(text).toContain('Cuộc trò chuyện');
    expect(text).toContain('Mới');
    expect(text).toContain('Tìm cuộc trò chuyện');
    expect(text).toContain('Phân tích chi tiêu tháng 5');
    expect(text).toContain('Hóa đơn chờ duyệt');
    expect(text).toContain('Trợ lý AI FinFlow');
    expect(text).toContain('Hỏi tôi bất cứ điều gì về dữ liệu workspace của bạn');
    expect(text).toContain('Phòng nào vượt ngân sách?');
    expect(text).toContain('Báo cáo tổng quan tháng này');
    expect(text).not.toContain('Phạm vi trả lời');
    expect(text).not.toContain('Của tôi');
    expect(text).not.toContain('Toàn công ty');
    expect(text).toContain('Sắp hết hạn mức chat tháng này');
    expect(text).toContain('91 / 100 tin');
    expect(text).toContain('Hỏi trợ lý AI bất cứ điều gì');
    expect(text).toContain('0 / 2000');
    expect(text).toContain('Shift + Enter để xuống dòng');
    expect(text).not.toContain('Sắp ra mắt');
    expect(fixture.nativeElement.querySelector('[title="Sắp ra mắt"]')).toBeNull();
  });

  it('hiển thị badge Báo cáo hệ thống và ẩn citations cho câu trả lời reporting', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['turns'].set([
      {
        id: 'assistant-1',
        role: 'assistant',
        content: 'Tổng chi tháng này là 12 VND.',
        createdAt: '2026-05-22T10:00:00Z',
        answerSource: 'REPORTING',
        citations: [
          {
            chunkNumber: 1,
            chunkId: 'chunk-1',
            documentId: 'doc-1',
            chunkType: 'Expense',
            preview: 'Không nên hiển thị',
          },
        ],
      },
    ] as never);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Báo cáo hệ thống');
    expect(fixture.nativeElement.textContent).not.toContain('[1]');
  });

  it('hiển thị badge Chứng từ nội bộ cho câu trả lời rag', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['turns'].set([
      {
        id: 'assistant-2',
        role: 'assistant',
        content: 'Theo chứng từ nội bộ...',
        createdAt: '2026-05-22T10:05:00Z',
        answerSource: 'RAG',
        citations: [
          {
            chunkNumber: 2,
            chunkId: 'chunk-2',
            documentId: 'doc-2',
            chunkType: 'Receipt',
            preview: 'Chứng từ hiển thị',
          },
        ],
      },
    ] as never);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Chứng từ nội bộ');
    expect(fixture.nativeElement.textContent).toContain('[2]');
  });

  it('mở chứng từ từ citation thay vì hiển thị nút giả', () => {
    const fixture = createComponent();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const component = fixture.componentInstance;

    component['turns'].set([
      {
        id: 'assistant-4',
        role: 'assistant',
        content: 'Theo chứng từ...',
        createdAt: '2026-05-22T10:07:00Z',
        answerSource: 'RAG',
        citations: [
          {
            chunkNumber: 1,
            chunkId: 'chunk-1',
            documentId: 'document-1',
            chunkType: 'Receipt',
            preview: 'BÁCH HÓA XANH',
          },
        ],
      },
    ] as never);
    fixture.detectChanges();

    const citationButton = [...fixture.nativeElement.querySelectorAll('button')].find((button) =>
      button.textContent.includes('Xem hóa đơn'),
    ) as HTMLButtonElement;
    citationButton.click();

    expect(navigateSpy).toHaveBeenCalledWith(['/app/documents/submitted', 'document-1']);
  });

  it('hiển thị badge Trợ lý chung cho câu trả lời general', () => {
    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['turns'].set([
      {
        id: 'assistant-3',
        role: 'assistant',
        content: 'Bạn có thể hỏi cụ thể hơn không?',
        createdAt: '2026-05-22T10:06:00Z',
        answerSource: 'GENERAL',
      },
    ] as never);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Trợ lý chung');
  });

  it('dùng prompt theo role staff khi workspace hiện tại là staff', () => {
    const fixture = createComponent('Staff');

    expect(fixture.nativeElement.textContent).toContain('Tổng chi tháng này');
  });

  it('dùng prompt theo role manager khi workspace hiện tại là manager', () => {
    const fixture = createComponent('Manager');

    expect(fixture.nativeElement.textContent).toContain('Chi tiêu phòng ban');
  });

  it('dùng prompt tenant-level khi workspace hiện tại là accountant', () => {
    const fixture = createComponent('Accountant');

    expect(fixture.nativeElement.textContent).toContain('Tổng chi toàn công ty');
  });

  it('cập nhật usage facade sau khi gửi chat thành công', () => {
    chatApi.sendMessage.mockReturnValue(
      of({
        answer: 'Xin chào!',
        answerSource: 'REPORTING',
        sessionId: 'session-1',
        messageId: 'message-1',
        documentCount: 0,
        tokenUsage: 12,
        citations: [],
      }),
    );

    const fixture = createComponent();
    const component = fixture.componentInstance;

    component['draft'].set('Hello');
    component['send']();

    expect(currentSubscriptionFacade.recordChatbotUsage).toHaveBeenCalledWith(1);
    expect(currentSubscriptionFacade.refresh).toHaveBeenCalledWith({ silent: true });
  });

  it('gửi nguyên query người dùng, không tự gắn phạm vi trả lời', () => {
    chatApi.sendMessage.mockReturnValue(
      of({
        answer: 'Phòng Cơ sở vật chất vượt ngân sách.',
        answerSource: 'REPORTING',
        sessionId: 'session-1',
        messageId: 'message-1',
        documentCount: 0,
        tokenUsage: 12,
        citations: [],
      }),
    );

    const fixture = createComponent('Accountant');
    const component = fixture.componentInstance;
    component['draft'].set('Phòng nào vượt ngân sách trong tháng này?');
    component['send']();

    expect(chatApi.sendMessage).toHaveBeenCalledWith({
      sessionId: null,
      query: 'Phòng nào vượt ngân sách trong tháng này?',
    });
  });
});

