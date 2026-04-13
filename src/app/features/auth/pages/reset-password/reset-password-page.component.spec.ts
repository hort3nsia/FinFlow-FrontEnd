import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, ReplaySubject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ResetPasswordPageComponent } from './reset-password-page.component';
import { AuthService } from '../../../../core/auth/auth.service';

describe('ResetPasswordPageComponent', () => {
  let queryParamMap$: ReplaySubject<ReturnType<typeof convertToParamMap>>;

  const authService = {
    forgotPassword: vi.fn(),
    verifyPasswordResetToken: vi.fn(),
    resetPasswordByToken: vi.fn(),
    resetPasswordByOtp: vi.fn(),
    goToLogin: vi.fn(),
  };

  beforeEach(() => {
    Object.values(authService).forEach((mockFn) => mockFn.mockReset());
    localStorage.clear();
    queryParamMap$ = new ReplaySubject(1);
    queryParamMap$.next(
      convertToParamMap({
        token: 'reset-token-123',
        email: 'demo@finflow.local',
      }),
    );

    TestBed.configureTestingModule({
      imports: [ResetPasswordPageComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                token: 'reset-token-123',
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

  it('checks the token on init and shows the password form when it is valid', () => {
    authService.verifyPasswordResetToken.mockReturnValue(of(true));

    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.detectChanges();

    expect(authService.verifyPasswordResetToken).toHaveBeenCalledWith('reset-token-123');
    expect(fixture.nativeElement.textContent).toContain('Đặt mật khẩu mới');
    expect(fixture.nativeElement.textContent).toContain('Đặt lại mật khẩu');
  });

  it('falls back to otp reset when token verification fails', () => {
    authService.verifyPasswordResetToken.mockReturnValue(
      throwError(() => new Error('Liên kết đã hết hạn.')),
    );

    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Liên kết đã hết hạn.');
    expect(fixture.nativeElement.textContent).toContain('Nhập mã xác thực');
    expect(fixture.nativeElement.textContent).toContain('Tiếp tục');
  });

  it('shows the email-sent guidance when arriving from forgot password without a token', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      imports: [ResetPasswordPageComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                email: 'demo@finflow.local',
                sent: '1',
              }),
            },
            queryParamMap: of(
              convertToParamMap({
                email: 'demo@finflow.local',
                sent: '1',
              }),
            ),
          },
        },
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    });

    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Chúng tôi đã gửi liên kết đặt lại mật khẩu và mã OTP dự phòng.');
    expect(fixture.nativeElement.textContent).toContain('Mở Gmail');
    expect(fixture.nativeElement.textContent).toContain('Gửi lại liên kết và mã OTP');
  });

  it('updates the current tab when another tab verifies a reset token', async () => {
    authService.verifyPasswordResetToken.mockReturnValue(of(true));

    TestBed.resetTestingModule();
    queryParamMap$ = new ReplaySubject(1);
    queryParamMap$.next(
      convertToParamMap({
        email: 'demo@finflow.local',
        sent: '1',
      }),
    );

    TestBed.configureTestingModule({
      imports: [ResetPasswordPageComponent],
      providers: [
        provideRouter([]),
        provideLocationMocks(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
                email: 'demo@finflow.local',
                sent: '1',
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
    const syncFixture = TestBed.createComponent(ResetPasswordPageComponent);
    syncFixture.detectChanges();

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: 'finflow:password-reset:token-sync',
        newValue: JSON.stringify({ token: 'verified-reset-token' }),
      }),
    );

    expect(navigateSpy).toHaveBeenCalledWith([], {
      relativeTo: TestBed.inject(ActivatedRoute),
      queryParams: { token: 'verified-reset-token' },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  });

  it('shows handoff state instead of a second password form when another reset tab is already active', () => {
    localStorage.setItem(
      'finflow:password-reset:active-tab',
      JSON.stringify({
        tabId: 'another-tab',
        at: Date.now(),
      }),
    );
    authService.verifyPasswordResetToken.mockReturnValue(of(true));

    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Đang quay lại tab trước');
    expect(fixture.nativeElement.textContent).toContain('Đang đóng tab này...');
  });

  it('submits a token-based reset and redirects back to login after success', () => {
    vi.useFakeTimers();
    authService.verifyPasswordResetToken.mockReturnValue(of(true));
    authService.resetPasswordByToken.mockReturnValue(of(true));
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.detectChanges();

    fixture.componentInstance['passwordForm'].setValue({
      newPassword: 'Pass@word2',
      confirmPassword: 'Pass@word2',
    });
    fixture.componentInstance['submitTokenReset']();
    fixture.detectChanges();

    expect(authService.resetPasswordByToken).toHaveBeenCalledWith('reset-token-123', 'Pass@word2');
    expect(fixture.nativeElement.textContent).toContain('Mật khẩu đã được cập nhật');

    vi.advanceTimersByTime(2500);
    expect(navigateSpy).toHaveBeenCalledWith('/login');
    vi.useRealTimers();
  });

  it('keeps the user on the password step when the backend rejects the new password policy', () => {
    authService.verifyPasswordResetToken.mockReturnValue(of(true));
    authService.resetPasswordByToken.mockReturnValue(of(true));

    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.detectChanges();

    fixture.componentInstance['passwordForm'].setValue({
      newPassword: 'weakpass',
      confirmPassword: 'weakpass',
    });
    fixture.componentInstance['submitTokenReset']();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Đặt mật khẩu mới');
    expect(fixture.nativeElement.textContent).toContain('Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.');
    expect(fixture.nativeElement.textContent).not.toContain('Nhập mã xác thực');
    expect(authService.resetPasswordByToken).not.toHaveBeenCalled();
  });

  it('submits an otp-based reset with the current form values', () => {
    authService.verifyPasswordResetToken.mockReturnValue(
      throwError(() => new Error('Liên kết không hợp lệ.')),
    );
    authService.resetPasswordByOtp.mockReturnValue(of(true));

    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.detectChanges();

    fixture.componentInstance['otpResetForm'].setValue({
      email: 'demo@finflow.local',
      otp: '654321',
    });
    fixture.componentInstance['submitOtpReset']();

    fixture.componentInstance['otpPasswordForm'].setValue({
      newPassword: 'Pass@word2',
      confirmPassword: 'Pass@word2',
    });
    fixture.componentInstance['submitOtpPasswordReset']();

    expect(authService.resetPasswordByOtp).toHaveBeenCalledWith({
      email: 'demo@finflow.local',
      otp: '654321',
      newPassword: 'Pass@word2',
    });
  });

  it('resends reset instructions to the current email in otp mode', () => {
    authService.verifyPasswordResetToken.mockReturnValue(
      throwError(() => new Error('Liên kết không hợp lệ.')),
    );
    authService.forgotPassword.mockReturnValue(of({ accepted: true, cooldownSeconds: 120 }));

    const fixture = TestBed.createComponent(ResetPasswordPageComponent);
    fixture.detectChanges();

    fixture.componentInstance['otpResetForm'].controls.email.setValue('demo@finflow.local');
    fixture.componentInstance['resendResetInstructions']();
    fixture.detectChanges();

    expect(authService.forgotPassword).toHaveBeenCalledWith('demo@finflow.local');
    expect(fixture.nativeElement.textContent).toContain('Chúng tôi đã gửi lại liên kết đặt lại mật khẩu');
  });
});
