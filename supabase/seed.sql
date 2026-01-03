-- Seed Data for Love2Learn Tutoring App
-- This file is run after migrations to populate initial data
-- Run with: supabase db reset (includes migrations + seed)

-- ============================================================================
-- SAMPLE DATA FOR DEVELOPMENT
-- ============================================================================

-- Note: In development, you may want to temporarily disable RLS
-- to allow inserting data without authentication:
--
-- ALTER TABLE parents DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE students DISABLE ROW LEVEL SECURITY;
-- etc.

-- Sample parent (for testing without auth)
-- Uses a fixed UUID so we can reference it consistently
INSERT INTO parents (id, user_id, name, email, phone)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    NULL,  -- No auth user in dev mode
    'Sarah Johnson',
    'sarah.johnson@example.com',
    '(555) 123-4567'
)
ON CONFLICT (email) DO NOTHING;

-- Sample students
INSERT INTO students (parent_id, name, age, grade_level)
VALUES
    ('00000000-0000-0000-0000-000000000001', 'Emma Johnson', 8, '2nd'),
    ('00000000-0000-0000-0000-000000000001', 'Liam Johnson', 10, '4th'),
    ('00000000-0000-0000-0000-000000000001', 'Olivia Johnson', 6, 'K')
ON CONFLICT DO NOTHING;

-- Sample scheduled lessons (for the next week)
INSERT INTO scheduled_lessons (student_id, subject, scheduled_at, duration_min, status, notes)
SELECT
    s.id,
    'piano',
    NOW() + INTERVAL '1 day' + INTERVAL '15 hours',  -- Tomorrow at 3 PM
    30,
    'scheduled',
    'Focus on scales practice'
FROM students s WHERE s.name = 'Emma Johnson'
LIMIT 1;

INSERT INTO scheduled_lessons (student_id, subject, scheduled_at, duration_min, status, notes)
SELECT
    s.id,
    'math',
    NOW() + INTERVAL '2 days' + INTERVAL '16 hours',  -- Day after tomorrow at 4 PM
    45,
    'scheduled',
    'Multiplication tables review'
FROM students s WHERE s.name = 'Liam Johnson'
LIMIT 1;

INSERT INTO scheduled_lessons (student_id, subject, scheduled_at, duration_min, status, notes)
SELECT
    s.id,
    'piano',
    NOW() + INTERVAL '3 days' + INTERVAL '14 hours',  -- 3 days from now at 2 PM
    30,
    'scheduled',
    'Introduction to reading notes'
FROM students s WHERE s.name = 'Olivia Johnson'
LIMIT 1;

-- Sample payment record for current month
INSERT INTO payments (parent_id, month, amount_due, amount_paid, status, notes)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    DATE_TRUNC('month', CURRENT_DATE),
    150.00,
    0.00,
    'unpaid',
    'January 2026 - 3 students'
)
ON CONFLICT (parent_id, month) DO NOTHING;

-- Sample achievements
INSERT INTO achievements (name, description, icon, points, criteria)
VALUES
    ('First Note', 'Completed your first piano lesson', 'musical-note', 10, '{"lessons_completed": 1, "subject": "piano"}'),
    ('Math Whiz', 'Scored 100% on a math worksheet', 'star', 25, '{"perfect_score": true, "subject": "math"}'),
    ('Practice Makes Perfect', 'Completed 10 lessons', 'trophy', 50, '{"lessons_completed": 10}'),
    ('Weekly Warrior', 'Attended lessons every day for a week', 'flame', 100, '{"consecutive_days": 7}')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- HELPFUL QUERIES FOR DEVELOPMENT
-- ============================================================================

-- To view all data:
-- SELECT * FROM parents;
-- SELECT * FROM students;
-- SELECT * FROM scheduled_lessons;
-- SELECT * FROM payments;

-- To disable RLS for development:
-- ALTER TABLE parents DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE students DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE scheduled_lessons DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE assignments DISABLE ROW LEVEL SECURITY;

-- To re-enable RLS:
-- ALTER TABLE parents ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE students ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE scheduled_lessons ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
