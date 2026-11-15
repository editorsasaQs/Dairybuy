/**
 * Dairybuy Phase 4 Service Area Service
 * Launch area: Topsia, Kolkata.
 * Confirmed Pincodes: 700046, 700039, 700100, 700105
 */

export type ServiceAreaInfo = {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  isActive: boolean;
  pincodes: readonly string[];
  description: string;
};

export const TOPSIA_SERVICE_AREA: ServiceAreaInfo = {
  id: '00000000-0000-0000-0000-000000000001',
  code: 'topsia-kolkata',
  name: 'Topsia, Kolkata',
  city: 'Kolkata',
  state: 'West Bengal',
  isActive: true,
  pincodes: ['700046', '700039', '700100', '700105'],
  description: 'Dairybuy central launch area covering Topsia, Tiljala, and EM Bypass corridor.',
};

export const ALL_SERVICE_AREAS: readonly ServiceAreaInfo[] = [TOPSIA_SERVICE_AREA];

/**
 * Checks if a given pincode is serviceable by Dairybuy.
 */
export function isPincodeServiceable(pincode: string): boolean {
  const clean = pincode.trim();
  return ALL_SERVICE_AREAS.some(
    (area) => area.isActive && area.pincodes.includes(clean),
  );
}

/**
 * Finds the service area matching a given pincode.
 */
export function findServiceAreaByPincode(pincode: string): ServiceAreaInfo | null {
  const clean = pincode.trim();
  const match = ALL_SERVICE_AREAS.find(
    (area) => area.isActive && area.pincodes.includes(clean),
  );
  return match || null;
}
