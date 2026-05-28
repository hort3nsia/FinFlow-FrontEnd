import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { BrandingResponse } from '../../features/settings/data/settings-api.service';

@Injectable({ providedIn: 'root' })
export class TenantBrandingDocumentService {
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);

  apply(branding: BrandingResponse | null, fallbackName = 'FinFlow'): void {
    const name = branding?.companyDisplayName?.trim() || fallbackName.trim() || 'FinFlow';
    this.title.setTitle(name);
    this.applyFavicon(branding?.faviconUrl?.trim() || branding?.logoUrl?.trim() || 'favicon.ico');
  }

  private applyFavicon(href: string): void {
    let icon = this.document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = this.document.createElement('link');
      icon.setAttribute('rel', 'icon');
      this.document.head.appendChild(icon);
    }

    icon.setAttribute('href', href);
  }
}
