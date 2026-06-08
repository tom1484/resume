-- Canonical résumé becomes DB-backed (editable via the web), seeded from
-- the committed resume.json. Every save inserts a new row; the latest row
-- (by id) is "current". History = all rows, so nothing is lost.
CREATE TABLE IF NOT EXISTS resume_versions (
  id         bigserial PRIMARY KEY,
  data       jsonb NOT NULL,
  note       text,                       -- 'seed' | 'edit' | 'restore of #N' | …
  created_at timestamptz NOT NULL DEFAULT now()
);
