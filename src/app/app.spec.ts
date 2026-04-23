import 'zone.js';

import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Apollo } from 'apollo-angular';
import { gql } from 'apollo-angular';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { appConfig } from './app.config';
import { AuthService } from './core/auth/auth.service';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('caches Apollo queries through the configured /graphql endpoint and preserves auth headers', async () => {
    TestBed.configureTestingModule({
      providers: [
        ...appConfig.providers,
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            getAccessToken: () => 'access-123',
          },
        },
      ],
    });

    const apollo = TestBed.inject(Apollo);
    const httpTesting = TestBed.inject(HttpTestingController);
    const query = gql`
      query Health {
        health
      }
    `;

    const firstResult = apollo.client.query({
      query,
    });

    const firstRequest = httpTesting.expectOne('/graphql');

    expect(firstRequest.request.method).toBe('POST');
    expect(firstRequest.request.headers.get('Authorization')).toBe('Bearer access-123');

    firstRequest.flush({ data: { health: 'ok' } });
    await expect(firstResult).resolves.toMatchObject({
      data: { health: 'ok' },
    });

    const secondResult = apollo.client.query({
      query,
    });

    httpTesting.expectNone('/graphql');
    await expect(secondResult).resolves.toMatchObject({
      data: { health: 'ok' },
    });

    httpTesting.verify();
  });
});
