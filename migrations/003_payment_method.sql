-- Records which payment method actually confirmed a reservation (Stripe, Venmo, Cash App, Zelle,
-- PayPal, Cash...), written by stripe-webhook.js and reservations-confirm.js at the moment a
-- reservation is confirmed. Nullable/additive - existing rows are simply unset. Used by
-- reservation-signing-info.js so the "Send Full Confirmation" page can reconstruct the correct
-- guest confirmation email (card-fee-inclusive total, etc.) when reached via admin.html's
-- Stripe-confirm link rather than the guest's own one-click signing link.
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS payment_method text;
