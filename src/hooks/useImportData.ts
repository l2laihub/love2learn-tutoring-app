/**
 * useImportData Hook
 * Handles importing student and parent data from Google Sheets
 */

import { useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// Direct API helper for import operations (bypasses Supabase client issues on web)
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

async function directSupabaseQuery<T>(
  endpoint: string,
  options: {
    method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    body?: any;
    params?: Record<string, string>;
    accessToken?: string;
  } = {}
): Promise<{ data: T | null; error: Error | null }> {
  const { method = 'GET', body, params, accessToken } = options;

  let url = `${SUPABASE_URL}/rest/v1/${endpoint}`;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  const headers: Record<string, string> = {
    'apikey': SUPABASE_KEY,
    'Content-Type': 'application/json',
    'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal',
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  } else {
    headers['Authorization'] = `Bearer ${SUPABASE_KEY}`;
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { data: null, error: new Error(errorData.message || `HTTP ${response.status}`) };
    }

    const data = await response.json().catch(() => null);
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err : new Error('Network error') };
  }
}

// Supported subjects for the tutoring app
export type Subject = 'piano' | 'math' | 'reading' | 'speech' | 'english';

export interface ImportRow {
  parentName: string;
  parentEmail: string;
  parentPhone?: string;
  studentName: string;
  studentAge: number;
  studentGrade: string;
  subjects: string[];
}

export interface ImportResult {
  success: boolean;
  parentsCreated: number;
  studentsCreated: number;
  errors: string[];
  skipped: string[];
}

export interface ImportProgress {
  current: number;
  total: number;
  currentItem: string;
}

export interface ImportState {
  loading: boolean;
  parsing: boolean;
  error: string | null;
  preview: ImportRow[];
  result: ImportResult | null;
  progress: ImportProgress | null;
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
      const subjectsRaw = values[6]?.trim().toLowerCase() || '';

      // Parse subjects column - supports multiple subjects
      // Handles formats like: "Piano", "Math", "Piano & Reading", "Speech", "English", etc.
      const subjects: string[] = [];

      // Check for each known subject
      if (subjectsRaw.includes('piano')) subjects.push('piano');
      if (subjectsRaw.includes('math')) subjects.push('math');
      if (subjectsRaw.includes('reading')) subjects.push('reading');
      if (subjectsRaw.includes('speech')) subjects.push('speech');
      if (subjectsRaw.includes('english')) subjects.push('english');

      // Handle "both" as piano + math for backwards compatibility
      if (subjectsRaw === 'both') {
        subjects.length = 0; // Clear
        subjects.push('piano', 'math');
      }

