import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { ForgotPasswordPageComponent } from './forgot-password-page.component';
import { AuthService } from '../../../../core/auth/auth.service';

describe('ForgotPasswordPageComponent', () => {
  const authService = {
    forgotPassword: vi.fn(),
  };

  beforeEach(() => {
    authService.forgotPassword.mockReset();

    TestBed.configureTestingModule({
      imports: [ForgotPasswordPageComponent],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({
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

  it('renders the reset request copy and prefills the email from the route', () => {
    const fixture = TestBed.createComponent(ForgotPasswordPageComponent);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const emailInput = host.querySelector('input[formcontrolname="email"]') as HTMLInputElement | null;

    expect(host.textContent).toContain('Quên mật khẩu?');
    expect(host.textContent).toContain('Chúng tôi sẽ gửi hướng dẫn đặt lại mật khẩu đến email của bạn.');
    expect(host.textContent).toContain('Đặt lại mật khẩu');
    expect(emailInput?.value).toBe('demo@finflow.local');
    expect(host.querySelector('.forgot-password-page__window-bar')).toBeNull();
  });

  it('submits the current email and routes to reset password', () => {
    authService.forgotPassword.mockReturnValue(of({ accepted: true, cooldownSeconds: 120 }));
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const fixture = TestBed.createComponent(ForgotPasswordPageComponent);
    fixture.detectChanges();

    fixture.componentInstance['submit']();
    fixture.detectChanges();

    expect(authService.forgotPassword).toHaveBeenCalledWith('demo@finflow.local');
    expect(navigateSpy).toHaveBeenCalledWith(['/reset-password'], {
      queryParams: {
        email: 'demo@finflow.local',
        sent: '1',
      },
    });
  });

  it('shows backend errors when the forgot password request fails', () => {
    authService.forgotPassword.mockReturnValue(
      throwError(() => new Error('Không thể gửi email lúc này.')),
    );

    const fixture = TestBed.createComponent(ForgotPasswordPageComponent);
    fixture.detectChanges();

    fixture.componentInstance['submit']();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Không thể gửi email lúc này.');
  });
});
