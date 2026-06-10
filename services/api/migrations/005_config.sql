-- CONTRACTS.md §6/§7.3: non-secret config lives in the DB, one row per
-- namespace (llm | schedule | discovery | constraints | preferences). `value`
-- jsonb is validated against the matching @resume/contracts Zod on write by the
-- API (parseConfig). Secrets (ANTHROPIC_API_KEY, Telegram, Postgres creds, NPM
-- auth) NEVER live here — they stay in env/.env.
CREATE TABLE IF NOT EXISTS config (
  ns         text PRIMARY KEY,            -- §6.3 namespace
  value      jsonb NOT NULL,              -- validated by the namespace Zod on write
  updated_at timestamptz NOT NULL DEFAULT now()
);
