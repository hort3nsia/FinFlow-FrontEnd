import { finalize } from 'rxjs';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { BrandMarkComponent } from '../../../../shared/ui/brand-mark/brand-mark.component';

@Component({
  selector: 'app-reset-password-page',
  imports: [ReactiveFormsModule, RouterLink, BrandMarkComponent],
  templateUrl: './reset-password-page.component.html',
  styleUrl: './reset-password-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ResetPasswordPageComponent implements OnInit {
  private readonly passwordPolicyPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
  private readonly resetPasswordTokenSyncKey = 'finflow:password-reset:token-sync';
  private readonly resetPasswordActiveTabKey = 'finflow:password-reset:active-tab';
  private readonly tabId = globalThis.crypto?.randomUUID?.() ?? `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = signal<'checking' | 'handoff' | 'token' | 'otp' | 'otp-password' | 'success'>('checking');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);
  protected readonly token = signal<string | null>(null);
  protected readonly verifiedOtp = signal<string | null>(null);
  protected readonly verifiedOtpEmail = signal<string | null>(null);
  protected readonly isSubmitting = signal(false);
  protected readonly isPasswordVisible = signal(false);
  protected readonly isConfirmPasswordVisible = signal(false);
  protected readonly isOtpPasswordVisible = signal(false);
  protected readonly isOtpConfirmPasswordVisible = signal(false);
  protected readonly isClosingHandoffTab = signal(false);
  protected readonly handoffCloseFailed = signal(false);

  protected readonly passwordForm = this.formBuilder.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.pattern(this.passwordPolicyPattern)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.matchPasswordValidator },
  );

  protected readonly otpResetForm = this.formBuilder.nonNullable.group(
    {
      email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]],
      otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    },
  );

  protected readonly otpPasswordForm = this.formBuilder.nonNullable.group(
    {
      newPassword: ['', [Validators.required, Validators.pattern(this.passwordPolicyPattern)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: this.matchPasswordValidator },
  );

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((queryParamMap) => {
        this.handleRouteState(
          queryParamMap.get('token'),
          queryParamMap.get('sent') === '1',
          queryParamMap.get('email'),
        );
      });

    window.addEventListener('storage', this.handleTokenSync);
    this.destroyRef.onDestroy(() => window.removeEventListener('storage', this.handleTokenSync));
    this.destroyRef.onDestroy(() => this.releaseActiveTab());
  }

  protected resendResetInstructions(): void {
    const email = this.otpResetForm.controls.email.getRawValue();
    if (!email) {
      this.otpResetForm.controls.email.markAsTouched();
      return;
    }

    if (this.otpResetForm.controls.email.invalid) {
      this.otpResetForm.controls.email.markAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isSubmitting.set(true);

    this.authService
      .forgotPassword(email)
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.infoMessage.set('Chúng tôi đã gửi lại liên kết đặt lại mật khẩu và mã OTP mới cho email của bạn.');
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
        },
      });
  }

  protected openInbox(provider: 'gmail' | 'outlook'): void {
    const href = provider === 'gmail'
      ? 'https://mail.google.com/'
      : 'https://outlook.live.com/mail/';

    window.open(href, '_blank', 'noopener,noreferrer');
  }

  protected togglePasswordVisibility(): void {
    this.isPasswordVisible.update((value) => !value);
  }

  protected toggleConfirmPasswordVisibility(): void {
    this.isConfirmPasswordVisible.update((value) => !value);
  }

  protected toggleOtpPasswordVisibility(): void {
    this.isOtpPasswordVisible.update((value) => !value);
  }

  protected toggleOtpConfirmPasswordVisibility(): void {
    this.isOtpConfirmPasswordVisible.update((value) => !value);
  }

  protected normalizeOtpInput(): void {
    const normalizedOtp = this.otpResetForm.controls.otp.getRawValue().replace(/\D+/g, '').slice(0, 6);
    if (normalizedOtp !== this.otpResetForm.controls.otp.getRawValue()) {
      this.otpResetForm.controls.otp.setValue(normalizedOtp);
    }
  }

  protected submitTokenReset(): void {
    if (this.passwordForm.invalid || !this.token()) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isSubmitting.set(true);

    this.authService
      .resetPasswordByToken(this.token()!, this.passwordForm.controls.newPassword.getRawValue())
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => this.markSuccess(),
        error: (error: Error) => {
          if (this.shouldFallBackToOtp(error.message)) {
            this.status.set('otp');
          } else {
            this.status.set('token');
          }
          this.errorMessage.set(error.message);
        },
      });
  }

  protected submitOtpReset(): void {
    if (this.otpResetForm.invalid) {
      this.otpResetForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.verifiedOtp.set(this.otpResetForm.controls.otp.getRawValue());
    this.verifiedOtpEmail.set(this.otpResetForm.controls.email.getRawValue());
    this.status.set('otp-password');
  }

  protected submitOtpPasswordReset(): void {
    if (this.otpPasswordForm.invalid || !this.verifiedOtp() || !this.verifiedOtpEmail()) {
      this.otpPasswordForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isSubmitting.set(true);

    this.authService
      .resetPasswordByOtp({
        email: this.verifiedOtpEmail()!,
        otp: this.verifiedOtp()!,
        newPassword: this.otpPasswordForm.controls.newPassword.getRawValue(),
      })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: () => this.markSuccess(),
        error: (error: Error) => {
          this.errorMessage.set(error.message);
        },
      });
  }

  protected backToOtp(): void {
    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.status.set('otp');
  }

  protected goToLogin(): void {
    this.authService.goToLogin();
  }

  protected continueInThisTab(): void {
    this.registerActiveTab();
    this.isClosingHandoffTab.set(false);
    this.handoffCloseFailed.set(false);
    this.status.set('token');
    this.infoMessage.set('Bạn có thể tiếp tục đặt lại mật khẩu ngay trong tab này.');
  }

  private markSuccess(): void {
    this.status.set('success');
    this.errorMessage.set(null);
    this.infoMessage.set('Mật khẩu đã được cập nhật. Bạn sẽ được chuyển về trang đăng nhập trong giây lát.');

    const timeoutId = window.setTimeout(() => {
      void this.router.navigateByUrl('/login');
    }, 2500);

    this.destroyRef.onDestroy(() => window.clearTimeout(timeoutId));
  }

  private handleRouteState(token: string | null, sent: boolean, email: string | null): void {
    if (email && email !== this.otpResetForm.controls.email.getRawValue()) {
      this.otpResetForm.controls.email.setValue(email);
    }

    if (!token) {
      this.isClosingHandoffTab.set(false);
      this.handoffCloseFailed.set(false);
      this.registerActiveTab();
      if (this.status() === 'checking') {
        this.status.set('otp');
      }

      if (sent) {
        this.infoMessage.set('Chúng tôi đã gửi liên kết đặt lại mật khẩu và mã OTP dự phòng. Bạn có thể mở email hoặc nhập OTP ngay tại đây.');
      }

      return;
    }

    if (token === this.token() && (this.status() === 'token' || this.status() === 'success')) {
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.token.set(token);
    this.status.set('checking');
    this.isClosingHandoffTab.set(false);
    this.handoffCloseFailed.set(false);

    this.authService.verifyPasswordResetToken(token).subscribe({
      next: () => {
        const hasAnotherActiveTab = this.hasAnotherActiveTab();
        this.broadcastVerifiedToken(token);

        if (hasAnotherActiveTab) {
          this.status.set('handoff');
          this.infoMessage.set('Liên kết đã được chuyển sang tab đặt lại mật khẩu bạn đang mở. Bạn có thể tiếp tục ở đó.');
          this.tryCloseHandoffTab();
          return;
        }

        this.registerActiveTab();
        this.status.set('token');
      },
      error: (error: Error) => {
        this.registerActiveTab();
        this.status.set('otp');
        this.errorMessage.set(error.message);
      },
    });
  }

  private broadcastVerifiedToken(token: string): void {
    localStorage.setItem(
      this.resetPasswordTokenSyncKey,
      JSON.stringify({
        token,
        at: Date.now(),
      }),
    );
  }

  private registerActiveTab(): void {
    localStorage.setItem(
      this.resetPasswordActiveTabKey,
      JSON.stringify({
        tabId: this.tabId,
        at: Date.now(),
      }),
    );
  }

  private releaseActiveTab(): void {
    try {
      const payload = JSON.parse(localStorage.getItem(this.resetPasswordActiveTabKey) ?? 'null') as { tabId?: string } | null;
      if (payload?.tabId === this.tabId) {
        localStorage.removeItem(this.resetPasswordActiveTabKey);
      }
    } catch {
      return;
    }
  }

  private hasAnotherActiveTab(): boolean {
    try {
      const payload = JSON.parse(localStorage.getItem(this.resetPasswordActiveTabKey) ?? 'null') as { tabId?: string; at?: number } | null;
      if (!payload?.tabId || payload.tabId === this.tabId) {
        return false;
      }

      if (!payload.at || Date.now() - payload.at > 1000 * 60 * 30) {
        return false;
      }

      return true;
    } catch {
      return false;
    }
  }

  private readonly handleTokenSync = (event: StorageEvent): void => {
    if (event.key !== this.resetPasswordTokenSyncKey || !event.newValue) {
      return;
    }

    try {
      const payload = JSON.parse(event.newValue) as { token?: string };
      if (!payload.token || payload.token === this.token()) {
        return;
      }

      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { token: payload.token },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    } catch {
      return;
    }
  };

  private tryCloseHandoffTab(): void {
    this.isClosingHandoffTab.set(true);
    this.handoffCloseFailed.set(false);

    const closeAttemptId = window.setTimeout(() => {
      window.close();

      const verifyCloseId = window.setTimeout(() => {
        if (!window.closed) {
          this.isClosingHandoffTab.set(false);
          this.handoffCloseFailed.set(true);
        }
      }, 250);

      this.destroyRef.onDestroy(() => window.clearTimeout(verifyCloseId));
    }, 120);

    this.destroyRef.onDestroy(() => window.clearTimeout(closeAttemptId));
  }

  private matchPasswordValidator(control: AbstractControl): ValidationErrors | null {
    const password = control.get('newPassword')?.value;
    const confirmPassword = control.get('confirmPassword')?.value;

    if (!password || !confirmPassword) {
      return null;
    }

    return password === confirmPassword ? null : { passwordMismatch: true };
  }

  private shouldFallBackToOtp(message: string): boolean {
    const normalizedMessage = message.toLowerCase();
    return normalizedMessage.includes('token')
      || normalizedMessage.includes('liên kết')
      || normalizedMessage.includes('link')
      || normalizedMessage.includes('expired')
      || normalizedMessage.includes('hết hạn')
      || normalizedMessage.includes('invalid')
      || normalizedMessage.includes('không hợp lệ');
  }

  protected getPasswordPolicyMessage(hasValue: boolean): string {
    if (!hasValue) {
      return 'Mật khẩu mới là bắt buộc.';
    }

    return 'Mật khẩu phải có ít nhất 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.';
  }
}
