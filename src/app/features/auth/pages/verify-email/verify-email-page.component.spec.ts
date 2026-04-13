import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, ReplaySubject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { VerifyEmailPageComponent } from './verify-email-page.component';
import { AuthService } from '../../../../core/auth/auth.service';

describe('VerifyEmailPageComponent', () => {
  let queryParamMap$: ReplaySubject<ReturnType<typeof convertToParamMap>>;

  const authService = {
    verifyEmailByToken: vi.fn(),
    verifyEmailByOtp: vi.fn(),
    resendEmailVerification: vi.fn(),
    goToLogin: vi.fn(),
  };

  beforeEach(() => {
    Object.values(authService).forEach((mockFn) => mockFn.mockReset());
    localStorage.clear();
    queryParamMap$ = new ReplaySubject(1);
    queryParamMap$.next(
      convertToParamMap({
        token: 'token-123',
        email: 'demo@finflow.local',
      }),
    );

    TestBed.configureTestingModule({
      imports: [VerifyEmailPageComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                token: 'token-123',
                email: 'demo@finflow.local',
              }),
            },
            queryParamMap: queryParamMap$.asObservable(),
          },
        },
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });
  });

  it('auto-verifies when the route contains a token and redirects to login after success', () => {
    vi.useFakeTimers();
    authService.verifyEmailByToken.mockReturnValue(of(true));
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(VerifyEmailPageComponent);
    fixture.detectChanges();

    expect(authService.verifyEmailByToken).toHaveBeenCalledWith('token-123');
    expect(fixture.nativeElement.textContent).toContain('Email da duoc xac thuc');

    vi.advanceTimersByTime(3000);
    expect(navigateSpy).toHaveBeenCalledWith('/login');
    vi.useRealTimers();
  });

  it('shows the otp fallback state when token verification fails', () => {
    authService.verifyEmailByToken.mockReturnValue(
      throwError(() => new Error('Token da het han.')),
    );

    const fixture = TestBed.createComponent(VerifyEmailPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Token da het han.');
    expect(fixture.nativeElement.textContent).toContain('Nhập mã OTP');
  });

  it('switches the existing tab to token verification when another tab completes the email link handoff', () => {
    authService.verifyEmailByToken.mockReturnValue(of(true));

    TestBed.resetTestingModule();
    queryParamMap$ = new ReplaySubject(1);
    queryParamMap$.next(
      convertToParamMap({
        email: 'demo@finflow.local',
      }),
    );

    TestBed.configureTestingModule({
      imports: [VerifyEmailPageComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                email: 'demo@finflow.local',
              }),
            },
            queryParamMap: queryParamMap$.asObservable(),
          },
        },
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });

    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(VerifyEmailPageComponent);
    fixture.detectChanges();

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'finflow:verify-email:token-sync',
        newValue: JSON.stringify({ token: 'verified-email-token' }),
      }),
    );

    expect(navigateSpy).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { token: 'verified-email-token' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('submits otp verification with the current form values', () => {
    authService.verifyEmailByToken.mockReturnValue(throwError(() => new Error('Token loi')));
    authService.verifyEmailByOtp.mockReturnValue(of(true));

    const fixture = TestBed.createComponent(VerifyEmailPageComponent);
    fixture.detectChanges();

    fixture.componentInstance['otpForm'].setValue({
      email: 'demo@finflow.local',
      otp: '123456',
    });
    fixture.componentInstance['submitOtp']();

    expect(authService.verifyEmailByOtp).toHaveBeenCalledWith({
      email: 'demo@finflow.local',
      otp: '123456',
    });
  });

  it('resends verification to the current email', () => {
    authService.verifyEmailByToken.mockReturnValue(throwError(() => new Error('Token loi')));
    authService.resendEmailVerification.mockReturnValue(of({ accepted: true, cooldownSeconds: 90 }));

    const fixture = TestBed.createComponent(VerifyEmailPageComponent);
    fixture.detectChanges();
    fixture.componentInstance['otpForm'].controls.email.setValue('demo@finflow.local');

    fixture.componentInstance['resendVerification']();
    fixture.detectChanges();

    expect(authService.resendEmailVerification).toHaveBeenCalledWith('demo@finflow.local');
    expect(fixture.nativeElement.textContent).toContain('90 giay');
  });
});
