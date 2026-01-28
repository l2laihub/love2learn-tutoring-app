-- Migration: Scheduled Payment Reminders
-- Adds automated daily payment reminder function and pg_cron job
-- Note: pg_cron must be enabled in your Supabase project for the cron job to work

-- Function to get the payment due day from tutor settings
CREATE OR REPLACE FUNCTION get_reminder_due_day()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_due_day INTEGER;
BEGIN
  SELECT COALESCE((reminder_settings->>'due_day_of_month')::integer, 7)
  INTO v_due_day
  FROM tutor_settings
  LIMIT 1;

  RETURN COALESCE(v_due_day, 7);
END;
$$;

-- Function to check if reminders are enabled
CREATE OR REPLACE FUNCTION are_reminders_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_enabled BOOLEAN;
BEGIN
  SELECT COALESCE((reminder_settings->>'enabled')::boolean, false)
  INTO v_enabled
  FROM tutor_settings
  LIMIT 1;

  RETURN COALESCE(v_enabled, false);
END;
$$;

-- Main function to send scheduled payment reminders
-- This function creates in-app notifications for payments needing reminders
-- The edge function handles actual email sending when invoked
CREATE OR REPLACE FUNCTION send_scheduled_payment_reminders()
RETURNS TABLE (
  reminders_created INTEGER,
  notifications_created INTEGER,
  errors_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reminders_count INTEGER := 0;
  v_notifications_count INTEGER := 0;
  v_errors_count INTEGER := 0;
  v_due_day INTEGER;
  v_due_date DATE;
  v_days_until_due INTEGER;
  v_days_past_due INTEGER;
  v_reminder_type payment_reminder_type;
  v_friendly_days INTEGER;
  v_payment RECORD;
  v_notification_id UUID;
BEGIN
  -- Exit if reminders are not enabled
  IF NOT are_reminders_enabled() THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  -- Get the due day from settings
  v_due_day := get_reminder_due_day();

  -- Calculate due date for current month (handle month rollover for days > 28)
  v_due_date := DATE_TRUNC('month', CURRENT_DATE) + (LEAST(v_due_day, 28) - 1);

  -- Get friendly reminder days before due
  SELECT COALESCE((reminder_settings->>'friendly_reminder_days_before')::integer, 3)
  INTO v_friendly_days
  FROM tutor_settings
  LIMIT 1;

  -- Calculate days relative to due date
  v_days_until_due := v_due_date - CURRENT_DATE;
  v_days_past_due := CURRENT_DATE - v_due_date;

  -- Process each unpaid/partial payment
  FOR v_payment IN
    SELECT
      p.id as payment_id,
      p.parent_id,
      p.amount_due,
      p.amount_paid,
      p.month,
      pr.name as parent_name,
      pr.email as parent_email,
      COALESCE((pr.preferences->'notifications'->>'payment_due')::boolean, true) as notifications_enabled
    FROM payments p
    JOIN parents pr ON p.parent_id = pr.id
    WHERE p.status IN ('unpaid', 'partial')
      AND p.payment_type = 'invoice'
      AND p.month = DATE_TRUNC('month', CURRENT_DATE)::text
  LOOP
    -- Skip if parent has disabled payment notifications
    IF NOT v_payment.notifications_enabled THEN
      CONTINUE;
    END IF;

    -- Determine which reminder type to send (if any)
    v_reminder_type := NULL;

    -- Friendly reminder (X days before due)
    IF v_days_until_due = v_friendly_days THEN
      v_reminder_type := 'friendly';
    -- Due date reminder
    ELSIF v_days_until_due = 0 THEN
      v_reminder_type := 'due_date';
    -- Past due reminders (check against configured intervals)
    ELSIF v_days_past_due = 3 THEN
      v_reminder_type := 'past_due_3';
    ELSIF v_days_past_due = 7 THEN
      v_reminder_type := 'past_due_7';
    ELSIF v_days_past_due = 14 THEN
      v_reminder_type := 'past_due_14';
    END IF;

    -- If we have a reminder type to send, check if already sent today
    IF v_reminder_type IS NOT NULL THEN
      -- Check if this reminder type was already sent today (using UTC for consistency with index)
      IF NOT EXISTS (
        SELECT 1 FROM payment_reminders
        WHERE payment_id = v_payment.payment_id
          AND reminder_type = v_reminder_type
          AND (sent_at AT TIME ZONE 'UTC')::date = (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')::date
      ) THEN
        BEGIN
          -- Create in-app notification
          INSERT INTO notifications (
            recipient_id,
            sender_id,
            type,
            title,
            message,
            priority,
            data,
            action_url
          ) VALUES (
            v_payment.parent_id,
            NULL, -- System notification
            'payment_reminder'::notification_type,
            CASE v_reminder_type
              WHEN 'friendly' THEN 'Upcoming Invoice Reminder'
              WHEN 'due_date' THEN 'Invoice Due Today'
              ELSE 'Payment Overdue'
            END,
            format(
              'Your invoice for %s has a balance of $%s.',
              TO_CHAR(v_payment.month::date, 'Month YYYY'),
              (v_payment.amount_due - v_payment.amount_paid)::numeric(10,2)
            ),
            CASE
              WHEN v_reminder_type IN ('past_due_7', 'past_due_14') THEN 'high'::notification_priority
              ELSE 'normal'::notification_priority
            END,
            jsonb_build_object(
              'payment_id', v_payment.payment_id,
              'amount_due', v_payment.amount_due,
              'amount_paid', v_payment.amount_paid,
              'balance_due', v_payment.amount_due - v_payment.amount_paid,
              'month', v_payment.month,
              'reminder_type', v_reminder_type::text
            ),
            '/payments'
          )
          RETURNING id INTO v_notification_id;

          v_notifications_count := v_notifications_count + 1;

          -- Log the reminder (email_sent = false because we're just creating notification)
          -- The edge function will be called separately to send the actual email
          INSERT INTO payment_reminders (
            payment_id,
            parent_id,
            reminder_type,
            notification_id,
            email_sent,
            sent_at
          ) VALUES (
            v_payment.payment_id,
            v_payment.parent_id,
            v_reminder_type,
            v_notification_id,
            false, -- Email will be sent by edge function
            NOW()
          );

          v_reminders_count := v_reminders_count + 1;

        EXCEPTION WHEN OTHERS THEN
          v_errors_count := v_errors_count + 1;
          RAISE NOTICE 'Error creating reminder for payment %: %', v_payment.payment_id, SQLERRM;
        END;
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_reminders_count, v_notifications_count, v_errors_count;
END;
$$;

-- Grant execute permission to service role (for cron job)
GRANT EXECUTE ON FUNCTION send_scheduled_payment_reminders() TO service_role;

-- Schedule the pg_cron job (runs daily at 9 AM UTC)
-- Note: This will fail silently if pg_cron extension is not enabled
DO $outer$
BEGIN
  -- Check if pg_cron extension is available
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Unschedule if exists (to allow re-running migration)
    PERFORM cron.unschedule('payment-reminders-daily');

    -- Schedule the job
    PERFORM cron.schedule(
      'payment-reminders-daily',
      '0 9 * * *',  -- 9:00 AM UTC daily
      'SELECT * FROM send_scheduled_payment_reminders()'
    );

    RAISE NOTICE 'Payment reminder cron job scheduled successfully';
  ELSE
    RAISE NOTICE 'pg_cron extension not available - skipping cron job scheduling. You can manually call send_scheduled_payment_reminders() or enable pg_cron in your Supabase dashboard.';
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule cron job: %. You can manually call send_scheduled_payment_reminders() instead.', SQLERRM;
END $outer$;

-- Add comments for documentation
COMMENT ON FUNCTION get_reminder_due_day() IS 'Returns the payment due day from tutor_settings (default: 7th of month)';
COMMENT ON FUNCTION are_reminders_enabled() IS 'Returns true if automated payment reminders are enabled in tutor_settings';
COMMENT ON FUNCTION send_scheduled_payment_reminders() IS 'Creates in-app notifications for payments needing reminders. Call daily via pg_cron or manually.';
