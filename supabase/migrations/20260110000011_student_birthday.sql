-- Migration: Add birthday field to students table
-- Version: 20260110000001
-- Description: Adds a birthday field to students table to allow auto-calculation of age and grade level

-- Add birthday column to students table
ALTER TABLE students ADD COLUMN IF NOT EXISTS birthday DATE;

-- Add helpful comment
COMMENT ON COLUMN students.birthday IS 'Student birthday for automatic age calculation';

-- Create a function to calculate age from birthday
CREATE OR REPLACE FUNCTION calculate_age_from_birthday(birth_date DATE)
RETURNS INTEGER AS $$
BEGIN
    IF birth_date IS NULL THEN
        RETURN NULL;
    END IF;
    RETURN EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date))::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create a function to suggest grade level based on birthday
-- Uses common US school cutoff (September 1st) and standard age-to-grade mapping
CREATE OR REPLACE FUNCTION suggest_grade_from_birthday(birth_date DATE)
RETURNS TEXT AS $$
DECLARE
    student_age INTEGER;
    school_year_start DATE;
    age_at_school_start INTEGER;
BEGIN
    IF birth_date IS NULL THEN
        RETURN NULL;
    END IF;

    -- Calculate current age
    student_age := EXTRACT(YEAR FROM AGE(CURRENT_DATE, birth_date))::INTEGER;

    -- Determine school year start date (September 1st of current or previous year)
    IF EXTRACT(MONTH FROM CURRENT_DATE) >= 9 THEN
        school_year_start := DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '8 months'; -- Sept 1 of current year
    ELSE
        school_year_start := DATE_TRUNC('year', CURRENT_DATE) - INTERVAL '4 months'; -- Sept 1 of previous year
    END IF;

    -- Calculate age at school year start
    age_at_school_start := EXTRACT(YEAR FROM AGE(school_year_start, birth_date))::INTEGER;

    -- Map age to grade level using US standard (age 5-6 for Kindergarten)
    CASE age_at_school_start
        WHEN 3 THEN RETURN 'Preschool';
        WHEN 4 THEN RETURN 'Preschool';
        WHEN 5 THEN RETURN 'K';
        WHEN 6 THEN RETURN '1st';
        WHEN 7 THEN RETURN '2nd';
        WHEN 8 THEN RETURN '3rd';
        WHEN 9 THEN RETURN '4th';
        WHEN 10 THEN RETURN '5th';
        WHEN 11 THEN RETURN '6th';
        WHEN 12 THEN RETURN '7th';
        WHEN 13 THEN RETURN '8th';
        WHEN 14 THEN RETURN '9th';
        WHEN 15 THEN RETURN '10th';
        WHEN 16 THEN RETURN '11th';
        WHEN 17 THEN RETURN '12th';
        ELSE
            IF age_at_school_start < 3 THEN
                RETURN 'Preschool';
            ELSE
                RETURN '12th';
            END IF;
    END CASE;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION calculate_age_from_birthday(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION suggest_grade_from_birthday(DATE) TO authenticated;
