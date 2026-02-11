/**
 * Role-based access control (RBAC). All authorization checks server-side.
 */

export const ROLES = ['customer', 'admin', 'readonly'] as const;
export type Role = (typeof ROLES)[number];

export function canAccessAdmin(role: string): boolean {
  return role === 'admin';
}

export function canModifySettings(role: string): boolean {
  return role === 'admin';
}

export function canSubmitApplication(role: string): boolean {
  return role === 'customer';
}

export function canUploadFiles(role: string): boolean {
  return role === 'customer';
}

export function canViewAudit(role: string): boolean {
  return role === 'admin';
}

export function canManageSecrets(role: string): boolean {
  return role === 'admin';
}

export function isReadOnly(role: string): boolean {
  return role === 'readonly';
}
