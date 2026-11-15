# Milk vendor verification

Authority: Dairybuy Master Project Blueprint v1.1, the owner-confirmed milk pricing workbook, and the current Dairybuy-dev catalogue.

## Active customer-facing vendors

| Vendor | Customer selection | Active mapping / pricing | Status |
|---|---|---|---|
| Healthy Haryana Milk Centre | Yes | Cow and buffalo, 500 ml and 1 L | Active |
| VIP Pure Milk | Yes | Cow and buffalo, 500 ml and 1 L | Active |
| Ghosh Dairy | Yes | Cow and buffalo, 500 ml and 1 L | Active |
| Canteen Milk Centre | No vendor choice | Dedicated canteen milk arrangement | Active single-vendor flow |

Fresh Punjab Milk and Kolkata Milk Centre are removed from the active catalogue and Dairybuy-dev by forward migration `20261112095741_remove_unpriced_milk_vendors`. They must not be re-created in customer or operations code unless the owner explicitly re-approves them and supplies complete verified pricing and mapping.

## Ordering and pricing rules

- Standard customer milk packs start at 500 ml. Standard vendor price rows cover 500 ml and 1 L.
- Milk vendor choice is available only for regular cow/buffalo milk. Canteen milk remains a separate single-vendor arrangement.
- Customer-facing milk prices are read from active `vendor_prices` rows. Do not hardcode or infer prices from this document.
- The vendor CSV totals already include the delivery component. `app_settings.delivery_fee_paise=0`; do not add a second order-level delivery fee.
- The customer may change the selected milk vendor, including while on a subscription plan, subject to the subscription rules.
- Inventory availability remains controlled by Dairybuy. Current development inventory rows are zero available until stock is entered through audited inventory movements.

## Migration and regression checks

The forward migration refuses to delete either removed vendor if cart, order, subscription-item, or vendor-change history references exist. It then removes their vendor-price rows, vendor-product mappings and vendor records in one transaction.

Tests must keep the removed IDs absent from the approved-vendor allowlist and reject them through server-side validation. Keep the historical seed migration immutable; use a new forward migration for any future catalogue correction.
