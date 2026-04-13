import { finalize } from 'rxjs';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { BrandMarkComponent } from '../../../../shared/ui/brand-mark/brand-mark.component';

@Component({
  selector: 'app-verify-email-page',
  imports: [ReactiveFormsModule, RouterLink, BrandMarkComponent],
  templateUrl: './verify-email-page.component.html',
  styleUrl: './verify-email-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmailPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = signal<'idle' | 'verifying' | 'success' | 'error'>('idle');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);
  protected readonly emailAddress = signal<string>('');
  protected readonly isOtpSubmitting = signal(false);
  protected readonly isResending = signal(false);
  protected readonly otpForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    otp: ['', [Validators.required, Validators.minLength(6)]],
  });
  protected readonly otpSlots = computed(() => {
    const normalizedOtp = this.otpForm.controls.otp.value.replace(/\s+/g, '').slice(0, 6);
    return Array.from({ length: 6 }, (_, index) => normalizedOtp[index] ?? '');
  });

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token');
    const email = this.route.snapshot.queryParamMap.get('email');

    if (email) {
      this.emailAddress.set(email);
      this.otpForm.controls.email.setValue(email);
    }

    if (token) {
      this.verifyByToken(token);
    }
  }

  protected submitOtp(): void {
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isOtpSubmitting.set(true);

    this.authService
      .verifyEmailByOtp(this.otpForm.getRawValue())
      .pipe(finalize(() => this.isOtpSubmitting.set(false)))
      .subscribe({
        next: () => this.markSuccess(),
        error: (error: Error) => {
          this.status.set('error');
          this.errorMessage.set(error.message);
        },
      });
  }

  protected resendVerification(): void {
    const email = this.otpForm.controls.email.value.trim();
    if (!email) {
      this.otpForm.controls.email.markAsTouched();
      this.errorMessage.set('Vui long nhap email de gui lai ma xac thuc.');
      return;
    }

    this.errorMessage.set(null);
    this.infoMessage.set(null);
    this.isResending.set(true);

    this.authService
      .resendEmailVerification(email)
      .pipe(finalize(() => this.isResending.set(false)))
      .subscribe({
        next: (response) => {
          this.infoMessage.set(`Chung toi da gui lai email xac thuc. Thu lai sau ${response.cooldownSeconds} giay neu ban chua nhan duoc.`);
        },
        error: (error: Error) => {
          this.errorMessage.set(error.message);
        },
      });
  }

  protected goToLogin(): void {
    this.authService.goToLogin();
  }

  protected openInbox(provider: 'gmail' | 'outlook'): void {
    const href = provider === 'gmail'
      ? 'https://mail.google.com/'
      : 'https://outlook.live.com/mail/';

    window.open(href, '_blank', 'noopener,noreferrer');
  }

  private verifyByToken(token: string): void {
    this.status.set('verifying');
    this.errorMessage.set(null);
    this.infoMessage.set(null);

    this.authService.verifyEmailByToken(token).subscribe({
      next: () => this.markSuccess(),
      error: (error: Error) => {
        this.status.set('error');
        this.errorMessage.set(error.message);
      },
    });
  }

  private markSuccess(): void {
    this.status.set('success');
    this.errorMessage.set(null);
    this.infoMessage.set('Email da duoc xac thuc. Ban se duoc chuyen ve trang dang nhap trong giay lat.');

    const timeoutId = window.setTimeout(() => {
      void this.router.navigateByUrl('/login');
    }, 3000);

    this.destroyRef.onDestroy(() => window.clearTimeout(timeoutId));
  }
}
