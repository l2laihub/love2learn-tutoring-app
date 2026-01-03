/**
 * useImportData Hook
 * Handles importing student and parent data from Google Sheets
 */

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface ImportRow {
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  studentName: string;
  studentAge: number;
  studentGrade: string;
  subjects: ('piano' | 'math')[];
}

export interface ImportResult {
  success: boolean;
  parentsCreated: number;
  studentsCreated: number;
  errors: string[];
  skipped: string[];
}

export interface ImportState {
  loading: boolean;
  parsing: boolean;
  error: string | null;
  preview: ImportRow[];
  result: ImportResult | null;
}

/**
 * Parse Google Sheets URL to get the spreadsheet ID and convert to CSV export URL
 */
function parseGoogleSheetsUrl(url: string): string | null {
  // Handle various Google Sheets URL formats:
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID/edit#gid=0
  // https://docs.google.com/spreadsheets/d/SPREADSHEET_ID

  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) return null;

  const spreadsheetId = match[1];
  // Convert to CSV export URL (first sheet)
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv`;
}

/**
 * Parse CSV content into ImportRow objects
 */
function parseCSV(csvContent: string): ImportRow[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return []; // Need header + at least one data row

  const rows: ImportRow[] = [];

  // Skip header row (index 0)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line (handle quoted values with commas)
    const values = parseCSVLine(line);

    if (values.length >= 5) {
      const parentName = values[0]?.trim() || '';
      const parentEmail = values[1]?.trim().toLowerCase() || '';
      const parentPhone = values[2]?.trim() || undefined;
      const studentName = values[3]?.trim() || '';
      const studentAge = parseInt(values[4]?.trim() || '0', 10);
      const studentGrade = values[5]?.trim() || 'K';
      const subjectsRaw = values[6]?.trim().toLowerCase() || 'both';

      // Parse subjects column - accepts: "piano", "math", "both", "piano, math", etc.
      const subjects: ('piano' | 'math')[] = [];
      if (subjectsRaw.includes('both') || (subjectsRaw.includes('piano') && subjectsRaw.includes('math'))) {
        subjects.push('piano', 'math');
      } else if (subjectsRaw.includes('piano')) {
        subjects.push('piano');
      } else if (subjectsRaw.includes('math')) {
        subjects.push('math');
      } else {
        // Default to both if unrecognized
        subjects.push('piano', 'math');
      }

      // Basic validation
      if (parentName && parentEmail && studentName && studentAge > 0) {
        rows.push({
          parentName,
          parentEmail,
          parentPhone,
          studentName,
          studentAge,
          studentGrade,
          subjects,
        });
      }
    }
  }

  return rows;
}

/**
 * Parse a single CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function useImportData() {
  const [state, setState] = useState<ImportState>({
    loading: false,
    parsing: false,
    error: null,
    preview: [],
    result: null,
  });

  /**
   * Fetch and parse Google Sheets data for preview
   */
  const fetchPreview = useCallback(async (sheetsUrl: string): Promise<ImportRow[]> => {
    setState(prev => ({ ...prev, parsing: true, error: null, preview: [] }));

    try {
      const csvUrl = parseGoogleSheetsUrl(sheetsUrl);
      if (!csvUrl) {
        throw new Error('Invalid Google Sheets URL. Please use a URL like: https://docs.google.com/spreadsheets/d/YOUR_ID/edit');
      }

      // Fetch CSV data
      const response = await fetch(csvUrl);
      if (!response.ok) {
        throw new Error('Failed to fetch spreadsheet. Make sure it is set to "Anyone with the link can view".');
      }

      const csvContent = await response.text();
      const rows = parseCSV(csvContent);

      if (rows.length === 0) {
        throw new Error('No valid data found. Expected columns: Parent Name, Parent Email, Parent Phone, Student Name, Student Age, Student Grade, Subjects');
      }

      setState(prev => ({ ...prev, parsing: false, preview: rows }));
      return rows;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to parse spreadsheet';
      setState(prev => ({ ...prev, parsing: false, error: message }));
      return [];
    }
  }, []);

  /**
   * Import the data into the database
   */
  const importData = useCallback(async (rows: ImportRow[]): Promise<ImportResult> => {
    setState(prev => ({ ...prev, loading: true, error: null, result: null }));

    const result: ImportResult = {
      success: false,
      parentsCreated: 0,
      studentsCreated: 0,
      errors: [],
      skipped: [],
    };

    try {
      // Group rows by parent email to avoid duplicate parent creation
      const parentMap = new Map<string, { parent: Partial<ImportRow>; students: ImportRow[] }>();

      for (const row of rows) {
        // Validate email
        if (!isValidEmail(row.parentEmail)) {
          result.errors.push(`Invalid email for ${row.parentName}: ${row.parentEmail}`);
          continue;
        }

        const existing = parentMap.get(row.parentEmail);
        if (existing) {
          existing.students.push(row);
        } else {
          parentMap.set(row.parentEmail, {
            parent: {
              parentName: row.parentName,
              parentEmail: row.parentEmail,
              parentPhone: row.parentPhone,
            },
            students: [row],
          });
        }
      }

      // Process each parent and their students
      for (const [email, { parent, students }] of parentMap) {
        try {
          // Check if parent already exists
          const { data: existingParent } = await supabase
            .from('parents')
            .select('id')
            .eq('email', email)
            .single();

          let parentId: string;

          if (existingParent) {
            parentId = existingParent.id;
            result.skipped.push(`Parent "${parent.parentName}" (${email}) already exists`);
          } else {
            // Create parent (without user_id - they haven't registered yet)
            // Use a placeholder UUID that will be updated when they register
            const { data: newParent, error: parentError } = await supabase
              .from('parents')
              .insert({
                name: parent.parentName,
                email: email,
                phone: parent.parentPhone || null,
                user_id: '00000000-0000-0000-0000-000000000000', // Placeholder
              })
              .select('id')
              .single();

            if (parentError) {
              result.errors.push(`Failed to create parent ${parent.parentName}: ${parentError.message}`);
              continue;
            }

            parentId = newParent.id;
            result.parentsCreated++;
          }

          // Create students for this parent
          for (const student of students) {
            // Check if student already exists for this parent
            const { data: existingStudent } = await supabase
              .from('students')
              .select('id')
              .eq('parent_id', parentId)
              .eq('name', student.studentName)
              .single();

            if (existingStudent) {
              result.skipped.push(`Student "${student.studentName}" already exists for ${parent.parentName}`);
              continue;
            }

            const { error: studentError } = await supabase
              .from('students')
              .insert({
                parent_id: parentId,
                name: student.studentName,
                age: student.studentAge,
                grade_level: student.studentGrade,
                subjects: student.subjects,
              });

            if (studentError) {
              result.errors.push(`Failed to create student ${student.studentName}: ${studentError.message}`);
            } else {
              result.studentsCreated++;
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Error processing ${parent.parentName}: ${message}`);
        }
      }

      result.success = result.errors.length === 0;
      setState(prev => ({ ...prev, loading: false, result }));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import data';
      setState(prev => ({ ...prev, loading: false, error: message }));
      result.errors.push(message);
      return result;
    }
  }, []);

  /**
   * Reset the import state
   */
  const reset = useCallback(() => {
    setState({
      loading: false,
      parsing: false,
      error: null,
      preview: [],
      result: null,
    });
  }, []);

  return {
    ...state,
    fetchPreview,
    importData,
    reset,
  };
}
