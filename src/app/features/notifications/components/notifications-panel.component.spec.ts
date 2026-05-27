import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { NotificationsApiService } from '../data/notifications-api.service';
import { NotificationsPanelComponent } from './notifications-panel.component';

describe('NotificationsPanelComponent', () => {
  const notificationsApi = {
    getMyNotifications: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  };
  const router = {
    navigateByUrl: vi.fn(),
  };

  const createComponent = (): ComponentFixture<NotificationsPanelComponent> => {
    const fixture = TestBed.createComponent(NotificationsPanelComponent);
    fixture.componentRef.setInput('isOpen', true);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    notificationsApi.getMyNotifications.mockReset();
    notificationsApi.markAsRead.mockReset();
    notificationsApi.markAllAsRead.mockReset();
    router.navigateByUrl.mockReset();
    notificationsApi.getMyNotifications.mockReturnValue(
      of([
        {
          id: 'notification-1',
          type: 'DocumentSubmitted',
          title: 'Chứng từ đã được gửi',
          body: 'Mở chứng từ để xem chi tiết.',
          payloadJson: JSON.stringify({ documentId: 'document-1' }),
          severity: 'info',
          isRead: false,
          readAt: null,
          createdAt: '2026-05-25T06:00:00Z',
        },
      ]),
    );
    notificationsApi.markAsRead.mockReturnValue(of(true));
    notificationsApi.markAllAsRead.mockReturnValue(of(1));

    TestBed.configureTestingModule({
      imports: [NotificationsPanelComponent],
      providers: [
        { provide: NotificationsApiService, useValue: notificationsApi },
        { provide: Router, useValue: router },
      ],
    });
  });

  it('deep-links document notifications to an existing submitted document route', () => {
    const fixture = createComponent();

    fixture.nativeElement.querySelector('li button').click();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/app/documents/submitted/document-1');
  });
});
