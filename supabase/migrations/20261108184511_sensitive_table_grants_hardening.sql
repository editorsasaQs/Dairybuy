-- Restrict sensitive financial and subscription tables to the application server.
-- Customer reads remain available through existing RLS SELECT policies.
-- Writes must go through trusted server-side workflows using service_role.
BEGIN;

REVOKE ALL PRIVILEGES ON TABLE
  public.payments,
  public.refunds,
  public.payment_webhook_events,
  public.subscriptions,
  public.subscription_items,
  public.subscription_deliveries,
  public.subscription_skip_records,
  public.subscription_vendor_changes
FROM PUBLIC, anon, authenticated;

GRANT SELECT ON TABLE
  public.payments,
  public.refunds,
  public.subscriptions,
  public.subscription_items,
  public.subscription_deliveries,
  public.subscription_skip_records,
  public.subscription_vendor_changes
TO authenticated;

-- Webhook payloads and processing state are never client-readable.
GRANT ALL PRIVILEGES ON TABLE public.payment_webhook_events TO service_role;

COMMIT;