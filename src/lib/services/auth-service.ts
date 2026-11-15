/**
 * Dairybuy Phase 4 Role & Permission Service
 * Legacy role enum values remain for data compatibility only.
 * Effective application authorization is Customer + Admin/Owner, matching
 * the current Supabase private.is_staff() and private.has_staff_permission().
 * Never authorize from user-editable profile metadata.
 */

import { StaffPermission, UserRole } from '@/lib/supabase/types';

export const ALL_ROLES: readonly UserRole[] = [
  'owner',
  'admin',
  'manager',
  'operations_staff',
  'customer',
] as const;

export function isStaffRole(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

export function isAdminOrOwner(role: UserRole): boolean {
  return role === 'owner' || role === 'admin';
}

/**
 * The current database authorization boundary grants operational permissions
 * only to admin/owner. Manager and operations_staff are legacy enum values and
 * do not gain access through staff_permissions until a future approved RBAC
 * design is implemented consistently in both the database and application.
 */
export function roleHasPermission(role: UserRole, _permission: StaffPermission): boolean {
  return isAdminOrOwner(role);
}

/**
 * Mirrors the current user_roles RLS policy:
 * - owner may assign owner, admin, or customer;
 * - admin may assign admin or customer, but never owner;
 * - legacy manager/operations_staff and customers cannot assign roles.
 *
 * Admin self-assignment is denied when the caller and target IDs match.
 */
export function canAssignRole(
  assignerRole: UserRole,
  targetRole: UserRole,
  assignerUserId: string,
  targetUserId: string,
): boolean {
  if (assignerRole === 'owner') {
    return targetRole === 'owner' || targetRole === 'admin' || targetRole === 'customer';
  }
  if (assignerRole === 'admin') {
    return (
      assignerUserId !== targetUserId &&
      (targetRole === 'admin' || targetRole === 'customer')
    );
  }
  return false;
}
