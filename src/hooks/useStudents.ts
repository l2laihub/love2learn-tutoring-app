/**
 * useStudents Hook
 * Data fetching hooks for student management in Love2Learn tutoring app
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Student,
  StudentWithParent,
  CreateStudentInput,
  UpdateStudentInput,
  ListQueryState,
  QueryState,
} from '../types/database';

/**
 * Fetch all students with their parent information
 * @returns List of students with parent data, loading state, and error
 */
export function useStudents(): ListQueryState<StudentWithParent> {
  const [data, setData] = useState<StudentWithParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStudents = useCallback(async () => {
    console.log('[useStudents] fetchStudents called');
    try {
      setLoading(true);
      setError(null);

      console.log('[useStudents] Executing query...');

      // Add timeout to detect hanging queries
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Students query timeout after 10s')), 10000);
      });

      const queryPromise = supabase
        .from('students')
        .select(`
          *,
          parent:parents!parent_id(*)
        `)
        .order('name', { ascending: true });

      const { data: students, error: fetchError } = await Promise.race([queryPromise, timeoutPromise]) as Awaited<typeof queryPromise>;

      console.log('[useStudents] Query result:', { count: students?.length, error: fetchError?.message });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((students as StudentWithParent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch students');
      setError(errorMessage);
      console.error('[useStudents] Error:', errorMessage);
    } finally {
      setLoading(false);
      console.log('[useStudents] Done');
    }
  }, []);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return { data, loading, error, refetch: fetchStudents };
}

/**
 * Fetch a single student by ID with parent information
 * @param id - Student UUID
 * @returns Single student with parent data, loading state, and error
 */
export function useStudent(id: string | null): QueryState<StudentWithParent> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<StudentWithParent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStudent = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: student, error: fetchError } = await supabase
        .from('students')
        .select(`
          *,
          parent:parents!parent_id(*)
        `)
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData(student as StudentWithParent);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch student');
      setError(errorMessage);
      console.error('useStudent error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchStudent();
  }, [fetchStudent]);

  return { data, loading, error, refetch: fetchStudent };
}

/**
 * Hook for creating a new student
 * @returns Mutation state with create function
 */
export function useCreateStudent() {
  const [data, setData] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: CreateStudentInput): Promise<Student | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: student, error: createError } = await supabase
        .from('students')
        .insert(input)
        .select()
        .single();

      if (createError) {
        throw new Error(createError.message);
      }

      setData(student);
      return student;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to create student');
      setError(errorMessage);
      console.error('useCreateStudent error:', errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, mutate, reset };
}

/**
 * Hook for updating an existing student
 * @returns Mutation state with update function
 */
export function useUpdateStudent() {
  const [data, setData] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string, input: UpdateStudentInput): Promise<Student | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: student, error: updateError } = await supabase
        .from('students')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      setData(student);
      return student;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to update student');
      setError(errorMessage);
      console.error('useUpdateStudent error:', errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, mutate, reset };
}

/**
 * Hook for deleting a student
 * @returns Mutation state with delete function
 */
export function useDeleteStudent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const mutate = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const { error: deleteError } = await supabase
        .from('students')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setSuccess(true);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete student');
      setError(errorMessage);
      console.error('useDeleteStudent error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
    setSuccess(false);
  }, []);

  return { loading, error, success, mutate, reset };
}

/**
 * Fetch students by parent ID
 * @param parentId - Parent UUID
 * @returns List of students for the specified parent
 */
export function useStudentsByParent(parentId: string | null): ListQueryState<Student> {
  const [data, setData] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStudents = useCallback(async () => {
    if (!parentId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: students, error: fetchError } = await supabase
        .from('students')
        .select('*')
        .eq('parent_id', parentId)
        .order('name', { ascending: true });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData(students || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch students');
      setError(errorMessage);
      console.error('useStudentsByParent error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    fetchStudents();
  }, [fetchStudents]);

  return { data, loading, error, refetch: fetchStudents };
}
