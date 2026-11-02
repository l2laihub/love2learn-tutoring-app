-- Content reporting and user blocking for messages
-- App Store Guideline 1.2 (User-Generated Content): apps where users can
-- message each other need a way to report objectionable content and to
-- block abusive users. Reports are written by the report-content edge
-- function (service role) so it can snapshot the message and email support.

-- =====================================================
-- TABLE: content_reports
-- =====================================================
CREATE TABLE content_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SET NULL so a report survives account deletion for moderation records
  reporter_id UUID REFERENCES parents(id) ON DELETE SET NULL,
  reported_user_id UUID REFERENCES parents(id) ON DELETE SET NULL,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  thread_id UUID REFERENCES message_threads(id) ON DELETE SET NULL,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'other')),
  details TEXT CHECK (details IS NULL OR char_length(details) <= 1000),
  -- Copy of the message at report time, in case the sender deletes it
  message_snapshot TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMPTZ
);

CREATE INDEX idx_content_reports_status ON content_reports(status, created_at DESC);
CREATE INDEX idx_content_reports_reporter ON content_reports(reporter_id);

ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;

-- Users can see the reports they filed. Inserts go through the edge function.
CREATE POLICY "Users can view their own reports"
  ON content_reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = get_parent_id());

-- =====================================================
-- TABLE: user_blocks
-- =====================================================
CREATE TABLE user_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  -- Name at block time, so the blocked list can show it without reading
  -- the other person's parents row (RLS may hide it)
  blocked_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

CREATE INDEX idx_user_blocks_blocker ON user_blocks(blocker_id);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their blocks"
  ON user_blocks
  FOR SELECT
  TO authenticated
  USING (blocker_id = get_parent_id());

CREATE POLICY "Users can create their blocks"
  ON user_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = get_parent_id());

CREATE POLICY "Users can remove their blocks"
  ON user_blocks
  FOR DELETE
  TO authenticated
  USING (blocker_id = get_parent_id());
