-- Migration: Create shared_resources table and storage buckets
-- Description: Enable tutors to share worksheets, PDFs, images, and YouTube videos with parents

-- ============================================================================
-- SHARED RESOURCES TABLE
-- ============================================================================

-- Create resource type enum
CREATE TYPE resource_type AS ENUM ('worksheet', 'pdf', 'image', 'video');

-- Create shared_resources table
CREATE TABLE shared_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,
  tutor_id UUID NOT NULL REFERENCES parents(id) ON DELETE CASCADE,

  -- Resource type
  resource_type resource_type NOT NULL,

  -- Content fields
  title TEXT NOT NULL,
  description TEXT,

  -- Storage (for files uploaded to Supabase Storage)
  storage_path TEXT,

  -- External URLs (for YouTube videos or other external links)
  external_url TEXT,

  -- Thumbnail for preview
  thumbnail_url TEXT,

  -- File metadata
  file_size INTEGER,
  mime_type TEXT,

  -- Optional link to assignment (for worksheets)
  assignment_id UUID REFERENCES assignments(id) ON DELETE SET NULL,

  -- Optional link to scheduled lesson (for session media)
  lesson_id UUID REFERENCES scheduled_lessons(id) ON DELETE SET NULL,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  viewed_at TIMESTAMPTZ,

  -- Visibility control
  is_visible_to_parent BOOLEAN DEFAULT true NOT NULL,

  -- Constraints
  CONSTRAINT valid_resource_source CHECK (
    (storage_path IS NOT NULL) OR (external_url IS NOT NULL)
  )
);

-- Add indexes for common queries
CREATE INDEX idx_shared_resources_student_id ON shared_resources(student_id);
CREATE INDEX idx_shared_resources_parent_id ON shared_resources(parent_id);
CREATE INDEX idx_shared_resources_tutor_id ON shared_resources(tutor_id);
CREATE INDEX idx_shared_resources_type ON shared_resources(resource_type);
CREATE INDEX idx_shared_resources_created_at ON shared_resources(created_at DESC);
CREATE INDEX idx_shared_resources_assignment_id ON shared_resources(assignment_id) WHERE assignment_id IS NOT NULL;
CREATE INDEX idx_shared_resources_lesson_id ON shared_resources(lesson_id) WHERE lesson_id IS NOT NULL;

-- ============================================================================
-- UPDATE ASSIGNMENTS TABLE
-- ============================================================================

-- Add storage_path column to assignments for cloud storage
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS storage_path TEXT;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on shared_resources
ALTER TABLE shared_resources ENABLE ROW LEVEL SECURITY;

-- Tutors can do everything with shared resources
CREATE POLICY "Tutors can manage all shared resources"
  ON shared_resources
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parents
      WHERE parents.user_id = auth.uid()
      AND parents.role = 'tutor'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM parents
      WHERE parents.user_id = auth.uid()
      AND parents.role = 'tutor'
    )
  );

-- Parents can view resources shared with them
CREATE POLICY "Parents can view their shared resources"
  ON shared_resources
  FOR SELECT
  TO authenticated
  USING (
    is_visible_to_parent = true
    AND EXISTS (
      SELECT 1 FROM parents
      WHERE parents.user_id = auth.uid()
      AND parents.id = shared_resources.parent_id
    )
  );

-- Parents can update viewed_at timestamp
CREATE POLICY "Parents can mark resources as viewed"
  ON shared_resources
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM parents
      WHERE parents.user_id = auth.uid()
      AND parents.id = shared_resources.parent_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM parents
      WHERE parents.user_id = auth.uid()
      AND parents.id = shared_resources.parent_id
    )
  );

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Note: Storage buckets need to be created via Supabase Dashboard or CLI
-- The following are the bucket configurations:

-- Bucket: worksheets
-- - Public: false
-- - File size limit: 25MB
-- - Allowed MIME types: application/pdf

-- Bucket: session-media
-- - Public: false
-- - File size limit: 10MB
-- - Allowed MIME types: image/png, image/jpeg, image/gif, image/webp

-- Storage policies will be created separately in Supabase Dashboard:
-- 1. Tutors can upload/delete files in both buckets
-- 2. Parents can read files that are linked to their shared_resources

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get unviewed resource count for a parent
CREATE OR REPLACE FUNCTION get_unviewed_resource_count(p_parent_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM shared_resources
    WHERE parent_id = p_parent_id
      AND is_visible_to_parent = true
      AND viewed_at IS NULL
  );
END;
$$;

-- Function to mark resource as viewed
CREATE OR REPLACE FUNCTION mark_resource_viewed(p_resource_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE shared_resources
  SET viewed_at = NOW()
  WHERE id = p_resource_id
    AND viewed_at IS NULL;

  RETURN FOUND;
END;
$$;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE shared_resources IS 'Resources shared by tutors with parents (worksheets, PDFs, images, videos)';
COMMENT ON COLUMN shared_resources.resource_type IS 'Type of resource: worksheet (generated), pdf (uploaded), image, or video (YouTube)';
COMMENT ON COLUMN shared_resources.storage_path IS 'Path in Supabase Storage for uploaded files';
COMMENT ON COLUMN shared_resources.external_url IS 'URL for external resources like YouTube videos';
COMMENT ON COLUMN shared_resources.thumbnail_url IS 'Preview thumbnail URL';
COMMENT ON COLUMN shared_resources.viewed_at IS 'Timestamp when parent first viewed the resource';
COMMENT ON COLUMN shared_resources.is_visible_to_parent IS 'Whether the resource is visible to the parent';
