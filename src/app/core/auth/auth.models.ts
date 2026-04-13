export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
  name: string;
}

export interface CreateWorkspaceInput {
  name: string;
  tenantCode: string;
  currency?: string;
}

export interface AccountSession {
  accessToken: string;
  refreshToken: string;
  id: string;
  email: string;
  sessionKind: 'account';
}

export interface WorkspaceSession {
  accessToken: string;
  refreshToken: string;
  id: string;
  membershipId: string;
  email: string;
  role: string;
  idTenant: string;
  sessionKind: 'workspace';
}

export interface RefreshSession {
  accessToken: string;
  refreshToken: string;
  id: string;
  email: string;
  sessionKind: 'account' | 'workspace';
  membershipId?: string;
  role?: string;
  idTenant?: string;
}

export interface RegistrationPending {
  accountId: string;
  email: string;
  requiresEmailVerification: boolean;
  cooldownSeconds: number;
}

export interface VerifyEmailOtpInput {
  email: string;
  otp: string;
}

export interface ResetPasswordByOtpInput {
  email: string;
  otp: string;
  newPassword: string;
}

export interface ChallengeDispatchResponse {
  accepted: boolean;
  cooldownSeconds: number;
}

export interface WorkspaceInfo {
  workspaceId: string;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
  membershipId: string;
  role: string;
}

export interface CurrentWorkspace {
  accountId: string;
  email: string;
  membershipId: string;
  role: string;
  tenantId: string;
  tenantCode: string;
  tenantName: string;
}

export type CurrentSession = AccountSession | WorkspaceSession;
