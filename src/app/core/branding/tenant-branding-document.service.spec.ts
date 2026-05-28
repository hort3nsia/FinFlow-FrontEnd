import { DOCUMENT } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { TenantBrandingDocumentService } from './tenant-branding-document.service';

describe('TenantBrandingDocumentService', () => {
  it('applies workspace branding to the browser title and favicon', () => {
    const title = { setTitle: vi.fn() };
    const documentMock = document.implementation.createHTMLDocument('FinFlow');
    const icon = documentMock.createElement('link');
    icon.setAttribute('rel', 'icon');
    icon.setAttribute('href', 'favicon.ico');
    documentMock.head.appendChild(icon);

    TestBed.configureTestingModule({
      providers: [
        TenantBrandingDocumentService,
        { provide: Title, useValue: title },
        { provide: DOCUMENT, useValue: documentMock },
      ],
    });

    const service = TestBed.inject(TenantBrandingDocumentService);

    service.apply({
      logoUrl: 'https://cdn.example.com/logo.svg',
      faviconUrl: 'https://cdn.example.com/favicon.ico',
      primaryColor: '#2563eb',
      companyDisplayName: 'Meridian Finance',
      locale: 'vi-VN',
      timezone: 'Asia/Ho_Chi_Minh',
    });

    expect(title.setTitle).toHaveBeenCalledWith('Meridian Finance');
    expect(documentMock.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(
      'https://cdn.example.com/favicon.ico',
    );
  });

  it('falls back to the logo url for the favicon when favicon is not configured', () => {
    const title = { setTitle: vi.fn() };
    const documentMock = document.implementation.createHTMLDocument('FinFlow');

    TestBed.configureTestingModule({
      providers: [
        TenantBrandingDocumentService,
        { provide: Title, useValue: title },
        { provide: DOCUMENT, useValue: documentMock },
      ],
    });

    const service = TestBed.inject(TenantBrandingDocumentService);

    service.apply(
      {
        logoUrl: 'https://cdn.example.com/logo.svg',
        faviconUrl: null,
        primaryColor: '#2563eb',
        companyDisplayName: null,
        locale: 'vi-VN',
        timezone: 'Asia/Ho_Chi_Minh',
      },
      'Fallback Workspace',
    );

    expect(title.setTitle).toHaveBeenCalledWith('Fallback Workspace');
    expect(documentMock.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe(
      'https://cdn.example.com/logo.svg',
    );
  });
});
