import { Injectable } from '@angular/core';

const ACCESS_TOKEN_KEY = 'finflow.accessToken';

@Injectable({
  providedIn: 'root',
})
export class TokenStorageService {
  private get storage(): Storage | null {
    return typeof localStorage === 'undefined' ? null : localStorage;
  }

  setAccessToken(token: string): void {
    const storage = this.storage;
    if (storage) {
      try {
        storage.setItem(ACCESS_TOKEN_KEY, token);
      } catch {
        console.warn('Failed to store access token');
      }
    }
  }

  getAccessToken(): string | null {
    const storage = this.storage;
    if (!storage) {
      return null;
    }

    try {
      return storage.getItem(ACCESS_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  clear(): void {
    const storage = this.storage;
    if (storage) {
      try {
        storage.removeItem(ACCESS_TOKEN_KEY);
      } catch {
        // Safe fallback
      }
    }
  }

  // Note: RefreshToken should be handled via httpOnly cookies by the backend
  // Frontend does not need to store or read refreshToken manually
  // Browser automatically sends cookies with requests
}