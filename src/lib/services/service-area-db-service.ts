import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/types';

type Client = SupabaseClient<Database>;
type ServiceAreaRow = Database['public']['Tables']['service_areas']['Row'];
type ServiceAreaPincodeRow = Database['public']['Tables']['service_area_pincodes']['Row'];

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

export type ServiceabilityCatalogue = {
  areas: ServiceAreaInfo[];
  serviceablePincodes: string[];
};

export function normalizePincode(value: string): string {
  return value.trim();
}

export function isValidPincode(value: string): boolean {
  return /^\d{6}$/.test(normalizePincode(value));
}

/** Pure mapper: only active areas and active pincode assignments are customer-visible. */
export function mapServiceAreaRows(
  areaRows: readonly ServiceAreaRow[],
  pincodeRows: readonly ServiceAreaPincodeRow[],
): ServiceAreaInfo[] {
  const activeAreas = areaRows.filter((area) => area.is_active);
  const activeAreaIds = new Set(activeAreas.map((area) => area.id));

  return activeAreas
    .map((area) => ({
      id: area.id,
      code: area.code,
      name: area.name,
      city: area.city,
      state: area.state,
      isActive: true,
      pincodes: [...new Set(
        pincodeRows
          .filter((row) => row.is_active && row.service_area_id === area.id)
          .map((row) => row.pincode),
      )].sort(),
      description: area.description ?? '',
    }))
    .filter((area) => activeAreaIds.has(area.id))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getDatabaseServiceability(
  supabase: Client,
): Promise<ServiceabilityCatalogue> {
  const { data: areaRows, error: areaError } = await supabase
    .from('service_areas')
    .select('id, code, name, city, state, is_active, description, created_at, updated_at')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (areaError) throw areaError;
  const activeAreas = areaRows ?? [];
  if (activeAreas.length === 0) {
    return { areas: [], serviceablePincodes: [] };
  }

  const { data: pincodeRows, error: pincodeError } = await supabase
    .from('service_area_pincodes')
    .select('id, service_area_id, pincode, is_active, created_at')
    .in('service_area_id', activeAreas.map((area) => area.id))
    .eq('is_active', true)
    .order('pincode', { ascending: true });

  if (pincodeError) throw pincodeError;

  const areas = mapServiceAreaRows(activeAreas, pincodeRows ?? []);
  const serviceablePincodes = [...new Set(areas.flatMap((area) => area.pincodes))].sort();
  return { areas, serviceablePincodes };
}

export function findServiceArea(
  areas: readonly ServiceAreaInfo[],
  pincode: string,
): ServiceAreaInfo | null {
  const clean = normalizePincode(pincode);
  return areas.find((area) => area.isActive && area.pincodes.includes(clean)) ?? null;
}
