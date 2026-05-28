import { Injectable, inject, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { BrandingResponse, SettingsApiService } from './settings-api.service';

export interface TenantBrandingState {
  branding: BrandingResponse | null;
  loading: boolean;
  error: string | null;
  tenantId: string | null;
}

@Injectable({ providedIn: 'root' })
export class TenantBrandingFacade {
  private readonly settingsApi = inject(SettingsApiService);
  private requestSubscription: Subscription | null = null;
  private readonly stateSignal = signal<TenantBrandingState>({
    branding: null,
    loading: false,
    error: null,
    tenantId: null,
  });

  readonly state = this.stateSignal.asReadonly();

  ensureLoaded(tenantId: string | null | undefined): void {
    const normalizedTenantId = tenantId?.trim() || null;
    const current = this.stateSignal();

    if (!normalizedTenantId) {
      this.requestSubscription?.unsubscribe();
      this.requestSubscription = null;
      this.stateSignal.set({ branding: null, loading: false, error: null, tenantId: null });
      return;
    }

    if (
      current.tenantId === normalizedTenantId &&
      (current.loading || current.branding || current.error)
    ) {
      return;
    }

    this.requestSubscription?.unsubscribe();
    this.stateSignal.set({
      branding: null,
      loading: true,
      error: null,
      tenantId: normalizedTenantId,
    });

    this.requestSubscription = this.settingsApi.getBranding().subscribe({
      next: (branding) => {
        this.stateSignal.set({
          branding,
          loading: false,
          error: null,
          tenantId: normalizedTenantId,
        });
      },
      error: (error: Error) => {
        this.stateSignal.set({
          branding: null,
          loading: false,
          error: error.message,
          tenantId: normalizedTenantId,
        });
      },
    });
  }

  setBranding(branding: BrandingResponse, tenantId?: string | null): void {
    this.stateSignal.set({
      branding,
      loading: false,
      error: null,
      tenantId: tenantId?.trim() || this.stateSignal().tenantId,
    });
  }
}
