import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { API_BASE_URL } from '../config/api-base-url.token';

const normalizeEndpoint = (value: string): string => value.replace(/\/+$/, '');

const isGraphQlRequest = (requestUrl: string, graphQlEndpoint: string): boolean => {
  const normalizedRequest = normalizeEndpoint(requestUrl);
  const normalizedEndpoint = normalizeEndpoint(graphQlEndpoint);

  return (
    normalizedRequest === normalizedEndpoint ||
    normalizedRequest.startsWith(`${normalizedEndpoint}?`)
  );
};

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const token = inject(AuthService).getAccessToken();
  const graphQlEndpoint = inject(API_BASE_URL);

  if (!token || !isGraphQlRequest(request.url, graphQlEndpoint)) {
    return next(request);
  }

  return next(
    request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }),
  );
};
