import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { toUserFacingError } from '../../../core/errors/user-facing-error.util';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import { CurrentSubscriptionFacade } from '../../subscription/data/current-subscription.facade';
import {
  ChatAnswerSourceDto,
  ChatApiService,
  ChatCitation,
  ChatMessageDto,
  ChatSessionSummaryDto,
} from '../data/chat-api.service';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  answerSource?: ChatAnswerSourceDto;
  citations?: ChatCitation[];
  tokenUsage?: number;
  documentCount?: number;
  isPending?: boolean;
}

interface SuggestedPrompt {
  title: string;
  prompt: string;
}

type ContentBlockType = 'heading' | 'keyvalue' | 'bullet' | 'paragraph';

interface ContentBlock {
  type: ContentBlockType;
  text?: string;
  label?: string;
  /** Value segments. A value like "A · B · C" is split into ["A", "B", "C"]. */
  valueSegments?: string[];
}

const STAFF_SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    title: 'Tổng chi tháng này',
    prompt: 'Tháng này tôi đã tiêu bao nhiêu?',
  },
  {
    title: 'Hạn mức còn lại',
    prompt: 'Tôi còn bao nhiêu hạn mức?',
  },
  {
    title: 'Chi tiêu theo hạng mục',
    prompt: 'Chi tiêu của tôi tháng này theo hạng mục là gì?',
  },
  {
    title: 'Hóa đơn lớn nhất gần đây',
    prompt: 'Hóa đơn gần đây nào của tôi có giá trị lớn nhất?',
  },
];

const MANAGER_SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    title: 'Chi tiêu phòng ban',
    prompt: 'Phòng ban tôi đã chi bao nhiêu tháng này?',
  },
  {
    title: 'Nhân viên chi nhiều nhất',
    prompt: 'Nhân viên nào chi tiêu nhiều nhất trong phòng ban tháng này?',
  },
  {
    title: 'Ngân sách phòng ban còn lại',
    prompt: 'Phòng ban tôi còn bao nhiêu ngân sách?',
  },
  {
    title: 'Chứng từ nhân viên',
    prompt: 'Cho tôi xem chứng từ của nhân viên trong phòng ban.',
  },
];

const TENANT_LEVEL_SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    title: 'Tổng chi toàn công ty',
    prompt: 'Tổng chi toàn công ty tháng này là bao nhiêu?',
  },
  {
    title: 'Phòng ban chi nhiều nhất',
    prompt: 'Phòng ban nào có tổng chi cao nhất tháng này?',
  },
  {
    title: 'Xu hướng 3 tháng gần đây',
    prompt: 'Xu hướng chi tiêu 3 tháng gần đây là gì?',
  },
  {
    title: 'Chứng từ theo phòng ban',
    prompt: 'Cho tôi xem các chứng từ theo từng phòng ban.',
  },
];

