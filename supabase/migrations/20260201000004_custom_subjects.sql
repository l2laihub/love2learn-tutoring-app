-- Migration: Add custom subjects support to tutor_settings
-- Version: 20260201000004
-- Description: Allows tutors to define their own custom subjects beyond the default enum values
--
-- Custom subjects are stored as a JSONB array with the following format:
-- [
--   { "id": "uuid", "name": "Guitar", "color": "#FF5722" },
--   { "id": "uuid", "name": "Science", "color": "#4CAF50" }
-- ]
--
-- This allows tutors to:
-- - Add subjects specific to their tutoring business
-- - Customize colors for visual consistency
-- - Reference custom subjects by ID in lessons

-- ============================================================================
-- ADD CUSTOM_SUBJECTS COLUMN TO TUTOR_SETTINGS
-- ============================================================================

ALTER TABLE tutor_settings
ADD COLUMN IF NOT EXISTS custom_subjects JSONB DEFAULT '[]'::jsonb;

-- Add descriptive comment explaining the format
COMMENT ON COLUMN tutor_settings.custom_subjects IS
'Custom subjects defined by the tutor. Format: [{"id": "uuid", "name": "Subject Name", "color": "#HEX"}]. Each subject must have a unique id (UUID), a name (string), and optionally a color (hex color string).';

-- ============================================================================
-- VALIDATION FUNCTION FOR CUSTOM SUBJECTS
-- ============================================================================

-- Function to validate custom_subjects JSONB structure
CREATE OR REPLACE FUNCTION validate_custom_subjects(subjects JSONB)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  subject JSONB;
BEGIN
  -- Empty array is valid
  IF subjects IS NULL OR subjects = '[]'::jsonb THEN
    RETURN TRUE;
  END IF;

  -- Must be an array
  IF jsonb_typeof(subjects) != 'array' THEN
    RETURN FALSE;
  END IF;

  -- Validate each subject in the array
  FOR subject IN SELECT * FROM jsonb_array_elements(subjects)
  LOOP
    -- Must be an object
    IF jsonb_typeof(subject) != 'object' THEN
      RETURN FALSE;
    END IF;

    -- Must have 'id' field (string)
    IF NOT (subject ? 'id') OR jsonb_typeof(subject->'id') != 'string' THEN
      RETURN FALSE;
    END IF;

    -- Must have 'name' field (string)
    IF NOT (subject ? 'name') OR jsonb_typeof(subject->'name') != 'string' THEN
      RETURN FALSE;
    END IF;

    -- If 'color' exists, must be a string
    IF (subject ? 'color') AND jsonb_typeof(subject->'color') != 'string' THEN
      RETURN FALSE;
    END IF;
  END LOOP;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION validate_custom_subjects(JSONB) IS
'Validates that custom_subjects JSONB array has the correct structure';

-- ============================================================================
-- ADD CHECK CONSTRAINT FOR CUSTOM_SUBJECTS
-- ============================================================================

-- Add constraint to validate the structure (if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'valid_custom_subjects'
  ) THEN
    ALTER TABLE tutor_settings
    ADD CONSTRAINT valid_custom_subjects
    CHECK (validate_custom_subjects(custom_subjects));
  END IF;
END $$;

-- ============================================================================
-- HELPER FUNCTIONS FOR CUSTOM SUBJECTS
-- ============================================================================

-- Function to add a custom subject
CREATE OR REPLACE FUNCTION add_custom_subject(
  p_tutor_user_id UUID,
  p_name TEXT,
  p_color TEXT DEFAULT '#808080'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_id UUID;
  v_current_subjects JSONB;
  v_new_subject JSONB;
BEGIN
  v_new_id := gen_random_uuid();

  -- Get current subjects
  SELECT COALESCE(custom_subjects, '[]'::jsonb)
  INTO v_current_subjects
  FROM tutor_settings
  WHERE tutor_id = p_tutor_user_id;

  -- If no settings exist, create them
  IF NOT FOUND THEN
    INSERT INTO tutor_settings (tutor_id, custom_subjects)
    VALUES (p_tutor_user_id, jsonb_build_array(
      jsonb_build_object('id', v_new_id::text, 'name', p_name, 'color', p_color)
    ))
    ON CONFLICT (tutor_id) DO UPDATE
    SET custom_subjects = jsonb_build_array(
      jsonb_build_object('id', v_new_id::text, 'name', p_name, 'color', p_color)
    );
    RETURN v_new_id;
  END IF;

  -- Build new subject object
  v_new_subject := jsonb_build_object(
    'id', v_new_id::text,
    'name', p_name,
    'color', p_color
  );

  -- Append to array
  UPDATE tutor_settings
  SET custom_subjects = v_current_subjects || v_new_subject
  WHERE tutor_id = p_tutor_user_id;

  RETURN v_new_id;
END;
$$;

COMMENT ON FUNCTION add_custom_subject(UUID, TEXT, TEXT) IS
'Adds a custom subject to a tutor settings. Returns the new subject ID.';

-- Function to remove a custom subject by ID
CREATE OR REPLACE FUNCTION remove_custom_subject(
  p_tutor_user_id UUID,
  p_subject_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_subjects JSONB;
  v_new_subjects JSONB;
BEGIN
  -- Get current subjects
  SELECT custom_subjects
  INTO v_current_subjects
  FROM tutor_settings
  WHERE tutor_id = p_tutor_user_id;

  IF NOT FOUND OR v_current_subjects IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Filter out the subject with matching ID
  SELECT jsonb_agg(elem)
  INTO v_new_subjects
  FROM jsonb_array_elements(v_current_subjects) AS elem
  WHERE (elem->>'id') != p_subject_id::text;

  -- Handle case where all subjects are removed
  IF v_new_subjects IS NULL THEN
    v_new_subjects := '[]'::jsonb;
  END IF;

  -- Update the settings
  UPDATE tutor_settings
  SET custom_subjects = v_new_subjects
  WHERE tutor_id = p_tutor_user_id;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION remove_custom_subject(UUID, UUID) IS
'Removes a custom subject from tutor settings by subject ID.';

-- Function to update a custom subject
CREATE OR REPLACE FUNCTION update_custom_subject(
  p_tutor_user_id UUID,
  p_subject_id UUID,
  p_name TEXT DEFAULT NULL,
  p_color TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_subjects JSONB;
  v_new_subjects JSONB;
BEGIN
  -- Get current subjects
  SELECT custom_subjects
  INTO v_current_subjects
  FROM tutor_settings
  WHERE tutor_id = p_tutor_user_id;

  IF NOT FOUND OR v_current_subjects IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Update the matching subject
  SELECT jsonb_agg(
    CASE
      WHEN (elem->>'id') = p_subject_id::text THEN
        jsonb_build_object(
          'id', elem->>'id',
          'name', COALESCE(p_name, elem->>'name'),
          'color', COALESCE(p_color, elem->>'color')
        )
      ELSE elem
    END
  )
  INTO v_new_subjects
  FROM jsonb_array_elements(v_current_subjects) AS elem;

  -- Update the settings
  UPDATE tutor_settings
  SET custom_subjects = v_new_subjects
  WHERE tutor_id = p_tutor_user_id;

  RETURN FOUND;
END;
$$;

COMMENT ON FUNCTION update_custom_subject(UUID, UUID, TEXT, TEXT) IS
'Updates name and/or color of a custom subject. Pass NULL to keep existing value.';

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION validate_custom_subjects(JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION add_custom_subject(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_custom_subject(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_custom_subject(UUID, UUID, TEXT, TEXT) TO authenticated;
