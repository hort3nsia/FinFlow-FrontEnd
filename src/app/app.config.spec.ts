import 'zone.js';
import { TestBed } from '@angular/core/testing';
import { PreloadAllModules, PreloadingStrategy } from '@angular/router';
import { appConfig } from './app.config';

describe('appConfig', () => {
  it('preloads lazy workspace modules to reduce first navigation delay', () => {
    TestBed.configureTestingModule({
      providers: appConfig.providers,
    });

    expect(TestBed.inject(PreloadingStrategy)).toBeInstanceOf(PreloadAllModules);
  });
});
