-- Migration: Initial Schema for Love2Learn Tutoring App
-- Version: 20260102000000
-- Description: Creates all core tables, indexes, triggers, and seed data

-- ============================================================================
-- NOTE: Supabase uses gen_random_uuid() which is built into PostgreSQL 13+
-- No extension needed for UUID generation
-- ============================================================================

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Progress status for student lessons
DO $$ BEGIN
    CREATE TYPE progress_status AS ENUM ('not_started', 'in_progress', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Message roles for chat
DO $$ BEGIN
    CREATE TYPE message_role AS ENUM ('user', 'assistant', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Tutoring subjects
DO $$ BEGIN
    CREATE TYPE tutoring_subject AS ENUM ('piano', 'math');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Lesson status
DO $$ BEGIN
    CREATE TYPE lesson_status AS ENUM ('scheduled', 'completed', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Payment status
DO $$ BEGIN
    CREATE TYPE payment_status AS ENUM ('unpaid', 'partial', 'paid');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Assignment status
DO $$ BEGIN
    CREATE TYPE assignment_status AS ENUM ('assigned', 'completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Worksheet types
DO $$ BEGIN
    CREATE TYPE worksheet_type AS ENUM ('piano_naming', 'piano_drawing', 'math');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Parents table (linked to auth.users)
CREATE TABLE IF NOT EXISTS parents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT parents_email_unique UNIQUE (email)
);

-- Students table (linked to parents)
CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    age INTEGER NOT NULL CHECK (age >= 0 AND age <= 100),
    grade_level TEXT NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subjects table (for content lessons)
CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lessons table (content lessons for learning)
CREATE TABLE IF NOT EXISTS lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    content JSONB NOT NULL DEFAULT '{}',
    difficulty_level INTEGER DEFAULT 1 CHECK (difficulty_level >= 1 AND difficulty_level <= 5),
    estimated_duration_minutes INTEGER DEFAULT 30,
    grade_level TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student progress tracking
CREATE TABLE IF NOT EXISTS student_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
    status progress_status DEFAULT 'not_started',
    score INTEGER CHECK (score >= 0 AND score <= 100),
    time_spent_seconds INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT student_progress_unique UNIQUE (student_id, lesson_id)
);

-- Achievements
CREATE TABLE IF NOT EXISTS achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    points INTEGER DEFAULT 0,
    criteria JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Student achievements (earned badges)
CREATE TABLE IF NOT EXISTS student_achievements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    achievement_id UUID NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT student_achievements_unique UNIQUE (student_id, achievement_id)
);

-- Chat sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE SET NULL,
    title TEXT DEFAULT 'New Chat',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role message_role NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- TUTORING BUSINESS TABLES
-- ============================================================================

-- Scheduled tutoring lessons (appointments)
CREATE TABLE IF NOT EXISTS scheduled_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    subject tutoring_subject NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_min INTEGER NOT NULL DEFAULT 30 CHECK (duration_min > 0),
    status lesson_status DEFAULT 'scheduled',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments (monthly billing)
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    amount_due DECIMAL(10,2) NOT NULL DEFAULT 0,
    amount_paid DECIMAL(10,2) NOT NULL DEFAULT 0,
    status payment_status DEFAULT 'unpaid',
    paid_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT payments_parent_month_unique UNIQUE (parent_id, month)
);

-- Assignments (worksheets assigned to students)
CREATE TABLE IF NOT EXISTS assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    worksheet_type worksheet_type NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    pdf_url TEXT,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    due_date DATE,
    status assignment_status DEFAULT 'assigned',
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Parents
CREATE INDEX IF NOT EXISTS idx_parents_user_id ON parents(user_id);
CREATE INDEX IF NOT EXISTS idx_parents_email ON parents(email);

-- Students
CREATE INDEX IF NOT EXISTS idx_students_parent_id ON students(parent_id);
CREATE INDEX IF NOT EXISTS idx_students_name ON students(name);

-- Lessons
CREATE INDEX IF NOT EXISTS idx_lessons_subject_id ON lessons(subject_id);
CREATE INDEX IF NOT EXISTS idx_lessons_grade_level ON lessons(grade_level);

-- Student Progress
CREATE INDEX IF NOT EXISTS idx_student_progress_student_id ON student_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_student_progress_lesson_id ON student_progress(lesson_id);

-- Scheduled Lessons
CREATE INDEX IF NOT EXISTS idx_scheduled_lessons_student_id ON scheduled_lessons(student_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_lessons_scheduled_at ON scheduled_lessons(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_lessons_status ON scheduled_lessons(status);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_parent_id ON payments(parent_id);
CREATE INDEX IF NOT EXISTS idx_payments_month ON payments(month);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Assignments
CREATE INDEX IF NOT EXISTS idx_assignments_student_id ON assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_status ON assignments(status);
CREATE INDEX IF NOT EXISTS idx_assignments_due_date ON assignments(due_date);

-- Chat
CREATE INDEX IF NOT EXISTS idx_chat_sessions_student_id ON chat_sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update timestamps
DROP TRIGGER IF EXISTS update_parents_updated_at ON parents;
CREATE TRIGGER update_parents_updated_at
    BEFORE UPDATE ON parents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_students_updated_at ON students;
CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON students
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_lessons_updated_at ON lessons;
CREATE TRIGGER update_lessons_updated_at
    BEFORE UPDATE ON lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_student_progress_updated_at ON student_progress;
CREATE TRIGGER update_student_progress_updated_at
    BEFORE UPDATE ON student_progress
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_scheduled_lessons_updated_at ON scheduled_lessons;
CREATE TRIGGER update_scheduled_lessons_updated_at
    BEFORE UPDATE ON scheduled_lessons
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_payments_updated_at ON payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER update_chat_sessions_updated_at
    BEFORE UPDATE ON chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA
-- ============================================================================

-- Insert default subjects
INSERT INTO subjects (name, description, icon, color) VALUES
    ('Piano', 'Piano lessons and music theory', 'musical-notes', '#FF6B6B'),
    ('Math', 'Mathematics from K-6 grade levels', 'calculator', '#4CAF50')
ON CONFLICT (name) DO NOTHING;
