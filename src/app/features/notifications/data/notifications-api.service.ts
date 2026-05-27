import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-base-url.token';

interface GraphQlError {
  message: string;
}
interface GraphQlResponse<TData> {
  data?: TData;
  errors?: GraphQlError[];
}

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  body: string;
  payloadJson: string;
  severity: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

const NOTIFICATION_FIELDS = `
  id
  type
  title
  body
  payloadJson
  severity
  isRead
  readAt
  createdAt
`;

const MY_NOTIFICATIONS_QUERY = `
  query MyNotifications($unreadOnly: Boolean, $limit: Int) {
    myNotifications(unreadOnly: $unreadOnly, limit: $limit) {${NOTIFICATION_FIELDS}}
  }
`;

const UNREAD_COUNT_QUERY = `
  query UnreadNotificationCount {
    unreadNotificationCount
  }
`;

const MARK_AS_READ_MUTATION = `
  mutation MarkNotificationAsRead($id: UUID!) {
    markNotificationAsRead(notificationId: $id)
  }
`;

const MARK_ALL_READ_MUTATION = `
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null =>
  errors?.[0]?.message ?? null;

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(API_BASE_URL);

  getMyNotifications(unreadOnly = false, limit = 50): Observable<NotificationDto[]> {
    return this.http
      .post<GraphQlResponse<{ myNotifications: NotificationDto[] }>>(this.endpoint, {
        query: MY_NOTIFICATIONS_QUERY,
        variables: { unreadOnly, limit },
      })
      .pipe(
        map((response) =>
          this.extractData(response, 'MyNotifications did not return data.').myNotifications,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getUnreadCount(): Observable<number> {
    return this.http
      .post<GraphQlResponse<{ unreadNotificationCount: number }>>(this.endpoint, {
        query: UNREAD_COUNT_QUERY,
      })
      .pipe(
        map(
          (response) =>
            this.extractData(response, 'UnreadNotificationCount did not return data.')
              .unreadNotificationCount,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  markAsRead(notificationId: string): Observable<boolean> {
    return this.http
      .post<GraphQlResponse<{ markNotificationAsRead: boolean }>>(this.endpoint, {
        query: MARK_AS_READ_MUTATION,
        variables: { id: notificationId },
      })
      .pipe(
        map(
          (response) =>
            this.extractData(response, 'MarkNotificationAsRead did not return data.')
              .markNotificationAsRead,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  markAllAsRead(): Observable<number> {
    return this.http
      .post<GraphQlResponse<{ markAllNotificationsAsRead: number }>>(this.endpoint, {
        query: MARK_ALL_READ_MUTATION,
      })
      .pipe(
        map(
          (response) =>
            this.extractData(response, 'MarkAllNotificationsAsRead did not return data.')
              .markAllNotificationsAsRead,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  private extractData<T>(response: GraphQlResponse<T>, missingMessage: string): T {
    const message = extractGraphQlMessage(response.errors);
    if (message) throw new Error(message);
    if (!response.data) throw new Error(missingMessage);
    return response.data;
  }

  private mapTransportError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const message = extractGraphQlMessage(error.error?.errors);
      return throwError(
        () => new Error(message ?? error.message ?? 'Unable to complete the request.'),
      );
    }
    if (error instanceof Error) return throwError(() => error);
    return throwError(() => new Error('Unable to complete the request.'));
  }
}
