import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  EventEmitter,
  Input,
  Output,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import {
  NotificationDto,
  NotificationsApiService,
} from '../data/notifications-api.service';

interface ParsedPayload {
  documentId?: string;
  expenseId?: string;
  paymentId?: string;
  budgetId?: string;
  approvalId?: string;
  [key: string]: unknown;
}

@Component({
  selector: 'app-notifications-panel',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications-panel.component.html',
  styleUrl: './notifications-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsPanelComponent {
  private readonly api = inject(NotificationsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @Input() set isOpen(value: boolean) {
    this.isOpenSignal.set(value);
    if (value) this.refresh();
  }
  get isOpen(): boolean {
    return this.isOpenSignal();
  }
  @Output() close = new EventEmitter<void>();

  protected readonly isOpenSignal = signal(false);

  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly notifications = signal<NotificationDto[]>([]);
  protected readonly filter = signal<'all' | 'unread'>('all');
  protected readonly isMarkingAll = signal(false);
  protected readonly markingId = signal<string | null>(null);

  protected readonly filteredItems = computed(() => {
    const items = this.notifications();
    return this.filter() === 'unread' ? items.filter((n) => !n.isRead) : items;
  });

  protected readonly unreadCount = computed(
    () => this.notifications().filter((n) => !n.isRead).length,
  );

  constructor() {
    // Auto-refresh when panel opens
    effect(() => {
      if (this.isOpenSignal()) {
        // already triggered via @Input setter
      }
    });
  }

  protected refresh(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.api
      .getMyNotifications(false, 50)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (items) => {
          this.notifications.set(items);
          this.isLoading.set(false);
        },
        error: (err: Error) => {
          this.errorMessage.set(err.message);
          this.isLoading.set(false);
        },
      });
  }

  protected onClose(): void {
    this.close.emit();
  }

  protected setFilter(value: 'all' | 'unread'): void {
    this.filter.set(value);
  }

  protected markAllAsRead(): void {
    if (this.isMarkingAll() || this.unreadCount() === 0) return;
    this.isMarkingAll.set(true);
    this.api
      .markAllAsRead()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notifications.update((items) =>
            items.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
          );
          this.isMarkingAll.set(false);
        },
        error: (err: Error) => {
          this.errorMessage.set(err.message);
          this.isMarkingAll.set(false);
        },
      });
  }

  protected onItemClick(notification: NotificationDto): void {
    if (!notification.isRead) {
      this.markingId.set(notification.id);
      this.api
        .markAsRead(notification.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: () => {
            this.notifications.update((items) =>
              items.map((n) =>
                n.id === notification.id
                  ? { ...n, isRead: true, readAt: new Date().toISOString() }
                  : n,
              ),
            );
            this.markingId.set(null);
          },
          error: () => this.markingId.set(null),
        });
    }
    // Optional deep-linking based on payload type
    const route = this.deepLinkRoute(notification);
    if (route) {
      this.router.navigateByUrl(route);
      this.onClose();
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────
  protected severityClass(severity: string): string {
    const s = (severity ?? '').toLowerCase();
    if (s.includes('error') || s.includes('critical')) return 'bg-rose-50 text-rose-700';
    if (s.includes('warn')) return 'bg-amber-50 text-amber-700';
    if (s.includes('success')) return 'bg-emerald-50 text-emerald-700';
    return 'bg-indigo-50 text-indigo-700';
  }

  protected severityDotClass(severity: string): string {
    const s = (severity ?? '').toLowerCase();
    if (s.includes('error') || s.includes('critical')) return 'bg-rose-500';
    if (s.includes('warn')) return 'bg-amber-500';
    if (s.includes('success')) return 'bg-emerald-500';
    return 'bg-indigo-500';
  }

  protected formatRelativeTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return 'Vừa xong';
    if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
    if (diff < 7 * 86400) return `${Math.floor(diff / 86400)} ngày trước`;
    return d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private deepLinkRoute(notification: NotificationDto): string | null {
    let payload: ParsedPayload = {};
    try {
      payload = (JSON.parse(notification.payloadJson || '{}') ?? {}) as ParsedPayload;
    } catch {
      payload = {};
    }
    const type = (notification.type ?? '').toLowerCase();
    if (type.includes('approval') || type.includes('escalation')) return '/app/approvals';
    if (type.includes('payment')) return '/app/payments';
    if (type.includes('budget')) return '/app/budgets';
    if (type.includes('document')) {
      if (payload.documentId) return `/app/documents/submitted/${payload.documentId}`;
      return '/app/documents';
    }
    if (type.includes('vendor')) return '/app/vendors';
    return null;
  }
}
