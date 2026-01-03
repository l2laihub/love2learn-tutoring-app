-- Migration: Handle New User Trigger
-- Version: 20260102000003
-- Description: Creates a trigger to automatically create a parent record when a new user signs up

-- ============================================================================
-- FUNCTION: Handle new user registration
-- ============================================================================

-- This function creates a parent record when a new user registers
-- It extracts the name from user metadata and uses the email from auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.parents (user_id, name, email, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
        NEW.email,
        'parent'  -- Default role for new users
    )
    ON CONFLICT (email) DO NOTHING;  -- Prevent duplicate email errors

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGER: Create parent on user signup
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger that fires after a new user is inserted into auth.users
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- BACKFILL: Create parent records for existing users without one
-- ============================================================================

-- This handles any users who registered before this trigger existed
INSERT INTO public.parents (user_id, name, email, role)
SELECT
    u.id,
    COALESCE(u.raw_user_meta_data->>'name', 'User'),
    u.email,
    'parent'
FROM auth.users u
LEFT JOIN public.parents p ON p.user_id = u.id
WHERE p.id IS NULL
ON CONFLICT (email) DO NOTHING;
