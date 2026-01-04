-- Migration: Fix Handle New User Trigger for Imported Parents
-- Version: 20260103000001
-- Description: Updates the handle_new_user trigger to link existing imported parents
--              instead of creating duplicate records

-- ============================================================================
-- PROBLEM:
-- When a parent is imported by the tutor (with user_id = NULL), and they later
-- sign up, the old trigger would try to INSERT a new record and fail silently
-- due to ON CONFLICT DO NOTHING. This left the parent unlinked to their auth account.
--
-- SOLUTION:
-- Update the trigger to first check for existing parent records by email,
-- and UPDATE them with the new user_id instead of inserting duplicates.
-- ============================================================================

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the improved function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    existing_parent_id UUID;
BEGIN
    -- Check if a parent record already exists for this email (imported by tutor)
    SELECT id INTO existing_parent_id
    FROM public.parents
    WHERE email = NEW.email
    AND user_id IS NULL;  -- Only match unlinked records

    IF existing_parent_id IS NOT NULL THEN
        -- Link the existing parent record to the new auth user
        UPDATE public.parents
        SET
            user_id = NEW.id,
            -- Update name if provided in signup metadata and current name is generic
            name = CASE
                WHEN name = 'User' OR name = '' OR name IS NULL
                THEN COALESCE(NEW.raw_user_meta_data->>'name', name)
                ELSE name
            END,
            updated_at = NOW()
        WHERE id = existing_parent_id;

        RAISE NOTICE 'Linked existing parent % to auth user %', existing_parent_id, NEW.id;
    ELSE
        -- Check if there's an existing parent with this email that's already linked
        SELECT id INTO existing_parent_id
        FROM public.parents
        WHERE email = NEW.email
        AND user_id IS NOT NULL;

        IF existing_parent_id IS NOT NULL THEN
            -- Parent already linked to another user - this shouldn't happen normally
            -- but we'll handle it gracefully by doing nothing
            RAISE NOTICE 'Parent with email % already linked to another user', NEW.email;
        ELSE
            -- No existing parent - create a new one (fresh signup)
            INSERT INTO public.parents (user_id, name, email, role)
            VALUES (
                NEW.id,
                COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
                NEW.email,
                'parent'  -- Default role for new users
            );

            RAISE NOTICE 'Created new parent record for auth user %', NEW.id;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- BACKFILL: Link any existing auth users to their parent records
-- This handles cases where users registered but weren't linked properly
-- ============================================================================

UPDATE public.parents p
SET user_id = u.id
FROM auth.users u
WHERE p.email = u.email
AND p.user_id IS NULL;

-- Log how many were updated
DO $$
DECLARE
    updated_count INTEGER;
BEGIN
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Backfill: Linked % parent records to existing auth users', updated_count;
END $$;
