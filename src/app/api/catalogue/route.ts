import { NextResponse } from 'next/server';
import { getDatabaseCatalogue } from '@/lib/services/catalogue-db-service';
import type { ProductCategory } from '@/lib/services/catalogue-service';
import { createSupabaseServerClient, isServerSupabaseConfigured } from '@/lib/supabase/server';
import { toPublicCatalogueProduct } from '@/lib/services/catalogue-public';

const VALID_CATEGORIES = new Set<ProductCategory>([
  'all', 'milk', 'canteen-milk', 'ghee', 'butter', 'cheese', 'doi', 'sweets',
]);

export async function GET(request: Request) {
  if (!isServerSupabaseConfigured()) {
    return NextResponse.json(
      { success: false, error: 'Catalogue service is temporarily unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const { searchParams } = new URL(request.url);
  const requestedCategory = searchParams.get('category') || 'all';
  const category = VALID_CATEGORIES.has(requestedCategory as ProductCategory)
    ? (requestedCategory as ProductCategory)
    : 'all';

  try {
    const supabase = await createSupabaseServerClient();
    const result = await getDatabaseCatalogue(supabase, category);
    const publicProducts = result.products.map(toPublicCatalogueProduct);

    return NextResponse.json({
      success: true,
      data: {
        categories: result.categories,
        products: publicProducts,
        totalCount: publicProducts.length,
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('[api/catalogue] Failed to load database catalogue:', error);
    return NextResponse.json(
      { success: false, error: 'Unable to load catalogue right now.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
