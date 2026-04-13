import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../config/api-base-url.token';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: API_BASE_URL,
          useValue: '/graphql',
        },
      ],
    });
  });

  it('adds a bearer token for graphql requests', () => {
    localStorage.setItem(
      'finflow_account_session',
      JSON.stringify({
        accessToken: 'access-123',
        refreshToken: 'refresh-123',
        id: 'account-1',
        email: 'demo@finflow.local',
        sessionKind: 'account',
      }),
    );

    const http = TestBed.inject(HttpClient);
    const httpTesting = TestBed.inject(HttpTestingController);

    http.post('/graphql', { query: '{ health }' }).subscribe();

    const request = httpTesting.expectOne('/graphql');
    expect(request.request.headers.get('Authorization')).toBe('Bearer access-123');

    request.flush({ data: { health: 'OK' } });
    httpTesting.verify();
  });

  it('does not add a bearer token for non-graphql requests', () => {
    localStorage.setItem(
      'finflow_workspace_session',
      JSON.stringify({
        accessToken: 'access-123',
        refreshToken: 'refresh-123',
        id: 'account-1',
        membershipId: 'membership-1',
        email: 'demo@finflow.local',
        role: 'Owner',
        idTenant: 'tenant-1',
        sessionKind: 'workspace',
      }),
    );

    const http = TestBed.inject(HttpClient);
    const httpTesting = TestBed.inject(HttpTestingController);

    http.get('/assets/config.json').subscribe();

    const request = httpTesting.expectOne('/assets/config.json');
    expect(request.request.headers.has('Authorization')).toBe(false);

    request.flush({});
    httpTesting.verify();
  });
});
