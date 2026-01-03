-- Migration: Link payments to lessons
-- Version: 20260102000011
-- Description: Creates junction table to link payments to scheduled lessons

-- ============================================================================
-- PAYMENT LESSONS JUNCTION TABLE
-- ============================================================================

-- Junction table linking payments to the lessons they cover
CREATE TABLE IF NOT EXISTS payment_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES scheduled_lessons(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT payment_lessons_unique UNIQUE (payment_id, lesson_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_payment_lessons_payment_id ON payment_lessons(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_lessons_lesson_id ON payment_lessons(lesson_id);

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

ALTER TABLE payment_lessons ENABLE ROW LEVEL SECURITY;

-- Parents can view payment_lessons for their own payments
CREATE POLICY "Parents can view own payment_lessons"
    ON payment_lessons FOR SELECT
    USING (
        payment_id IN (
            SELECT id FROM payments WHERE parent_id = public.get_parent_id()
        )
    );

-- Tutors have full access to payment_lessons
CREATE POLICY "Tutors can manage all payment_lessons"
    ON payment_lessons FOR ALL
    USING (public.is_tutor())
    WITH CHECK (public.is_tutor());

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE payment_lessons IS 'Junction table linking payments to the specific lessons they cover';
COMMENT ON COLUMN payment_lessons.amount IS 'The calculated amount for this specific lesson based on duration and rate';
