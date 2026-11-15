# Phase 4.5.2 — Owner/admin COD cash verification

## Scope

This slice adds the owner/admin review boundary for cash collection records created in Phase 4.5.1. It is limited to one-time COD orders. It does not implement cash handover batches, financial reconciliation, refunds, gateway payments or subscriptions.

## Decision rules

- Only an authenticated owner/admin may read or review a COD collection.
- Review is allowed only after the order is marked delivered and has exactly one matching COD payment.
- **Verify:** allowed only when the collection status is `collected` and collected paise exactly equals the authoritative order total. In one database transaction, the collection becomes `verified`, the reviewer/timestamp are stored, and both `payments.status` and `orders.payment_status` become `captured`.
- **Reject:** requires a reason of 5–500 characters. The collection becomes `rejected`, reviewer/timestamp/reason are persisted, and the payment remains `pending`.
- Automatically disputed short/over-collections cannot be verified in this slice; they can be rejected or handled in the later discrepancy-resolution phase.
- Repeating the same decision is idempotent and does not append duplicate audit entries. Conflicting decisions are rejected.
- Every successful decision appends an audit log entry. All state changes roll back together on any failure.

## Security

- Direct API access to `cod_collections`, `payments` and `orders` remains restricted.
- Two SECURITY DEFINER RPCs with an empty search path provide the narrow review and read surfaces.
- Both private implementations are inaccessible to API roles; only authenticated users can call public wrappers, which independently enforce owner/admin authorization.

## Admin interface

The order detail page shows the collection evidence and review outcome. It exposes Verify only for exact, undisputed cash and Reject with a mandatory reason. The server action rechecks the user's role; the database remains authoritative.

## Verification

The new pgTAP regression covers function hardening, grants, row locking, exact amount checks, atomic settlement, rejection boundaries, idempotency and audit logging. The repository PR workflow runs this test against a disposable local Supabase database. No hosted Supabase project or production data is changed.
