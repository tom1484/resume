-- Seed the answers bank with known facts (PREPARE.md item 10) + editable
-- placeholders. ON CONFLICT DO NOTHING so re-running never clobbers edits
-- Tom makes in the review UI.
INSERT INTO answers (key, question, answer) VALUES
  ('work_authorization',
   'Are you legally authorized to work in the US? Will you require sponsorship?',
   'I am on an F-1 student visa at Georgia Tech. I am eligible to intern in Summer 2027 via CPT (no sponsorship needed for the internship). For full-time employment I would require visa sponsorship (F-1 OPT, then H-1B).'),
  ('citizenship',
   'Are you a US citizen or permanent resident?',
   'No — I am an international student on an F-1 visa.'),
  ('salary',
   'What are your salary expectations?',
   '[TODO: Tom to set — leave flexible / market rate for now]'),
  ('notice_availability',
   'When are you available to start?',
   'Available for the full Summer 2027 internship period (approx. May–August 2027).'),
  ('relocation',
   'Are you willing to relocate?',
   '[TODO: Tom to confirm preferred locations / relocation stance]'),
  ('why_company',
   'Why do you want to work here?',
   '[Template — tailored per application by the pipeline. Tom: set a default angle, e.g. interest in robotics/embedded systems and hands-on autonomy work.]')
ON CONFLICT (key) DO NOTHING;
