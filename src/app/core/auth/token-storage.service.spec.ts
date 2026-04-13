import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { TokenStorageService } from './token-storage.service';

describe('TokenStorageService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
    localStorage.clear();
  });

  it('returns null when storage read throws', () => {
    const service = TestBed.inject(TokenStorageService);
    const getItemSpy = vi
      .spyOn(Storage.prototype, 'getItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });

    expect(service.getAccessToken()).toBeNull();
    expect(getItemSpy).toHaveBeenCalled();

    getItemSpy.mockRestore();
  });

  it('stores and returns the access token', () => {
    const service = TestBed.inject(TokenStorageService);

    service.setAccessToken('access-123');

    expect(service.getAccessToken()).toBe('access-123');
  });

  it('swallows storage write and clear failures', () => {
    const service = TestBed.inject(TokenStorageService);
    const setItemSpy = vi
      .spyOn(Storage.prototype, 'setItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });
    const removeItemSpy = vi
      .spyOn(Storage.prototype, 'removeItem')
      .mockImplementation(() => {
        throw new Error('blocked');
      });

    expect(() => service.setAccessToken('access-123')).not.toThrow();
    expect(() => service.clear()).not.toThrow();
    expect(setItemSpy).toHaveBeenCalled();
    expect(removeItemSpy).toHaveBeenCalled();

    setItemSpy.mockRestore();
    removeItemSpy.mockRestore();
  });
});
