import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { API_BASE_URL } from '../../../core/config/api-base-url.token';

interface GraphQlError {
  message: string;
  extensions?: { code?: string };
}
interface GraphQlResponse<TData> {
  data?: TData;
  errors?: GraphQlError[];
}

export interface ChatCitation {
  chunkNumber: number;
  chunkId: string;
  documentId: string;
  chunkType: string;
  preview: string;
}

export type ChatAnswerSourceDto = 'GENERAL' | 'REPORTING' | 'RAG';

export interface ChatResponseDto {
  answer: string;
  answerSource: ChatAnswerSourceDto;
  sessionId: string;
  messageId: string;
  documentCount: number;
  tokenUsage: number;
  citations: ChatCitation[] | null;
}

export interface ChatMessageDto {
  id: string;
  sessionId: string;
  senderId: string | null;
  role: string;
  content: string;
  tokenCount: number | null;
  createdAt: string;
}

export interface ChatSessionSummaryDto {
  id: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: string | null;
}

export interface ChatInput {
  sessionId?: string | null;
  query: string;
  departmentId?: string | null;
}

const CHAT_MUTATION = `
  mutation Chat($input: ChatInput!) {
    chat(input: $input) {
      answer
      answerSource
      sessionId
      messageId
      documentCount
      tokenUsage
      citations {
        chunkNumber
        chunkId
        documentId
        chunkType
        preview
      }
    }
  }
`;

const SESSIONS_QUERY = `
  query GetChatSessions($limit: Int!) {
    getChatSessions(limit: $limit) {
      id
      title
      messageCount
      lastMessageAt
    }
  }
`;

const HISTORY_QUERY = `
  query GetChatHistory($sessionId: UUID!) {
    getChatHistory(sessionId: $sessionId) {
      id
      sessionId
      senderId
      role
      content
      tokenCount
      createdAt
    }
  }
`;

const extractGraphQlMessage = (errors?: GraphQlError[]): string | null =>
  errors?.[0]?.message ?? null;

@Injectable({ providedIn: 'root' })
export class ChatApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = inject(API_BASE_URL);

  sendMessage(input: ChatInput): Observable<ChatResponseDto> {
    return this.http
      .post<GraphQlResponse<{ chat: ChatResponseDto }>>(this.endpoint, {
        query: CHAT_MUTATION,
        variables: { input },
      })
      .pipe(
        map((response) => this.extractData(response, 'Chat did not return data.').chat),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getSessions(limit = 20): Observable<ChatSessionSummaryDto[]> {
    return this.http
      .post<GraphQlResponse<{ getChatSessions: ChatSessionSummaryDto[] }>>(this.endpoint, {
        query: SESSIONS_QUERY,
        variables: { limit },
      })
      .pipe(
        map(
          (response) =>
            this.extractData(response, 'GetChatSessions did not return data.').getChatSessions,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  getHistory(sessionId: string): Observable<ChatMessageDto[]> {
    return this.http
      .post<GraphQlResponse<{ getChatHistory: ChatMessageDto[] }>>(this.endpoint, {
        query: HISTORY_QUERY,
        variables: { sessionId },
      })
      .pipe(
        map(
          (response) =>
            this.extractData(response, 'GetChatHistory did not return data.').getChatHistory,
        ),
        catchError((error: unknown) => this.mapTransportError(error)),
      );
  }

  private extractData<T>(response: GraphQlResponse<T>, missingMessage: string): T {
    if (!response) {
      throw new Error(missingMessage);
    }

    const message = extractGraphQlMessage(response.errors);
    if (message) throw new Error(message);
    if (!response.data) throw new Error(missingMessage);
    return response.data;
  }

  private mapTransportError(error: unknown): Observable<never> {
    if (error instanceof HttpErrorResponse) {
      const message = extractGraphQlMessage(
        error.error && typeof error.error === 'object' ? (error.error as { errors?: GraphQlError[] }).errors : undefined,
      );
      return throwError(
        () => new Error(message ?? error.message ?? 'Unable to complete the request.'),
      );
    }
    if (error instanceof Error) return throwError(() => error);
    return throwError(() => new Error('Unable to complete the request.'));
  }
}
