import { describe, expect, it } from 'vitest';
import {
  findVariantById,
  getProductsByCategory,
  NON_MILK_VARIANTS,
} from '../catalogue-service';

describe('Catalogue Service - 16 Non-Milk Variants & Confirmed Pricing', () => {
  it('contains exactly 16 confirmed non-milk variants from the confirmed CSV', () => {
    expect(NON_MILK_VARIANTS).toHaveLength(16);
  });

  it('verifies GHEE variants, sizes, purchase prices, delivery components, and final prices', () => {
    const gheeVariants = NON_MILK_VARIANTS.filter((v) => v.productId.startsWith('ghee-'));
    expect(gheeVariants).toHaveLength(4);

    // Red Cow 200 ml - purchase ₹170 - component ₹9 - final ₹179
    const redCow200 = gheeVariants.find((v) => v.id === 'ghee-red-cow-200ml');
    expect(redCow200?.purchasePricePaise).toBe(17000);
    expect(redCow200?.sheetDeliveryComponentPaise).toBe(900);
    expect(redCow200?.finalPricePaise).toBe(17900);

    // Red Cow 500 ml - purchase ₹390 - component ₹9 - final ₹399
    const redCow500 = gheeVariants.find((v) => v.id === 'ghee-red-cow-500ml');
    expect(redCow500?.purchasePricePaise).toBe(39000);
    expect(redCow500?.sheetDeliveryComponentPaise).toBe(900);
    expect(redCow500?.finalPricePaise).toBe(39900);

    // Ashirvaad 200 ml - purchase ₹182 - component ₹9 - final ₹191
    const ashirvaad200 = gheeVariants.find((v) => v.id === 'ghee-ashirvaad-200ml');
    expect(ashirvaad200?.purchasePricePaise).toBe(18200);
    expect(ashirvaad200?.sheetDeliveryComponentPaise).toBe(900);
    expect(ashirvaad200?.finalPricePaise).toBe(19100);

    // Ashirvaad 500 ml - purchase ₹437 - component ₹9 - final ₹446
    const ashirvaad500 = gheeVariants.find((v) => v.id === 'ghee-ashirvaad-500ml');
    expect(ashirvaad500?.purchasePricePaise).toBe(43700);
    expect(ashirvaad500?.sheetDeliveryComponentPaise).toBe(900);
    expect(ashirvaad500?.finalPricePaise).toBe(44600);
  });

  it('verifies BUTTER variants, sizes, purchase prices, delivery components, and final prices', () => {
    const butterVariants = NON_MILK_VARIANTS.filter((v) => v.productId.startsWith('butter-'));
    expect(butterVariants).toHaveLength(5);

    // Amul 100 g: purchase ₹66 - component ₹9 - final ₹75
    const amul100 = butterVariants.find((v) => v.id === 'butter-amul-100g');
    expect(amul100?.purchasePricePaise).toBe(6600);
    expect(amul100?.sheetDeliveryComponentPaise).toBe(900);
    expect(amul100?.finalPricePaise).toBe(7500);

    // Amul 200 g: purchase ₹130 - component ₹9 - final ₹139
    const amul200 = butterVariants.find((v) => v.id === 'butter-amul-200g');
    expect(amul200?.purchasePricePaise).toBe(13000);
    expect(amul200?.sheetDeliveryComponentPaise).toBe(900);
    expect(amul200?.finalPricePaise).toBe(13900);

    // Amul 500 g: purchase ₹305 - component ₹9 - final ₹314
    const amul500 = butterVariants.find((v) => v.id === 'butter-amul-500g');
    expect(amul500?.purchasePricePaise).toBe(30500);
    expect(amul500?.sheetDeliveryComponentPaise).toBe(900);
    expect(amul500?.finalPricePaise).toBe(31400);

    // Delicious 100 g: purchase ₹22 - component ₹11 - final ₹33
    const del100 = butterVariants.find((v) => v.id === 'butter-delicious-100g');
    expect(del100?.purchasePricePaise).toBe(2200);
    expect(del100?.sheetDeliveryComponentPaise).toBe(1100);
    expect(del100?.finalPricePaise).toBe(3300);

    // Delicious 500 g: purchase ₹117 - component ₹9 - final ₹126
    const del500 = butterVariants.find((v) => v.id === 'butter-delicious-500g');
    expect(del500?.purchasePricePaise).toBe(11700);
    expect(del500?.sheetDeliveryComponentPaise).toBe(900);
    expect(del500?.finalPricePaise).toBe(12600);
  });

  it('verifies CHEESE variants, sizes, purchase prices, delivery components, and final prices', () => {
    const cheeseVariants = NON_MILK_VARIANTS.filter((v) => v.productId.startsWith('cheese-'));
    expect(cheeseVariants).toHaveLength(4);

    // Amul slices 100 g: purchase ₹82 - component ₹11 - final ₹93
    const slice100 = cheeseVariants.find((v) => v.id === 'cheese-amul-slices-100g');
    expect(slice100?.purchasePricePaise).toBe(8200);
    expect(slice100?.sheetDeliveryComponentPaise).toBe(1100);
    expect(slice100?.finalPricePaise).toBe(9300);

    // Amul slices 200 g: purchase ₹145 - component ₹9 - final ₹154
    const slice200 = cheeseVariants.find((v) => v.id === 'cheese-amul-slices-200g');
    expect(slice200?.purchasePricePaise).toBe(14500);
    expect(slice200?.sheetDeliveryComponentPaise).toBe(900);
    expect(slice200?.finalPricePaise).toBe(15400);

    // Amul blocs 200 g: purchase ₹130 - component ₹11 - final ₹141
    const bloc200 = cheeseVariants.find((v) => v.id === 'cheese-amul-blocs-200g');
    expect(bloc200?.purchasePricePaise).toBe(13000);
    expect(bloc200?.sheetDeliveryComponentPaise).toBe(1100);
    expect(bloc200?.finalPricePaise).toBe(14100);

    // Amul blocs 500 g: purchase ₹300 - component ₹9 - final ₹309
    const bloc500 = cheeseVariants.find((v) => v.id === 'cheese-amul-blocs-500g');
    expect(bloc500?.purchasePricePaise).toBe(30000);
    expect(bloc500?.sheetDeliveryComponentPaise).toBe(900);
    expect(bloc500?.finalPricePaise).toBe(30900);
  });

  it('verifies DOI and SWEETS variants with exact workbook records', () => {
    // Misti Doi 100 g: purchase ₹35 - component ₹9 - final ₹44
    const mistiDoi = findVariantById('doi-misti-100g');
    expect(mistiDoi?.purchasePricePaise).toBe(3500);
    expect(mistiDoi?.sheetDeliveryComponentPaise).toBe(900);
    expect(mistiDoi?.finalPricePaise).toBe(4400);

    // Tok Doi 100 g: purchase ₹25 - component ₹9 - final ₹34
    const tokDoi = findVariantById('doi-tok-100g');
    expect(tokDoi?.purchasePricePaise).toBe(2500);
    expect(tokDoi?.sheetDeliveryComponentPaise).toBe(900);
    expect(tokDoi?.finalPricePaise).toBe(3400);

    // Firni 1 piece: purchase ₹35 - component ₹9 - final ₹44
    const firni = findVariantById('sweet-firni-1pc');
    expect(firni?.purchasePricePaise).toBe(3500);
    expect(firni?.sheetDeliveryComponentPaise).toBe(900);
    expect(firni?.finalPricePaise).toBe(4400);
  });


  it('keeps the static Canteen reference variants aligned with the current CSV', () => {
    const half = findVariantById('milk-canteen-500ml');
    const one = findVariantById('milk-canteen-1l');
    expect(half?.purchasePricePaise).toBe(2900);
    expect(half?.sheetDeliveryComponentPaise).toBe(900);
    expect(half?.finalPricePaise).toBe(3800);
    expect(one?.purchasePricePaise).toBe(5200);
    expect(one?.sheetDeliveryComponentPaise).toBe(800);
    expect(one?.finalPricePaise).toBe(6000);
  });

  it('filters products by category correctly', () => {
    const gheeProducts = getProductsByCategory('ghee');
    expect(gheeProducts).toHaveLength(2);

    const sweets = getProductsByCategory('sweets');
    expect(sweets).toHaveLength(1);

    const all = getProductsByCategory('all');
    expect(all.length).toBeGreaterThanOrEqual(12);
  });
});

describe('Phase 4.1 CSV naming and pack labels', () => {
  it('uses the CSV-confirmed Ashirvaad brand and Firni pack label', () => {
    const ash = findVariantById('ghee-ashirvaad-200ml');
    expect(ash?.brand).toBe('Ashirvaad');
    expect(ash?.variantName).toBe('Ashirvaad Ghee 200 ml');
    const firni = findVariantById('sweet-firni-1pc');
    expect(firni?.packSize).toBe('1 piece');
    expect(firni?.variantName).toBe('Firni 1 piece');
  });

  it('contains no unconfirmed breakfast-staple product records', () => {
    const all = getProductsByCategory('all');
    for (const id of ['bread-white', 'eggs-farm', 'banana-robusta', 'juice-fruit', 'jam-fruit']) {
      expect(all.some((product) => product.id === id)).toBe(false);
    }
  });
});
