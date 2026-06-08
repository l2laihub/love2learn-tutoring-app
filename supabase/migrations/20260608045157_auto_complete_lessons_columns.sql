-- Auto-complete & auto-pay lessons: per-tutor toggle + auto-mark audit stamp.

-- Per-tutor opt-out. Default ON: every tutor gets the automation immediately.
ALTER TABLE parents
  ADD COLUMN IF NOT EXISTS auto_complete_lessons BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN parents.auto_complete_lessons IS
  'Tutor setting: when true, finished lessons are auto-marked completed + paid at end of day.';

-- Set when the nightly job auto-marks a lesson. Distinguishes auto from manual
-- completion (used by the weekly recap). NOT used for idempotency (status is).
ALTER TABLE scheduled_lessons
  ADD COLUMN IF NOT EXISTS auto_completed_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN scheduled_lessons.auto_completed_at IS
  'Timestamp the auto-complete job marked this lesson completed; NULL for manual completion.';
