-- Phase 3: tailoring output + reviewer actions live on the job row.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS overlay        jsonb;   -- generated tailoring overlay (overlay.schema.json)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS cover_letter   text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS audit          jsonb;   -- verify_claims output
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS label          text;    -- calibration: good | bad | null
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reject_reason  text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS reviewed_at    timestamptz;

-- Templated answers to recurring application questions (P3.6).
CREATE TABLE IF NOT EXISTS answers (
  id         bigserial PRIMARY KEY,
  key        text UNIQUE NOT NULL,   -- work_authorization | salary | notice | relocation | why_company
  question   text NOT NULL,          -- canonical phrasing, for reference
  answer     text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
