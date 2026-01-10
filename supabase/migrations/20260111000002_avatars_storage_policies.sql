-- Migration: Create avatars storage bucket and policies
-- Description: Creates storage bucket and RLS policies for avatar uploads
--
-- ⚠️ IMPORTANT: This script MUST be run via Supabase Dashboard SQL Editor
-- It cannot be run via session pooler due to storage.objects ownership requirements
--
-- To run:
-- 1. Go to Supabase Dashboard > SQL Editor
-- 2. Paste this entire script
-- 3. Click "Run"

-- ============================================================================
-- CREATE AVATARS STORAGE BUCKET
-- ============================================================================

-- Create avatars bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,  -- Public bucket for easy access
  5242880,  -- 5MB limit (profile photos should be small)
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- STORAGE POLICIES - AVATARS BUCKET
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read avatars" ON storage.objects;
DROP POLICY IF EXISTS "Parents can upload child avatars" ON storage.objects;
DROP POLICY IF EXISTS "Tutors can manage all avatars" ON storage.objects;

-- Allow authenticated users to upload avatars
-- Path structure: avatars/parents/{parentId}/{filename} or avatars/students/{studentId}/{filename}
CREATE POLICY "Users can upload their own avatar"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (
    -- Parents can upload their own avatar (path: parents/{parentId}/...)
    (
      (storage.foldername(storage.objects.name))[1] = 'parents'
      AND EXISTS (
        SELECT 1 FROM public.parents p
        WHERE p.user_id = auth.uid()
        AND p.id::text = (storage.foldername(storage.objects.name))[2]
      )
    )
    OR
    -- Parents can upload their children's avatars (path: students/{studentId}/...)
    (
      (storage.foldername(storage.objects.name))[1] = 'students'
      AND EXISTS (
        SELECT 1 FROM public.students s
        INNER JOIN public.parents p ON s.parent_id = p.id
        WHERE p.user_id = auth.uid()
        AND s.id::text = (storage.foldername(storage.objects.name))[2]
      )
    )
    OR
    -- Tutors can upload any avatar
    EXISTS (
      SELECT 1 FROM public.parents p
      WHERE p.user_id = auth.uid()
      AND p.role = 'tutor'
    )
  )
);

-- Allow users to update/overwrite their avatars
CREATE POLICY "Users can update their own avatar"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    -- Parents can update their own avatar
    (
      (storage.foldername(storage.objects.name))[1] = 'parents'
      AND EXISTS (
        SELECT 1 FROM public.parents p
        WHERE p.user_id = auth.uid()
        AND p.id::text = (storage.foldername(storage.objects.name))[2]
      )
    )
    OR
    -- Parents can update their children's avatars
    (
      (storage.foldername(storage.objects.name))[1] = 'students'
      AND EXISTS (
        SELECT 1 FROM public.students s
        INNER JOIN public.parents p ON s.parent_id = p.id
        WHERE p.user_id = auth.uid()
        AND s.id::text = (storage.foldername(storage.objects.name))[2]
      )
    )
    OR
    -- Tutors can update any avatar
    EXISTS (
      SELECT 1 FROM public.parents p
      WHERE p.user_id = auth.uid()
      AND p.role = 'tutor'
    )
  )
);

-- Allow users to delete their avatars
CREATE POLICY "Users can delete their own avatar"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars'
  AND (
    -- Parents can delete their own avatar
    (
      (storage.foldername(storage.objects.name))[1] = 'parents'
      AND EXISTS (
        SELECT 1 FROM public.parents p
        WHERE p.user_id = auth.uid()
        AND p.id::text = (storage.foldername(storage.objects.name))[2]
      )
    )
    OR
    -- Parents can delete their children's avatars
    (
      (storage.foldername(storage.objects.name))[1] = 'students'
      AND EXISTS (
        SELECT 1 FROM public.students s
        INNER JOIN public.parents p ON s.parent_id = p.id
        WHERE p.user_id = auth.uid()
        AND s.id::text = (storage.foldername(storage.objects.name))[2]
      )
    )
    OR
    -- Tutors can delete any avatar
    EXISTS (
      SELECT 1 FROM public.parents p
      WHERE p.user_id = auth.uid()
      AND p.role = 'tutor'
    )
  )
);

-- Allow public read access for avatars (since bucket is public)
CREATE POLICY "Anyone can read avatars"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'avatars');
