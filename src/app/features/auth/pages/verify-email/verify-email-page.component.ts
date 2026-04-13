import { finalize } from 'rxjs';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  private readonly verifyEmailTokenSyncKey = 'finflow:verify-email:token-sync';
  private readonly verifyEmailActiveTabKey = 'finflow:verify-email:active-tab';
  private readonly tabId = globalThis.crypto?.randomUUID?.() ?? `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly status = signal<'idle' | 'verifying' | 'handoff' | 'success' | 'error'>('idle');
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly infoMessage = signal<string | null>(null);
  protected readonly emailAddress = signal<string>('');
  protected readonly isOtpSubmitting = signal(false);
  protected readonly isResending = signal(false);
  protected readonly isClosingHandoffTab = signal(false);
  protected readonly handoffCloseFailed = signal(false);
  protected readonly otpForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    otp: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  });

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((queryParamMap) => {
        const email = queryParamMap.get('email');
        const token = queryParamMap.get('token');

        if (email) {
          this.emailAddress.set(email);
          this.otpForm.controls.email.setValue(email);
        }

        if (!token) {
          this.registerActiveTab();
          this.isClosingHandoffTab.set(false);
          this.handoffCloseFailed.set(false);
          this.status.set('idle');
          return;
        }

        this.isClosingHandoffTab.set(false);
        this.handoffCloseFailed.set(false);
        this.verifyByToken(token);
      });

    window.addEventListener('storage', this.handleTokenSync);
    this.destroyRef.onDestroy(() => window.removeEventListener('storage', this.handleTokenSync));
    this.destroyRef.onDestroy(() => this.releaseActiveTab());
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

  protected continueInThisTab(): void {
    this.registerActiveTab();
    this.isClosingHandoffTab.set(false);
    this.handoffCloseFailed.set(false);
    this.status.set('success');
    this.infoMessage.set('Email da duoc xac thuc. Ban se duoc chuyen ve trang dang nhap trong giay lat.');
  }

  protected normalizeOtpInput(): void {
    const normalizedOtp = this.otpForm.controls.otp.getRawValue().replace(/\D+/g, '').slice(0, 6);
    if (normalizedOtp !== this.otpForm.controls.otp.getRawValue()) {
      this.otpForm.controls.otp.setValue(normalizedOtp);
    }
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
      next: () => {
        const hasAnotherActiveTab = this.hasAnotherActiveTab();
        this.broadcastVerifiedToken(token);

        if (hasAnotherActiveTab) {
          this.status.set('handoff');
          this.infoMessage.set('Lien ket da duoc chuyen sang tab xac thuc email ban dang mo.');
          this.tryCloseHandoffTab();
          return;
        }

        this.registerActiveTab();
        this.markSuccess();
      },
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

  private broadcastVerifiedToken(token: string): void {
    localStorage.setItem(
      this.verifyEmailTokenSyncKey,
      JSON.stringify({
        token,
        at: Date.now(),
      }),
    );
  }

  private registerActiveTab(): void {
    localStorage.setItem(
      this.verifyEmailActiveTabKey,
      JSON.stringify({
        tabId: this.tabId,
        at: Date.now(),
      }),
    );
  }

  private releaseActiveTab(): void {
    try {
      const payload = JSON.parse(localStorage.getItem(this.verifyEmailActiveTabKey) ?? 'null') as { tabId?: string } | null;
      if (payload?.tabId === this.tabId) {
        localStorage.removeItem(this.verifyEmailActiveTabKey);
      }
    } catch {
      return;
    }
  }

  private hasAnotherActiveTab(): boolean {
    try {
      const payload = JSON.parse(localStorage.getItem(this.verifyEmailActiveTabKey) ?? 'null') as { tabId?: string; at?: number } | null;
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
    if (event.key !== this.verifyEmailTokenSyncKey || !event.newValue) {
      return;
    }

    try {
      const payload = JSON.parse(event.newValue) as { token?: string };
      if (!payload.token) {
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
}