const MAGICPATH_SUGGESTED_PROMPTS: SuggestedPrompt[] = [
  {
    title: 'Phòng nào vượt ngân sách?',
    prompt: 'Phòng nào vượt ngân sách trong tháng này?',
  },
  {
    title: 'Phòng ban cần chú ý',
    prompt: 'Phòng ban nào cần chú ý về chi tiêu hoặc ngân sách?',
  },
  {
    title: 'Tỉ lệ duyệt trung bình',
    prompt: 'Tỉ lệ duyệt trung bình hiện tại là bao nhiêu?',
  },
  {
    title: 'Báo cáo tổng quan tháng này',
    prompt: 'Báo cáo tổng quan tháng này',
  },
];

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat-page.component.html',
  styleUrl: './chat-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatPageComponent {
  private readonly chatApi = inject(ChatApiService);
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);
  private readonly currentSubscriptionFacade = inject(CurrentSubscriptionFacade);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);

  @ViewChild('messagesEnd') protected messagesEnd?: ElementRef<HTMLDivElement>;

  protected readonly workspaceState = this.currentWorkspaceFacade.state;

  // ─── State ───────────────────────────────────────────────────────
  protected readonly sessions = signal<ChatSessionSummaryDto[]>([]);
  protected readonly activeSessionId = signal<string | null>(null);
  protected readonly turns = signal<ChatTurn[]>([]);
  protected readonly draft = signal('');
  protected readonly sessionSearch = signal('');
  protected readonly isSending = signal(false);
  protected readonly isLoadingSessions = signal(false);
  protected readonly isLoadingHistory = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly isSidebarOpen = signal(true);
  protected readonly subscriptionState = this.currentSubscriptionFacade.state;

  // ─── Computed ────────────────────────────────────────────────────
  protected readonly hasTurns = computed(() => this.turns().length > 0);
  protected readonly canSend = computed(
    () => !this.isSending() && !this.isQuotaExceeded() && this.draft().trim().length > 0,
  );
  protected readonly draftCharacterCount = computed(() => this.draft().length);
  protected readonly activeSessionTitle = computed(() => {
    const id = this.activeSessionId();
    if (!id) return 'Trợ lý AI FinFlow';
    return this.sessions().find((s) => s.id === id)?.title || 'Hội thoại';
  });
  protected readonly currentWorkspaceRole = computed(() => {
    const raw = (this.workspaceState().workspace?.role ?? '').toString();
    const normalized = raw.replace(/[\s_-]+/g, '').toLowerCase();
    if (normalized.includes('superadmin')) return 'SuperAdmin';
    if (normalized.includes('tenantadmin') || normalized.includes('owner')) return 'TenantAdmin';
    if (normalized.includes('accountant')) return 'Accountant';
    if (normalized.includes('manager')) return 'Manager';
    if (normalized.includes('staff') || normalized.includes('employee')) return 'Staff';
    return 'Other';
  });
  protected readonly suggestedPrompts = computed(() => {
    const role = this.currentWorkspaceRole();
    const rolePrompts =
      role === 'Manager'
        ? MANAGER_SUGGESTED_PROMPTS
        : role === 'TenantAdmin' || role === 'Accountant'
          ? TENANT_LEVEL_SUGGESTED_PROMPTS
          : STAFF_SUGGESTED_PROMPTS;
    return [...MAGICPATH_SUGGESTED_PROMPTS, ...rolePrompts];
  });
  protected readonly totalTokens = computed(() =>
    this.turns().reduce((sum, t) => sum + (t.tokenUsage ?? 0), 0),
  );
  protected readonly filteredSessions = computed(() => {
    const query = this.sessionSearch().trim().toLowerCase();
    if (!query) return this.sessions();
    return this.sessions().filter((session) => {
      const title = (session.title ?? '').toLowerCase();
      return title.includes(query);
    });
  });
  protected readonly chatbotUsage = computed(() => {
    const subscription = this.subscriptionState().subscription;
    const used =
      subscription?.currentMemberUsage.chatbotMessagesUsed ??
      subscription?.usage.chatbotMessagesUsed ??
      0;
    const limit =
      subscription?.entitlements.memberMonthlyChatbotMessages ||
      subscription?.entitlements.workspaceMonthlyChatbotMessages ||
      0;
    const percent = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
    return { used, limit, percent };
  });
  protected readonly isQuotaExceeded = computed(() => {
    const usage = this.chatbotUsage();
    return usage.limit > 0 && usage.used >= usage.limit;
  });
  protected readonly shouldWarnQuota = computed(() => {
    const usage = this.chatbotUsage();
    return usage.limit > 0 && usage.percent >= 90;
  });
  protected readonly userInitials = computed(() => {
    const email = this.workspaceState().workspace?.email ?? '';
    return this.initialsFromText(email || 'User');
  });

  constructor() {
    effect(() => {
      const tenantId = this.workspaceState().workspace?.tenantId;
      if (tenantId) {
        this.currentSubscriptionFacade.ensureLoaded(tenantId);
        this.loadSessions();
      } else {
        this.currentSubscriptionFacade.ensureLoaded(null);
      }
    });
  }

  // ─── Sessions ────────────────────────────────────────────────────
  protected loadSessions(): void {
    this.isLoadingSessions.set(true);
    this.chatApi
      .getSessions(20)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (sessions) => {
          this.sessions.set(sessions);
          this.isLoadingSessions.set(false);
        },
        error: (err: Error) => {
          this.errorMessage.set(toUserFacingError(err.message));
          this.isLoadingSessions.set(false);
        },
      });
  }

  protected selectSession(sessionId: string): void {
    if (this.activeSessionId() === sessionId) return;
    this.activeSessionId.set(sessionId);
    this.errorMessage.set(null);
    this.isLoadingHistory.set(true);
    this.turns.set([]);

    this.chatApi
      .getHistory(sessionId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (history) => {
          this.turns.set(history.map((m) => this.toTurn(m)));
          this.isLoadingHistory.set(false);
          queueMicrotask(() => this.scrollToBottom());
        },
        error: (err: Error) => {
          this.errorMessage.set(toUserFacingError(err.message));
          this.isLoadingHistory.set(false);
        },
      });
  }

  protected newConversation(): void {
    this.activeSessionId.set(null);
    this.turns.set([]);
    this.errorMessage.set(null);
    this.draft.set('');
  }

  // ─── Send message ────────────────────────────────────────────────
  protected onDraftChange(value: string): void {
    this.draft.set(value.slice(0, 2000));
  }

  protected onSessionSearchChange(value: string): void {
    this.sessionSearch.set(value);
  }

  protected onTextareaKeydown(event: KeyboardEvent): void {
    // Send on Enter without Shift; allow Shift+Enter for newline
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  protected applySuggestedPrompt(prompt: string): void {
    this.draft.set(prompt);
  }

  protected send(): void {
    if (!this.canSend()) return;
    const query = this.draft().trim();
    if (!query) return;

    const userTurn: ChatTurn = {
      id: 'tmp-user-' + Date.now(),
      role: 'user',
      content: query,
      createdAt: new Date().toISOString(),
    };
    const pendingAssistant: ChatTurn = {
      id: 'tmp-assistant-' + Date.now(),
      role: 'assistant',
      content: '',
      createdAt: new Date().toISOString(),
      isPending: true,
    };
    this.turns.update((t) => [...t, userTurn, pendingAssistant]);
    this.draft.set('');
    this.isSending.set(true);
    this.errorMessage.set(null);
    queueMicrotask(() => this.scrollToBottom());

    this.chatApi
      .sendMessage({
        sessionId: this.activeSessionId(),
        query,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          // Replace pending assistant turn with real response
          this.turns.update((t) =>
            t.map((turn) =>
              turn.id === pendingAssistant.id
                ? {
                    id: response.messageId,
                    role: 'assistant' as const,
                    content: response.answer,
                    createdAt: new Date().toISOString(),
                    answerSource: response.answerSource,
                    citations: response.citations ?? undefined,
                    tokenUsage: response.tokenUsage,
                    documentCount: response.documentCount,
                  }
                : turn,
            ),
          );
          this.activeSessionId.set(response.sessionId);
          this.currentSubscriptionFacade.recordChatbotUsage(1);
          this.currentSubscriptionFacade.refresh({ silent: true });
          this.isSending.set(false);
          // Refresh sessions list to surface new session
          this.loadSessions();
          queueMicrotask(() => this.scrollToBottom());
        },
        error: (err: Error) => {
          this.turns.update((t) => t.filter((turn) => turn.id !== pendingAssistant.id));
          this.errorMessage.set(toUserFacingError(err.message));
          this.isSending.set(false);
        },
      });
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  protected toggleSidebar(): void {
    this.isSidebarOpen.update((v) => !v);
  }

  protected stopStreaming(): void {
    this.isSending.set(false);
    this.turns.update((turns) => turns.filter((turn) => !turn.isPending));
  }

  private toTurn(m: ChatMessageDto): ChatTurn {
    const role: ChatTurn['role'] = (m.role || '').toLowerCase().startsWith('assistant')
      ? 'assistant'
      : (m.role || '').toLowerCase().startsWith('system')
        ? 'system'
        : 'user';
    return {
      id: m.id,
      role,
      content: m.content,
      createdAt: m.createdAt,
      tokenUsage: m.tokenCount ?? undefined,
    };
  }

  protected answerSourceLabel(source?: ChatAnswerSourceDto): string | null {
    if (source === 'GENERAL') return 'Trợ lý chung';
    if (source === 'REPORTING') return 'Báo cáo hệ thống';
    if (source === 'RAG') return 'Chứng từ nội bộ';
    return null;
  }

  protected isReportingTurn(turn: ChatTurn): boolean {
    return turn.answerSource === 'REPORTING';
  }

  private scrollToBottom(): void {
    const el = this.messagesEnd?.nativeElement;
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }

  protected formatTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  protected formatRelativeDate(iso: string | null): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    const now = Date.now();
    const diffMin = Math.floor((now - d.getTime()) / 60000);
    if (diffMin < 1) return 'Vừa xong';
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHrs = Math.floor(diffMin / 60);
    if (diffHrs < 24) return `${diffHrs} giờ trước`;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  }

  protected sessionInitial(s: ChatSessionSummaryDto): string {
    const t = (s.title ?? '').trim();
    return t ? t.charAt(0).toUpperCase() : '?';
  }

  protected formatNumber(value: number): string {
    return new Intl.NumberFormat('vi-VN').format(Math.max(0, Math.floor(value)));
  }

  protected sessionPreview(s: ChatSessionSummaryDto): string {
    return `${s.messageCount} tin nhắn trong phiên`;
  }

  protected initialsFromText(text: string): string {
    const local = text.replace(/@.*/, '');
    const parts = local.split(/[\s._-]+/).filter(Boolean);
    const initials = parts.slice(0, 3).map((part) => part[0]?.toUpperCase()).join('');
    return initials || 'U';
  }

  protected citationRef(citation: ChatCitation): string {
    return `${citation.chunkType || 'Tài liệu'} · ${citation.documentId}`;
  }

  /**
   * Parses a flat assistant message into structured blocks so the UI can render
   * headings, "label: value" rows, and bullet lists clearly instead of one dense
   * paragraph. Falls back to a single paragraph block when there's no structure.
   */
  protected parseContentBlocks(content: string): ContentBlock[] {
    if (!content) {
      return [];
    }

    const rawLines = content
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (rawLines.length === 0) {
      return [{ type: 'paragraph', text: content.trim() }];
    }

    const blocks: ContentBlock[] = [];

    for (const line of rawLines) {
      // Bullet line: "- ..." or "• ..." or "* ..."
      const bulletMatch = line.match(/^([-•*])\s+(.*)$/);
      if (bulletMatch) {
        blocks.push({ type: 'bullet', text: this.stripLeadingNumber(bulletMatch[2]) });
        continue;
      }

      // Numbered list line: "1. ..." or "1) ..."
      const numberedMatch = line.match(/^\d+[.)]\s+(.*)$/);
      if (numberedMatch) {
        blocks.push({ type: 'bullet', text: numberedMatch[1] });
        continue;
      }

      // Heading line: ends with ":" and has no value after it.
      if (line.endsWith(':') && line.length <= 80) {
        blocks.push({ type: 'heading', text: line.replace(/:\s*$/, '') });
        continue;
      }

      // Key-value line: "Label: value" (label part is short, value is non-empty).
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0 && colonIndex <= 48 && colonIndex < line.length - 1) {
        const label = line.slice(0, colonIndex).trim();
        const value = line.slice(colonIndex + 1).trim();
        // Only treat as key-value when the label looks like a label (no sentence punctuation).
        if (value.length > 0 && !/[.!?]$/.test(label)) {
          blocks.push({
            type: 'keyvalue',
            label,
            valueSegments: value
              .split('·')
              .map((segment) => segment.trim())
              .filter((segment) => segment.length > 0),
          });
          continue;
        }
      }

      blocks.push({ type: 'paragraph', text: line });
    }

    return blocks;
  }

  private stripLeadingNumber(text: string): string {
    return text.replace(/^\d+[.)]\s*/, '').trim();
  }

  protected openCitation(citation: ChatCitation): void {
    void this.router.navigate(['/app/documents/submitted', citation.documentId]);
  }
}
