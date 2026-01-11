-- Lesson Reminder System
-- Implements 24-hour advance lesson reminders as in-app notifications
-- Uses pg_cron for scheduled execution

-- ============================================================================
-- 1. Enable pg_cron extension (requires Supabase Pro plan)
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================================================
-- 2. Create reminder tracking table (prevents duplicate notifications)
-- ============================================================================
CREATE TABLE lesson_reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lesson_id UUID REFERENCES scheduled_lessons(id) ON DELETE CASCADE,
  session_id UUID REFERENCES lesson_sessions(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL DEFAULT '24h',
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Composite unique constraints for idempotency
-- For individual lessons (no session)
CREATE UNIQUE INDEX idx_reminder_log_lesson
  ON lesson_reminder_log(lesson_id, parent_id, reminder_type)
  WHERE lesson_id IS NOT NULL;

-- For grouped sessions
CREATE UNIQUE INDEX idx_reminder_log_session
  ON lesson_reminder_log(session_id, parent_id, reminder_type)
  WHERE session_id IS NOT NULL;

-- Index for cleanup/monitoring queries
CREATE INDEX idx_reminder_log_created ON lesson_reminder_log(created_at);

-- Enable RLS
ALTER TABLE lesson_reminder_log ENABLE ROW LEVEL SECURITY;

-- Only tutors can view reminder logs (for admin/debugging)
CREATE POLICY "Tutors can view reminder logs"
  ON lesson_reminder_log
  FOR SELECT
  TO authenticated
  USING (is_tutor());

-- ============================================================================
-- 3. Create the reminder function
-- ============================================================================
CREATE OR REPLACE FUNCTION send_scheduled_lesson_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count INTEGER := 0;
  v_reminder RECORD;
  v_notification_id UUID;
BEGIN
  -- Find lessons 23-25 hours from now, grouped by parent and session
  FOR v_reminder IN
    WITH upcoming_lessons AS (
      SELECT
        sl.id AS lesson_id,
        sl.session_id,
        sl.scheduled_at,
        sl.duration_min,
        sl.subject,
        s.name AS student_name,
        p.id AS parent_id
      FROM scheduled_lessons sl
      JOIN students s ON sl.student_id = s.id
      JOIN parents p ON s.parent_id = p.id
      WHERE sl.status = 'scheduled'
        AND sl.scheduled_at BETWEEN NOW() + INTERVAL '23 hours'
                                AND NOW() + INTERVAL '25 hours'
        -- Check parent has lesson_reminders enabled (default true if not set)
        AND COALESCE(p.preferences->'notifications'->>'lesson_reminders', 'true') = 'true'
    ),
    -- Sessions: group lessons that share a session_id
    session_grouped AS (
      SELECT
        parent_id,
        session_id,
        (ARRAY_AGG(lesson_id ORDER BY scheduled_at))[1] AS first_lesson_id,
        MIN(scheduled_at) AS scheduled_at,
        SUM(duration_min) AS total_duration,
        ARRAY_AGG(DISTINCT student_name ORDER BY student_name) AS students,
        ARRAY_AGG(DISTINCT subject::TEXT ORDER BY subject::TEXT) AS subjects,
        ARRAY_AGG(lesson_id ORDER BY scheduled_at) AS lesson_ids
      FROM upcoming_lessons
      WHERE session_id IS NOT NULL
      GROUP BY parent_id, session_id
    ),
    -- Individual lessons: those without a session_id
    individual_lessons AS (
      SELECT
        parent_id,
        NULL::UUID AS session_id,
        lesson_id AS first_lesson_id,
        scheduled_at,
        duration_min AS total_duration,
        ARRAY[student_name] AS students,
        ARRAY[subject::TEXT] AS subjects,
        ARRAY[lesson_id] AS lesson_ids
      FROM upcoming_lessons
      WHERE session_id IS NULL
    ),
    -- Combine both
    all_reminders AS (
      SELECT * FROM session_grouped
      UNION ALL
      SELECT * FROM individual_lessons
    )
    SELECT * FROM all_reminders g
    WHERE NOT EXISTS (
      -- Skip if reminder already sent for this session/lesson
      SELECT 1 FROM lesson_reminder_log lrl
      WHERE lrl.parent_id = g.parent_id
        AND lrl.reminder_type = '24h'
        AND (
          (g.session_id IS NOT NULL AND lrl.session_id = g.session_id)
          OR (g.session_id IS NULL AND lrl.lesson_id = g.first_lesson_id)
        )
    )
  LOOP
    -- Create in-app notification
    v_notification_id := create_notification(
      p_recipient_id := v_reminder.parent_id,
      p_sender_id := NULL,  -- System notification
      p_type := 'lesson_reminder'::notification_type,
      p_title := 'Lesson Tomorrow',
      p_message := format(
        'Reminder: %s has %s lesson tomorrow at %s',
        array_to_string(v_reminder.students, ' & '),
        array_to_string(v_reminder.subjects, ' & '),
        to_char(v_reminder.scheduled_at AT TIME ZONE 'America/Los_Angeles', 'HH:MI AM')
      ),
      p_data := jsonb_build_object(
        'lesson_ids', to_jsonb(v_reminder.lesson_ids),
        'session_id', v_reminder.session_id,
        'students', to_jsonb(v_reminder.students),
        'subjects', to_jsonb(v_reminder.subjects),
        'scheduled_at', v_reminder.scheduled_at,
        'duration_min', v_reminder.total_duration,
        'reminder_type', '24h'
      ),
      p_priority := 'normal'::notification_priority,
      p_action_url := '/calendar'
    );

    -- Log to prevent duplicate reminders
    INSERT INTO lesson_reminder_log (lesson_id, session_id, parent_id, reminder_type, notification_id)
    VALUES (v_reminder.first_lesson_id, v_reminder.session_id, v_reminder.parent_id, '24h', v_notification_id);

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION send_scheduled_lesson_reminders TO postgres;

-- ============================================================================
-- 4. Schedule the pg_cron job (runs every hour)
-- ============================================================================
SELECT cron.schedule(
  'lesson-reminders-24h',           -- Job name
  '0 * * * *',                       -- Every hour, on the hour
  $$SELECT send_scheduled_lesson_reminders()$$
);

-- ============================================================================
-- 5. Optional: Cleanup function for old reminder logs (run monthly)
-- ============================================================================
CREATE OR REPLACE FUNCTION cleanup_old_reminder_logs()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  -- Delete logs older than 90 days
  DELETE FROM lesson_reminder_log
  WHERE created_at < NOW() - INTERVAL '90 days';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Schedule monthly cleanup (1st of each month at 3 AM UTC)
SELECT cron.schedule(
  'cleanup-reminder-logs',
  '0 3 1 * *',
  $$SELECT cleanup_old_reminder_logs()$$
);

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE lesson_reminder_log IS 'Tracks sent lesson reminders to prevent duplicates';
COMMENT ON FUNCTION send_scheduled_lesson_reminders() IS 'Sends 24h advance lesson reminders to parents. Run hourly via pg_cron.';
COMMENT ON FUNCTION cleanup_old_reminder_logs() IS 'Removes reminder logs older than 90 days. Run monthly via pg_cron.';
