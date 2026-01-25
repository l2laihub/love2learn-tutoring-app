-- Migration: Group Session Enrollments
-- Enables parents to sign up for existing scheduled group sessions
-- Two tables: group_session_settings (session config) and session_enrollments (enrollment requests)
-- IDEMPOTENT: Safe to run multiple times

-- ============================================================================
-- Helper function: handle_updated_at
-- Automatically sets updated_at to current timestamp on row update
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_updated_at IS 'Trigger function to automatically update updated_at timestamp';

-- ============================================================================
-- Table 1: group_session_settings
-- Stores configuration for sessions that are open for enrollment
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.group_session_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.lesson_sessions(id) ON DELETE CASCADE,
  is_open_for_enrollment boolean DEFAULT true,
  max_students integer DEFAULT 4,
  enrollment_deadline_hours integer DEFAULT 24,
  allowed_subjects text[] DEFAULT NULL, -- NULL means any subject
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_session_settings UNIQUE (session_id)
);

-- Add comment
COMMENT ON TABLE public.group_session_settings IS 'Configuration for sessions open for parent enrollment';
COMMENT ON COLUMN public.group_session_settings.max_students IS 'Maximum number of students allowed in this session';
COMMENT ON COLUMN public.group_session_settings.enrollment_deadline_hours IS 'Hours before session when enrollment closes';
COMMENT ON COLUMN public.group_session_settings.allowed_subjects IS 'Array of subjects allowed for enrollment (NULL = any)';

-- ============================================================================
-- Table 2: session_enrollments
-- Stores enrollment requests from parents
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enrollment_status') THEN
    CREATE TYPE public.enrollment_status AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.session_enrollments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.lesson_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  parent_id uuid NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  subject text NOT NULL,
  duration_min integer NOT NULL,
  status public.enrollment_status DEFAULT 'pending',
  notes text,
  tutor_response text,
  scheduled_lesson_id uuid REFERENCES public.scheduled_lessons(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Prevent duplicate enrollments
  CONSTRAINT unique_student_session_enrollment UNIQUE (session_id, student_id)
);

-- Add comment
COMMENT ON TABLE public.session_enrollments IS 'Enrollment requests from parents for group sessions';
COMMENT ON COLUMN public.session_enrollments.scheduled_lesson_id IS 'Set when enrollment is approved and lesson is created';

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_group_session_settings_session_id ON public.group_session_settings(session_id);
CREATE INDEX IF NOT EXISTS idx_group_session_settings_open ON public.group_session_settings(is_open_for_enrollment) WHERE is_open_for_enrollment = true;

CREATE INDEX IF NOT EXISTS idx_session_enrollments_session_id ON public.session_enrollments(session_id);
CREATE INDEX IF NOT EXISTS idx_session_enrollments_student_id ON public.session_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_session_enrollments_parent_id ON public.session_enrollments(parent_id);
CREATE INDEX IF NOT EXISTS idx_session_enrollments_status ON public.session_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_session_enrollments_pending ON public.session_enrollments(status) WHERE status = 'pending';

-- ============================================================================
-- Updated_at trigger
-- ============================================================================
DROP TRIGGER IF EXISTS set_updated_at_group_session_settings ON public.group_session_settings;
CREATE TRIGGER set_updated_at_group_session_settings
  BEFORE UPDATE ON public.group_session_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_session_enrollments ON public.session_enrollments;
CREATE TRIGGER set_updated_at_session_enrollments
  BEFORE UPDATE ON public.session_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================================
-- RLS Policies
-- ============================================================================

-- Enable RLS
ALTER TABLE public.group_session_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_enrollments ENABLE ROW LEVEL SECURITY;

-- group_session_settings policies
-- Tutors: full access
DROP POLICY IF EXISTS "Tutors have full access to group_session_settings" ON public.group_session_settings;
CREATE POLICY "Tutors have full access to group_session_settings"
  ON public.group_session_settings
  FOR ALL
  TO authenticated
  USING (public.is_tutor())
  WITH CHECK (public.is_tutor());

