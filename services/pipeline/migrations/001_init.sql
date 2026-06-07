-- Uniform job record (PROPOSALS.md §3.2) + per-stage event log (§5).
-- status lifecycle: new -> parsed -> scored -> tailored -> in_review
--   -> approved -> applying -> applied -> responded | rejected | skipped
-- (text, not enum: the lifecycle grows with later phases)

CREATE TABLE IF NOT EXISTS jobs (
  id            text PRIMARY KEY,           -- e.g. gh-figure-12345, lever-zoox-abc, jobspy-<hash>
  source        text NOT NULL,              -- greenhouse | lever | ashby | jobspy:<site> | manual
  company       text NOT NULL,
  title         text NOT NULL,
  location      text,
  remote        boolean,
  url           text,
  posted_at     date,
  jd_text       text,
  parsed        jsonb,                      -- LLM-extracted requirements
  score         real,
  score_breakdown jsonb,                    -- {keyword, llmFit, structural, rationale}
  status        text NOT NULL DEFAULT 'new',
  skip_reason   text,
  company_flags text[] NOT NULL DEFAULT '{}',  -- dream | startup | return-path
  dedupe_key    text NOT NULL,              -- norm(company)|norm(title)|norm(location)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_dedupe_key ON jobs (dedupe_key);
CREATE INDEX IF NOT EXISTS jobs_status ON jobs (status);

CREATE TABLE IF NOT EXISTS events (
  id            bigserial PRIMARY KEY,
  job_id        text REFERENCES jobs(id) ON DELETE SET NULL,
  stage         text NOT NULL,              -- discover | parse_jd | score | notify | ...
  model         text,
  input_tokens  integer,
  output_tokens integer,
  cost_usd      numeric(10, 6),
  duration_ms   integer,
  ok            boolean NOT NULL,
  detail        jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS events_stage_created ON events (stage, created_at);
