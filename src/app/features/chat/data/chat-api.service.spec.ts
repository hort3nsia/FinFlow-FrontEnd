import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../../core/config/api-base-url.token';
import { ChatApiService } from './chat-api.service';

describe('ChatApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: API_BASE_URL,
          useValue: '/graphql',
        },
      ],
    });
  });

  it('requests and maps answerSource from the chat graphql payload', () => {
    const service = TestBed.inject(ChatApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let actual: unknown;

    service.sendMessage({ query: 'Tháng này tôi đã tiêu bao nhiêu?' }).subscribe((value) => {
      actual = value;
    });

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.body.query).toContain('answerSource');

    request.flush({
      data: {
        chat: {
          answer: 'Tổng chi tháng này là 12 VND.',
          answerSource: 'REPORTING',
          sessionId: 'session-1',
          messageId: 'message-1',
          documentCount: 0,
          tokenUsage: 0,
          citations: [],
        },
      },
    });

    expect(actual).toEqual({
      answer: 'Tổng chi tháng này là 12 VND.',
      answerSource: 'REPORTING',
      sessionId: 'session-1',
      messageId: 'message-1',
      documentCount: 0,
      tokenUsage: 0,
      citations: [],
    });
    httpTesting.verify();
  });

  it('surfaces a stable error when graphql returns a null body', () => {
    const service = TestBed.inject(ChatApiService);
    const httpTesting = TestBed.inject(HttpTestingController);
    let actualError: string | null = null;

    service.sendMessage({ query: 'abc' }).subscribe({
      next: () => {
        throw new Error('Expected request to fail.');
      },
      error: (error: Error) => {
        actualError = error.message;
      },
    });

    const request = httpTesting.expectOne('/graphql');
    request.flush(null, { status: 200, statusText: 'OK' });

    expect(actualError).toBe('Chat did not return data.');
    httpTesting.verify();
  });
});
