BEGIN;
ALTER TABLE IF EXISTS institution_webhooks
  ADD COLUMN IF NOT EXISTS secret_ciphertext text,
  ADD COLUMN IF NOT EXISTS last_error text;
COMMIT;
