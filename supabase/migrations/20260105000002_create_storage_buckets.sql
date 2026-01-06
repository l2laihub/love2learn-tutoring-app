-- Migration: Create storage buckets for shared resources
-- Description: Creates worksheets and session-media storage buckets with proper policies

-- ============================================================================
-- CREATE STORAGE BUCKETS
-- ============================================================================

-- Create worksheets bucket for PDF files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'worksheets',
  'worksheets',
  true,  -- Public bucket for easy access
  26214400,  -- 25MB limit
  ARRAY['application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create session-media bucket for images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'session-media',
  'session-media',
  true,  -- Public bucket for easy access
  10485760,  -- 10MB limit
  ARRAY['image/png', 'image/jpeg', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================================
-- STORAGE POLICIES - WORKSHEETS BUCKET
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tutors can upload worksheets" ON storage.objects;
DROP POLICY IF EXISTS "Tutors can delete worksheets" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for worksheets" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read worksheets" ON storage.objects;

-- Allow tutors to upload files to worksheets bucket
CREATE POLICY "Tutors can upload worksheets"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'worksheets'
  AND EXISTS (
    SELECT 1 FROM parents
    WHERE parents.user_id = auth.uid()
    AND parents.role = 'tutor'
  )
);

-- Allow tutors to delete files from worksheets bucket
CREATE POLICY "Tutors can delete worksheets"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'worksheets'
  AND EXISTS (
    SELECT 1 FROM parents
    WHERE parents.user_id = auth.uid()
    AND parents.role = 'tutor'
  )
);

-- Allow public read access for worksheets (since bucket is public)
CREATE POLICY "Anyone can read worksheets"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'worksheets');

-- ============================================================================
-- STORAGE POLICIES - SESSION-MEDIA BUCKET
-- ============================================================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Tutors can upload session media" ON storage.objects;
DROP POLICY IF EXISTS "Tutors can delete session media" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for session media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read session media" ON storage.objects;

-- Allow tutors to upload files to session-media bucket
CREATE POLICY "Tutors can upload session media"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'session-media'
  AND EXISTS (
    SELECT 1 FROM parents
    WHERE parents.user_id = auth.uid()
    AND parents.role = 'tutor'
  )
);

-- Allow tutors to delete files from session-media bucket
CREATE POLICY "Tutors can delete session media"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'session-media'
  AND EXISTS (
    SELECT 1 FROM parents
    WHERE parents.user_id = auth.uid()
    AND parents.role = 'tutor'
  )
);

-- Allow public read access for session-media (since bucket is public)
CREATE POLICY "Anyone can read session media"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'session-media');

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON POLICY "Tutors can upload worksheets" ON storage.objects IS 'Allow tutors to upload PDF files to worksheets bucket';
COMMENT ON POLICY "Tutors can delete worksheets" ON storage.objects IS 'Allow tutors to delete files from worksheets bucket';
COMMENT ON POLICY "Anyone can read worksheets" ON storage.objects IS 'Public read access for worksheet PDFs';
COMMENT ON POLICY "Tutors can upload session media" ON storage.objects IS 'Allow tutors to upload images to session-media bucket';
COMMENT ON POLICY "Tutors can delete session media" ON storage.objects IS 'Allow tutors to delete files from session-media bucket';
COMMENT ON POLICY "Anyone can read session media" ON storage.objects IS 'Public read access for session media images';
