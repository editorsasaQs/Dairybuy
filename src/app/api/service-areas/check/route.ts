import { NextResponse } from 'next/server';
import { getDatabaseServiceability, findServiceArea, isValidPincode } from '@/lib/services/service-area-db-service';
import { createSupabaseServerClient, isServerSupabaseConfigured } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const pincode = new URL(request.url).searchParams.get('pincode');

  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Serviceability is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (pincode !== null && !isValidPincode(pincode)) {
    return NextResponse.json(
      { success: false, error: 'Pincode must be a valid 6-digit postal code.' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const supabase = await createSupabaseServerClient();
    const catalogue = await getDatabaseServiceability(supabase);

    if (pincode === null) {
      return NextResponse.json({
        success: true,
        data: {
          launchArea: catalogue.areas[0] ?? null,
          serviceAreas: catalogue.areas,
          serviceablePincodes: catalogue.serviceablePincodes,
        },
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    const area = findServiceArea(catalogue.areas, pincode);
    const serviceable = area !== null;

    return NextResponse.json({
      success: true,
      data: {
        pincode: pincode.trim(),
        isServiceable: serviceable,
        serviceArea: area,
        message: serviceable
          ? `Pincode is serviceable in the ${area.name} launch zone.`
          : 'Pincode is outside Dairybuy current launch area. We are expanding gradually into selected Kolkata areas.',
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/service-areas/check] Failed to load database serviceability:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to check delivery serviceability right now.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
