export const BRAND_NAME = 'FinGuard Banking Systems';
export const ASSISTANT_DISPLAY_NAME = 'Ava';
export const ASSISTANT_FULL_NAME = 'Ava (FinGuard Assistant)';

export function DEFAULT_GREETING(userName?: string): string {
  return `Welcome to ${BRAND_NAME}${userName ? `, ${userName}` : ''}. How can I help you today?`;
}
