import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CurrentWorkspaceFacade } from '../../dashboard/data/current-workspace.facade';
import {
  BankCode,
  ConfirmBankInfoUpdateInput,
  ProfileApiService,
  ReimbursementProfileResponse,
  UpdateMyReimbursementProfileInput,
} from '../data/profile-api.service';

const PAYMENT_METHODS = [
  { code: 'BankTransfer', label: 'Chuyển khoản ngân hàng' },
  { code: 'Cash', label: 'Tiền mặt' },
  { code: 'CreditCard', label: 'Thẻ tín dụng' },
  { code: 'Payroll', label: 'Trừ vào lương' },
  { code: 'Check', label: 'Séc' },
  { code: 'Other', label: 'Khác' },
];

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-page.component.html',
  styleUrl: './profile-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePageComponent {
  private readonly profileApi = inject(ProfileApiService);
  private readonly currentWorkspaceFacade = inject(CurrentWorkspaceFacade);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly workspaceState = this.currentWorkspaceFacade.state;
  protected readonly paymentMethods = PAYMENT_METHODS;

  // ─── Loading & data ─────────────────────────────────────────────
  protected readonly isLoading = signal(true);
  protected readonly loadError = signal<string | null>(null);
  protected readonly profile = signal<ReimbursementProfileResponse | null>(null);
  protected readonly bankCodes = signal<BankCode[]>([]);

  // ─── Profile form (non-bank fields) ─────────────────────────────
  protected readonly preferredPaymentMethod = signal<string>('');
  protected readonly contactPhone = signal<string>('');
  protected readonly reimbursementEmail = signal<string>('');
  protected readonly taxId = signal<string>('');
  protected readonly isSavingProfile = signal(false);
  protected readonly profileSaveError = signal<string | null>(null);
  protected readonly profileSaveSuccess = signal<string | null>(null);

  // ─── Bank info update flow ──────────────────────────────────────
  protected readonly isBankDialogOpen = signal(false);
  protected readonly bankFormStep = signal<'edit' | 'otp'>('edit');
  protected readonly bankCode = signal<string>('');
  protected readonly bankAccountNumber = signal<string>('');
  protected readonly bankAccountHolderName = signal<string>('');
  protected readonly bankBranch = signal<string>('');
  protected readonly clearBankInfoMode = signal(false);
  protected readonly otpCode = signal<string>('');
  protected readonly otpChallengeId = signal<string | null>(null);
  protected readonly otpCooldownSeconds = signal<number>(0);
  protected readonly bankDialogError = signal<string | null>(null);
  protected readonly isRequestingOtp = signal(false);
  protected readonly isConfirmingOtp = signal(false);

  // ─── Computed ───────────────────────────────────────────────────
  protected readonly userEmail = computed(() => this.workspaceState().workspace?.email ?? '');
  protected readonly tenantName = computed(
    () => this.workspaceState().workspace?.tenantName ?? '—',
  );
  protected readonly userRoleLabel = computed(() => {
    const r = (this.workspaceState().workspace?.role ?? '').toString();
    if (!r) return '—';
    return r;
  });

  protected readonly hasBankInfo = computed(() => this.profile()?.hasBankInfo ?? false);

  protected readonly bankInfoSummary = computed(() => {
    const p = this.profile();
    if (!p?.hasBankInfo) return null;
    return {
      bankCode: p.bankCode ?? '',
      bankName: p.bankName ?? p.bankCode ?? '',
      last4: p.bankAccountLast4 ?? '••••',
      holder: p.bankAccountHolderName ?? '',
      branch: p.bankBranch ?? '',
    };
  });

  protected readonly bankFormValid = computed(() => {
    if (this.clearBankInfoMode()) return true;
    return (
      this.bankCode().trim().length > 0 &&
      this.bankAccountNumber().trim().length >= 4 &&
      this.bankAccountHolderName().trim().length > 0
    );
  });

  protected readonly otpFormValid = computed(() => {
    return (
      this.otpChallengeId() !== null && /^\d{4,8}$/.test(this.otpCode().trim())
    );
  });

  constructor() {
    effect(() => {
      const tenantId = this.workspaceState().workspace?.tenantId;
      if (tenantId) {
        this.refresh();
      }
    });
  }

  protected refresh(): void {
    this.isLoading.set(true);
    this.loadError.set(null);

    this.profileApi
      .getMyProfile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.preferredPaymentMethod.set(profile?.preferredPaymentMethod ?? '');
          this.contactPhone.set(profile?.contactPhone ?? '');
          this.reimbursementEmail.set(profile?.reimbursementEmail ?? '');
          this.taxId.set(profile?.taxId ?? '');
          this.isLoading.set(false);
        },
        error: (err: Error) => {
          this.loadError.set(err.message);
          this.isLoading.set(false);
        },
      });

    // Lazy load bank codes once
    if (this.bankCodes().length === 0) {
      this.profileApi
        .getBankCodes()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (codes) => this.bankCodes.set(codes),
          error: () => {
            // non-critical
          },
        });
    }
  }

  // ─── Profile save ──────────────────────────────────────────────
  protected saveProfile(): void {
    if (this.isSavingProfile()) return;
    this.isSavingProfile.set(true);
    this.profileSaveError.set(null);
    this.profileSaveSuccess.set(null);

    const input: UpdateMyReimbursementProfileInput = {
      preferredPaymentMethod: this.preferredPaymentMethod() || null,
      contactPhone: this.contactPhone()?.trim() || null,
      reimbursementEmail: this.reimbursementEmail()?.trim() || null,
      taxId: this.taxId()?.trim() || null,
    };

    this.profileApi
      .updateProfile(input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.isSavingProfile.set(false);
          this.profileSaveSuccess.set('Đã lưu thông tin liên hệ.');
        },
        error: (err: Error) => {
          this.profileSaveError.set(err.message);
          this.isSavingProfile.set(false);
        },
      });
  }

  // ─── Bank info dialog ──────────────────────────────────────────
  protected openBankDialog(clearMode = false): void {
    this.bankDialogError.set(null);
    this.clearBankInfoMode.set(clearMode);
    this.bankFormStep.set('edit');
    this.bankCode.set('');
    this.bankAccountNumber.set('');
    this.bankAccountHolderName.set(this.profile()?.bankAccountHolderName ?? '');
    this.bankBranch.set(this.profile()?.bankBranch ?? '');
    this.otpCode.set('');
    this.otpChallengeId.set(null);
    this.otpCooldownSeconds.set(0);
    this.isBankDialogOpen.set(true);
  }

  protected closeBankDialog(): void {
    this.isBankDialogOpen.set(false);
  }

  protected requestOtp(): void {
    if (this.isRequestingOtp() || !this.bankFormValid()) return;
    this.isRequestingOtp.set(true);
    this.bankDialogError.set(null);

    this.profileApi
      .requestBankOtp()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (otp) => {
          this.otpChallengeId.set(otp.challengeId);
          this.otpCooldownSeconds.set(otp.cooldownSeconds);
          this.bankFormStep.set('otp');
          this.isRequestingOtp.set(false);
        },
        error: (err: Error) => {
          this.bankDialogError.set(err.message);
          this.isRequestingOtp.set(false);
        },
      });
  }

  protected confirmBankUpdate(): void {
    if (this.isConfirmingOtp() || !this.otpFormValid()) return;
    this.isConfirmingOtp.set(true);
    this.bankDialogError.set(null);

    const isClear = this.clearBankInfoMode();
    const input: ConfirmBankInfoUpdateInput = {
      challengeId: this.otpChallengeId() ?? '',
      otp: this.otpCode().trim(),
      bankCode: isClear ? null : this.bankCode().trim().toUpperCase() || null,
      bankAccountNumber: isClear ? null : this.bankAccountNumber().trim() || null,
      bankAccountHolderName: isClear ? null : this.bankAccountHolderName().trim() || null,
      bankBranch: isClear ? null : this.bankBranch().trim() || null,
    };

    this.profileApi
      .confirmBankUpdate(input)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.isConfirmingOtp.set(false);
          this.isBankDialogOpen.set(false);
        },
        error: (err: Error) => {
          this.bankDialogError.set(err.message);
          this.isConfirmingOtp.set(false);
        },
      });
  }

  protected formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  protected userInitial = computed(() => {
    const email = this.userEmail();
    if (!email) return '?';
    const local = email.split('@')[0] ?? '';
    return (local.charAt(0) || '?').toUpperCase();
  });
}
