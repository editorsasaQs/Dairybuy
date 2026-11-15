-- Phase 5 foundation: pending payment is distinct from an active subscription.
ALTER TYPE public.subscription_status_enum ADD VALUE IF NOT EXISTS 'pending_payment';
