-- Migration: Payment Reminders System
-- Adds tracking for payment reminder emails sent to parents

-- Create payment reminder type enum for escalating reminders
CREATE TYPE payment_reminder_type AS ENUM (
  'friendly',      -- Friendly reminder (e.g., 3 days before due)
  'due_date',      -- On due date reminder
  'past_due_3',    -- 3 days past due
  'past_due_7',    -- 7 days past due
  'past_due_14',   -- 14 days past due
  'manual'         -- Manual reminder sent by tutor
);

-- Create payment reminders tracking table
CREATE TABLE payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  reminder_type payment_reminder_type NOT NULL,

  -- Email tracking
  email_sent BOOLEAN DEFAULT FALSE,
  email_id TEXT,  -- Resend email ID for tracking delivery

  -- Notification tracking
  notification_id UUID REFERENCES notifications(id) ON DELETE SET NULL,

  -- Custom message (for manual reminders)
  message TEXT,

  -- Timestamps
  sent_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Composite unique constraint to prevent duplicate reminders of same type on same day
-- This allows one friendly reminder, one due_date reminder, etc. per day per payment
-- Note: Using (sent_at AT TIME ZONE 'UTC')::date to make the expression IMMUTABLE
CREATE UNIQUE INDEX idx_payment_reminder_unique
  ON payment_reminders(payment_id, reminder_type, ((sent_at AT TIME ZONE 'UTC')::date));

-- Indexes for performance
CREATE INDEX idx_payment_reminders_payment ON payment_reminders(payment_id);
CREATE INDEX idx_payment_reminders_parent ON payment_reminders(parent_id);
CREATE INDEX idx_payment_reminders_sent_at ON payment_reminders(sent_at DESC);
CREATE INDEX idx_payment_reminders_type ON payment_reminders(reminder_type);

-- Enable RLS
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;

-- Policy: Tutors can view all reminder logs
CREATE POLICY "Tutors can view all reminders"
  ON payment_reminders
  FOR SELECT
  TO authenticated
  USING (is_tutor());

-- Policy: Parents can view their own reminders
CREATE POLICY "Parents can view their reminders"
  ON payment_reminders
  FOR SELECT
  TO authenticated
  USING (
    NOT is_tutor() AND
    EXISTS (
      SELECT 1 FROM parents
      WHERE parents.id = payment_reminders.parent_id
      AND parents.user_id = auth.uid()
    )
  );

-- Policy: Only tutors can insert reminders (via edge function or manual)
CREATE POLICY "Tutors can create reminders"
  ON payment_reminders
  FOR INSERT
  TO authenticated
  WITH CHECK (is_tutor());

-- Policy: Service role can insert reminders (for automated scheduled reminders)
CREATE POLICY "Service role can create reminders"
  ON payment_reminders
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE payment_reminders IS 'Tracks payment reminder emails sent to parents to prevent duplicates and provide history';
COMMENT ON COLUMN payment_reminders.reminder_type IS 'Type of reminder: friendly (before due), due_date, past_due_3/7/14 (days overdue), or manual';
COMMENT ON COLUMN payment_reminders.email_id IS 'Resend email ID for tracking delivery status';
COMMENT ON COLUMN payment_reminders.message IS 'Custom message content (used for manual reminders)';

-- Add reminder settings to tutor_settings table
ALTER TABLE tutor_settings
ADD COLUMN IF NOT EXISTS reminder_settings JSONB NOT NULL DEFAULT '{
  "enabled": false,
  "due_day_of_month": 7,
  "friendly_reminder_days_before": 3,
  "past_due_intervals": [3, 7, 14],
  "send_email": true,
  "send_notification": true
}'::jsonb;

COMMENT ON COLUMN tutor_settings.reminder_settings IS 'Payment reminder automation settings: enabled, due_day_of_month, friendly_reminder_days_before, past_due_intervals[], send_email, send_notification';

-- Add payment_reminder to notification_type enum if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'notification_type'
    AND e.enumlabel = 'payment_reminder'
  ) THEN
    ALTER TYPE notification_type ADD VALUE 'payment_reminder';
  END IF;
END $$;