-- Parents: read only for open sessions
DROP POLICY IF EXISTS "Parents can view open group_session_settings" ON public.group_session_settings;
CREATE POLICY "Parents can view open group_session_settings"
  ON public.group_session_settings
  FOR SELECT
  TO authenticated
  USING (
    is_open_for_enrollment = true
    OR public.is_tutor()
  );

-- session_enrollments policies
-- Tutors: full access
DROP POLICY IF EXISTS "Tutors have full access to session_enrollments" ON public.session_enrollments;
CREATE POLICY "Tutors have full access to session_enrollments"
  ON public.session_enrollments
  FOR ALL
  TO authenticated
  USING (public.is_tutor())
  WITH CHECK (public.is_tutor());

-- Parents: view own enrollments
DROP POLICY IF EXISTS "Parents can view own session_enrollments" ON public.session_enrollments;
CREATE POLICY "Parents can view own session_enrollments"
  ON public.session_enrollments
  FOR SELECT
  TO authenticated
  USING (
    parent_id = (SELECT id FROM public.get_current_user_parent() LIMIT 1)
    OR public.is_tutor()
  );

-- Parents: create enrollments for own students
DROP POLICY IF EXISTS "Parents can create enrollments for own students" ON public.session_enrollments;
CREATE POLICY "Parents can create enrollments for own students"
  ON public.session_enrollments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_id = (SELECT id FROM public.get_current_user_parent() LIMIT 1)
    AND student_id IN (
      SELECT s.id FROM public.students s
      WHERE s.parent_id = (SELECT id FROM public.get_current_user_parent() LIMIT 1)
    )
  );

-- Parents: cancel pending enrollments (update status to cancelled)
DROP POLICY IF EXISTS "Parents can cancel own pending enrollments" ON public.session_enrollments;
CREATE POLICY "Parents can cancel own pending enrollments"
  ON public.session_enrollments
  FOR UPDATE
  TO authenticated
  USING (
    parent_id = (SELECT id FROM public.get_current_user_parent() LIMIT 1)
    AND status = 'pending'
  )
  WITH CHECK (
    parent_id = (SELECT id FROM public.get_current_user_parent() LIMIT 1)
    AND status = 'cancelled'
  );

-- ============================================================================
-- Helper function: Get current enrollment count for a session
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_session_enrollment_count(p_session_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM public.session_enrollments
  WHERE session_id = p_session_id
    AND status IN ('pending', 'approved');
$$;

COMMENT ON FUNCTION public.get_session_enrollment_count IS 'Returns count of pending + approved enrollments for a session';

-- ============================================================================
-- Helper function: Get current student count for a session (existing lessons)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_session_student_count(p_session_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(DISTINCT student_id)::integer
  FROM public.scheduled_lessons
  WHERE session_id = p_session_id
    AND status != 'cancelled';
$$;

COMMENT ON FUNCTION public.get_session_student_count IS 'Returns count of distinct students in a session (from scheduled_lessons)';

-- ============================================================================
-- Helper function: Check if session has available slots
-- ============================================================================
CREATE OR REPLACE FUNCTION public.session_has_available_slots(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_session_settings gss
    WHERE gss.session_id = p_session_id
      AND gss.is_open_for_enrollment = true
      AND (
        public.get_session_student_count(p_session_id) +
        public.get_session_enrollment_count(p_session_id)
      ) < gss.max_students
  );
$$;

COMMENT ON FUNCTION public.session_has_available_slots IS 'Checks if a session has available enrollment slots';

-- ============================================================================
-- Helper function: Check if enrollment deadline has passed
-- ============================================================================
CREATE OR REPLACE FUNCTION public.session_enrollment_open(p_session_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.group_session_settings gss
    JOIN public.lesson_sessions ls ON ls.id = gss.session_id
    WHERE gss.session_id = p_session_id
      AND gss.is_open_for_enrollment = true
      AND ls.scheduled_at > NOW() + (gss.enrollment_deadline_hours * interval '1 hour')
  );
$$;

COMMENT ON FUNCTION public.session_enrollment_open IS 'Checks if enrollment is still open (before deadline)';