      // If no recognized subjects, use the raw value as-is (trimmed and lowercased)
      if (subjects.length === 0 && subjectsRaw) {
        subjects.push(subjectsRaw);
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
      } else {
        console.warn(`[CSV] Skipped row ${i + 1}: missing required fields`, {
          parentName: parentName || '(empty)',
          parentEmail: parentEmail || '(empty)',
          studentName: studentName || '(empty)',
          studentAge,
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
    progress: null,
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
    console.log(`[Import] Starting import of ${rows.length} rows`);
    setState(prev => ({ ...prev, loading: true, error: null, result: null, progress: null }));

    const result: ImportResult = {
      success: false,
      parentsCreated: 0,
      studentsCreated: 0,
      errors: [],
      skipped: [],
    };

    try {
      // Get access token - try multiple methods
      console.log(`[Import] Getting access token...`);
      let accessToken: string | null = null;

      // Method 1: Try to get from Supabase client (with timeout)
      try {
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
        ]) as { data: { session: any }, error: any };
        accessToken = sessionResult.data?.session?.access_token;
        if (accessToken) {
          console.log(`[Import] Got token from Supabase client`);
        }
      } catch (err) {
        console.log(`[Import] Supabase client timeout, trying localStorage...`);
      }

      // Method 2: Try localStorage directly (web fallback)
      if (!accessToken && typeof localStorage !== 'undefined') {
        try {
          // Supabase stores session with key pattern: sb-{project-ref}-auth-token
          const storageKey = Object.keys(localStorage).find(key =>
            key.includes('supabase') && key.includes('auth')
          ) || `sb-${SUPABASE_URL.split('//')[1]?.split('.')[0]}-auth-token`;

          const storedSession = localStorage.getItem(storageKey);
          if (storedSession) {
            const parsed = JSON.parse(storedSession);
            accessToken = parsed.access_token || parsed.currentSession?.access_token;
            if (accessToken) {
              console.log(`[Import] Got token from localStorage`);
            }
          }
        } catch (err) {
          console.log(`[Import] localStorage parse failed:`, err);
        }
      }

      if (!accessToken) {
        throw new Error('Not authenticated. Please log out and log back in, then try again.');
      }

      console.log(`[Import] Access token obtained: ${accessToken.substring(0, 20)}...`);

      console.log(`[Import] Grouping rows by parent...`);

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
      const totalParents = parentMap.size;
      let currentIndex = 0;

      for (const [email, { parent, students }] of parentMap) {
        try {
          currentIndex++;
          console.log(`[Import] Processing parent ${currentIndex}/${totalParents}: ${email}`);

          // Update progress
          setState(prev => ({
            ...prev,
            progress: {
              current: currentIndex,
              total: totalParents,
              currentItem: parent.parentName || email,
            },
          }));

          // Check if parent already exists using direct API
          const { data: existingParents, error: selectError } = await directSupabaseQuery<{ id: string }[]>(
            'parents',
            {
              method: 'GET',
              params: {
                select: 'id',
                email: `eq.${email}`,
                limit: '1',
              },
              accessToken,
            }
          );

          if (selectError) {
            console.error(`[Import] Error checking parent ${email}:`, selectError);
            result.errors.push(`Failed to check parent ${parent.parentName}: ${selectError.message}`);
            continue;
          }

          let parentId: string;
          const existingParent = existingParents?.[0];

          if (existingParent) {
            parentId = existingParent.id;
            result.skipped.push(`Parent "${parent.parentName}" (${email}) already exists`);
            console.log(`[Import] Parent exists: ${parentId}`);
          } else {
            // Create parent without user_id - they haven't registered yet
            const parentName = parent.parentName || '';
            console.log(`[Import] Creating new parent: ${parentName}`);

            const { data: newParentData, error: parentError } = await directSupabaseQuery<{ id: string }[]>(
              'parents',
              {
                method: 'POST',
                body: {
                  name: parentName,
                  email: email,
                  phone: parent.parentPhone || null,
                },
                params: { select: 'id' },
                accessToken,
              }
            );

            if (parentError || !newParentData?.[0]) {
              console.error(`[Import] Error creating parent:`, parentError);
              result.errors.push(`Failed to create parent ${parent.parentName}: ${parentError?.message || 'No data returned'}`);
              continue;
            }

            parentId = newParentData[0].id;
            result.parentsCreated++;
            console.log(`[Import] Created parent: ${parentId}`);
          }

          // Create students for this parent
          for (const student of students) {
            console.log(`[Import] Processing student: ${student.studentName}`);

            // Check if student already exists for this parent using direct API
            const { data: existingStudents, error: studentSelectError } = await directSupabaseQuery<{ id: string }[]>(
              'students',
              {
                method: 'GET',
                params: {
                  select: 'id',
                  parent_id: `eq.${parentId}`,
                  name: `eq.${student.studentName}`,
                  limit: '1',
                },
                accessToken,
              }
            );

            if (studentSelectError) {
              console.error(`[Import] Error checking student:`, studentSelectError);
              result.errors.push(`Failed to check student ${student.studentName}: ${studentSelectError.message}`);
              continue;
            }

            if (existingStudents?.[0]) {
              result.skipped.push(`Student "${student.studentName}" already exists for ${parent.parentName}`);
              console.log(`[Import] Student exists: ${existingStudents[0].id}`);
              continue;
            }

            console.log(`[Import] Creating student: ${student.studentName}`);
            const { error: studentError } = await directSupabaseQuery(
              'students',
              {
                method: 'POST',
                body: {
                  parent_id: parentId,
                  name: student.studentName,
                  age: student.studentAge,
                  grade_level: student.studentGrade,
                  subjects: student.subjects,
                },
                accessToken,
              }
            );

            if (studentError) {
              console.error(`[Import] Error creating student:`, studentError);
              result.errors.push(`Failed to create student ${student.studentName}: ${studentError.message}`);
            } else {
              result.studentsCreated++;
              console.log(`[Import] Created student: ${student.studentName}`);
            }
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown error';
          result.errors.push(`Error processing ${parent.parentName}: ${message}`);
        }
      }

      result.success = result.errors.length === 0;
      console.log(`[Import] Complete:`, result);
      setState(prev => ({ ...prev, loading: false, result, progress: null }));
      return result;
    } catch (error) {
      console.error(`[Import] Fatal error:`, error);
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
      progress: null,
    });
  }, []);

  return {
    ...state,
    fetchPreview,
    importData,
    reset,
  };
}
