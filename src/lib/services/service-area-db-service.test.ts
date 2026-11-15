import { describe, expect, it, vi } from 'vitest';
import {
  findServiceArea,
  getDatabaseServiceability,
  isValidPincode,
  mapServiceAreaRows,
  normalizePincode,
} from './service-area-db-service';
import type { Database } from '@/lib/supabase/types';
import type { SupabaseClient } from '@supabase/supabase-js';

type Area = Database['public']['Tables']['service_areas']['Row'];
type Pincode = Database['public']['Tables']['service_area_pincodes']['Row'];
type Client = SupabaseClient<Database>;

const area = (overrides: Partial<Area> = {}): Area => ({
  id: 'area-1',
  code: 'topsia-kolkata',
  name: 'Topsia, Kolkata',
  city: 'Kolkata',
  state: 'West Bengal',
  is_active: true,
  description: 'Topsia launch area',
  created_at: '2026-11-05T00:00:00Z',
  updated_at: '2026-11-05T00:00:00Z',
  ...overrides,
});

const pincode = (value: string, overrides: Partial<Pincode> = {}): Pincode => ({
  id: `pin-${value}`,
  service_area_id: 'area-1',
  pincode: value,
  is_active: true,
  created_at: '2026-11-05T00:00:00Z',
  ...overrides,
});

describe('service area database mapping', () => {
  it('keeps only active service areas and active pincode assignments', () => {
    const areas = mapServiceAreaRows(
      [area(), area({ id: 'area-off', code: 'inactive', name: 'Inactive', is_active: false })],
      [
        pincode('700039'),
        pincode('700046'),
        pincode('700100', { is_active: false }),
        pincode('700105', { service_area_id: 'area-off' }),
      ],
    );

    expect(areas).toHaveLength(1);
    expect(areas[0]?.pincodes).toEqual(['700039', '700046']);
  });

  it('maps the live Topsia seed without hardcoded fallback data', () => {
    const areas = mapServiceAreaRows(
      [area()],
      [pincode('700039'), pincode('700046'), pincode('700100'), pincode('700105')],
    );

    expect(areas[0]).toMatchObject({
      id: 'area-1',
      name: 'Topsia, Kolkata',
      city: 'Kolkata',
      state: 'West Bengal',
      isActive: true,
      pincodes: ['700039', '700046', '700100', '700105'],
    });
  });

  it('normalizes whitespace and validates exactly six ASCII digits', () => {
    expect(normalizePincode(' 700046 ')).toBe('700046');
    expect(isValidPincode('700046')).toBe(true);
    expect(isValidPincode(' 700046 ')).toBe(true);
    expect(isValidPincode('70004')).toBe(false);
    expect(isValidPincode('7000461')).toBe(false);
    expect(isValidPincode('70A046')).toBe(false);
    expect(isValidPincode('７０００４６')).toBe(false);
    expect(isValidPincode('')).toBe(false);
  });

  it('finds only an active area with an active pincode mapping', () => {
    const areas = mapServiceAreaRows([area()], [pincode('700046')]);
    expect(findServiceArea(areas, ' 700046 ')?.code).toBe('topsia-kolkata');
    expect(findServiceArea(areas, '700001')).toBeNull();
  });

  it('returns an empty serviceability catalogue when there are no active areas', () => {
    expect(mapServiceAreaRows([area({ is_active: false })], [pincode('700046')])).toEqual([]);
  });
});

type QueryResult = { data: unknown; error: unknown };
function mockClient(results: Record<string, QueryResult>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const from = vi.fn((table: string) => {
    const result = results[table] ?? { data: null, error: new Error(`Unexpected query for ${table}`) };
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'in']) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ table, method, args });
        return builder;
      };
    }
    builder['then'] = (resolve: (value: QueryResult) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(result).then(resolve, reject);
    return builder;
  });
  return { client: { from } as unknown as Client, calls };
}

describe('getDatabaseServiceability', () => {
  it('fails closed by propagating an active service-area query error', async () => {
    const databaseError = new Error('service area query unavailable');
    const { client, calls } = mockClient({
      service_areas: { data: null, error: databaseError },
    });

    await expect(getDatabaseServiceability(client)).rejects.toBe(databaseError);
    expect(calls.some((call) => call.table === 'service_area_pincodes')).toBe(false);
  });

  it('fails closed by propagating a pincode mapping query error', async () => {
    const databaseError = new Error('pincode mapping query unavailable');
    const { client, calls } = mockClient({
      service_areas: { data: [area()], error: null },
      service_area_pincodes: { data: null, error: databaseError },
    });

    await expect(getDatabaseServiceability(client)).rejects.toBe(databaseError);
    expect(calls.some((call) => call.table === 'service_area_pincodes' && call.method === 'eq' && call.args[0] === 'is_active' && call.args[1] === true)).toBe(true);
  });

  it('does not query pincode mappings when no active service areas exist', async () => {
    const { client, calls } = mockClient({
      service_areas: { data: [], error: null },
      service_area_pincodes: { data: [], error: null },
    });

    await expect(getDatabaseServiceability(client)).resolves.toEqual({
      areas: [],
      serviceablePincodes: [],
    });
    expect(calls.some((call) => call.table === 'service_area_pincodes')).toBe(false);
  });

  it('requests only active areas and active mappings scoped to those area IDs', async () => {
    const { client, calls } = mockClient({
      service_areas: { data: [area()], error: null },
      service_area_pincodes: { data: [pincode('700046')], error: null },
    });

    const result = await getDatabaseServiceability(client);
    expect(result.serviceablePincodes).toEqual(['700046']);
    expect(calls).toContainEqual({ table: 'service_areas', method: 'eq', args: ['is_active', true] });
    expect(calls).toContainEqual({ table: 'service_area_pincodes', method: 'in', args: ['service_area_id', ['area-1']] });
    expect(calls).toContainEqual({ table: 'service_area_pincodes', method: 'eq', args: ['is_active', true] });
  });
});
