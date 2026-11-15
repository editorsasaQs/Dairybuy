import { describe, expect, it } from 'vitest';
import type { StaffPermission } from '@/lib/supabase/types';
import {
  ALL_ROLES,
  canAssignRole,
  isAdminOrOwner,
  isStaffRole,
  roleHasPermission,
} from '../auth-service';

describe('Auth & Security Service - Customer/Admin RBAC boundary', () => {
  it('retains the database enum values while documenting legacy roles', () => {
    expect(ALL_ROLES).toEqual([
      'owner',
      'admin',
      'manager',
      'operations_staff',
      'customer',
    ]);
  });

  it('recognizes only admin and owner as effective staff roles', () => {
    expect(isStaffRole('owner')).toBe(true);
    expect(isStaffRole('admin')).toBe(true);
    expect(isStaffRole('manager')).toBe(false);
    expect(isStaffRole('operations_staff')).toBe(false);
    expect(isStaffRole('customer')).toBe(false);
    expect(isAdminOrOwner('owner')).toBe(true);
    expect(isAdminOrOwner('admin')).toBe(true);
  });

  it('grants operational permissions only to admin and owner', () => {
    const permissions: StaffPermission[] = [
      'manage_catalogue',
      'manage_pricing',
      'manage_vendors',
      'manage_inventory',
      'assign_deliveries',
      'manage_staff',
      'manage_customers',
      'view_reports',
    ];

    for (const permission of permissions) {
      expect(roleHasPermission('owner', permission)).toBe(true);
      expect(roleHasPermission('admin', permission)).toBe(true);
      expect(roleHasPermission('manager', permission)).toBe(false);
      expect(roleHasPermission('operations_staff', permission)).toBe(false);
      expect(roleHasPermission('customer', permission)).toBe(false);
    }
  });

  it('mirrors the database role-assignment allowlist for owners', () => {
    expect(canAssignRole('owner', 'owner', 'owner-1', 'owner-1')).toBe(true);
    expect(canAssignRole('owner', 'admin', 'owner-1', 'admin-1')).toBe(true);
    expect(canAssignRole('owner', 'customer', 'owner-1', 'customer-1')).toBe(true);
    expect(canAssignRole('owner', 'manager', 'owner-1', 'manager-1')).toBe(false);
    expect(canAssignRole('owner', 'operations_staff', 'owner-1', 'ops-1')).toBe(false);
  });

  it('prevents admins from assigning owner or legacy roles', () => {
    expect(canAssignRole('admin', 'owner', 'admin-1', 'owner-1')).toBe(false);
    expect(canAssignRole('admin', 'admin', 'admin-1', 'admin-2')).toBe(true);
    expect(canAssignRole('admin', 'customer', 'admin-1', 'customer-1')).toBe(true);
    expect(canAssignRole('admin', 'manager', 'admin-1', 'manager-1')).toBe(false);
    expect(canAssignRole('admin', 'operations_staff', 'admin-1', 'ops-1')).toBe(false);
    expect(canAssignRole('admin', 'admin', 'admin-1', 'admin-1')).toBe(false);
    expect(canAssignRole('admin', 'customer', 'admin-1', 'admin-1')).toBe(false);
  });

  it('prevents customers and legacy roles from assigning any role', () => {
    for (const assigner of ['customer', 'manager', 'operations_staff'] as const) {
      for (const target of ALL_ROLES) {
        expect(canAssignRole(assigner, target, 'user-1', 'user-2')).toBe(false);
      }
    }
  });
});
