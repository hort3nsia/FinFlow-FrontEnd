import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { InMemoryCache } from '@apollo/client';
import { provideRouter } from '@angular/router';
import { provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';

import { routes } from './app.routes';
import { API_BASE_URL } from './core/config/api-base-url.token';
import { authInterceptor } from './core/interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideApollo(() => {
      const httpLink = inject(HttpLink);
      const uri = inject(API_BASE_URL);

      return {
        link: httpLink.create({ uri }),
        cache: new InMemoryCache(),
      };
    }),
  ],
};
