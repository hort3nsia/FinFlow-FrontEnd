import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { vi } from 'vitest';
import { VerifyEmailPageComponent } from './verify-email-page.component';
import { AuthService } from '../../../../core/auth/auth.service';

describe('VerifyEmailPageComponent', () => {
  const authService = {
    verifyEmailByToken: vi.fn(),
    verifyEmailByOtp: vi.fn(),
    resendEmailVerification: vi.fn(),
  };

  beforeEach(() => {
    Object.values(authService).forEach((mockFn) => mockFn.mockReset());

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
