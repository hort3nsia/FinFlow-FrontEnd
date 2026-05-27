const AUTH_INVALID_PATTERNS = [
  'not authenticated',
  'token is invalid',
  'unauthorized',
  'not authorized',
  'refresh token is invalid',
];

export const isAuthInvalidMessage = (message: string | null | undefined): boolean => {
  if (!message) {
    return false;
  }

  const normalizedMessage = message.toLowerCase();
  return AUTH_INVALID_PATTERNS.some((pattern) => normalizedMessage.includes(pattern));
};
