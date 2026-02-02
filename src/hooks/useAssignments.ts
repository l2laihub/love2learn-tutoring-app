/**
 * useAssignments Hook
 * Data fetching hooks for worksheet assignments in Love2Learn tutoring app
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Assignment,
  AssignmentWithStudent,
  CreateAssignmentInput,
  UpdateAssignmentInput,
  ListQueryState,
  QueryState,
  AssignmentStatus,
} from '../types/database';

/**
 * Options for filtering assignments
 */
export interface AssignmentsFilterOptions {
  studentId?: string;
  status?: AssignmentStatus;
  worksheetType?: 'piano_naming' | 'piano_drawing' | 'math';
}

/**
 * Fetch assignments with optional filters
 * @param options - Filter options including studentId and status
 * @returns List of assignments with student info
 */
export function useAssignments(options: AssignmentsFilterOptions = {}): ListQueryState<AssignmentWithStudent> {
  const [data, setData] = useState<AssignmentWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { studentId, status, worksheetType } = options;

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('assignments')
        .select(`
          *,
          student:students!student_id(*)
        `)
        .order('assigned_at', { ascending: false });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (worksheetType) {
        query = query.eq('worksheet_type', worksheetType);
      }

      const { data: assignments, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((assignments as AssignmentWithStudent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch assignments');
      setError(errorMessage);
      console.error('useAssignments error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [studentId, status, worksheetType]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return { data, loading, error, refetch: fetchAssignments };
}

/**
 * Fetch pending assignments (not yet completed)
 * @param studentId - Optional student ID filter
 * @returns List of pending assignments
 */
export function usePendingAssignments(studentId?: string): ListQueryState<AssignmentWithStudent> {
  return useAssignments({ studentId, status: 'assigned' });
}

/**
 * Fetch completed assignments
 * @param studentId - Optional student ID filter
 * @returns List of completed assignments
 */
export function useCompletedAssignments(studentId?: string): ListQueryState<AssignmentWithStudent> {
  return useAssignments({ studentId, status: 'completed' });
}

/**
 * Fetch assignments due soon (within the next 3 days)
 * @param studentId - Optional student ID filter
 * @returns List of assignments due soon
 */
export function useAssignmentsDueSoon(studentId?: string): ListQueryState<AssignmentWithStudent> {
  const [data, setData] = useState<AssignmentWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const threeDaysFromNow = new Date(now);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      let query = supabase
        .from('assignments')
        .select(`
          *,
          student:students!student_id(*)
        `)
        .eq('status', 'assigned')
        .not('due_date', 'is', null)
        .lte('due_date', threeDaysFromNow.toISOString().split('T')[0])
        .gte('due_date', now.toISOString().split('T')[0])
        .order('due_date', { ascending: true });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      const { data: assignments, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((assignments as AssignmentWithStudent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch assignments');
      setError(errorMessage);
      console.error('useAssignmentsDueSoon error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return { data, loading, error, refetch: fetchAssignments };
}

/**
 * Fetch a single assignment by ID
 * @param id - Assignment UUID
 * @returns Single assignment with student data
 */
export function useAssignment(id: string | null): QueryState<AssignmentWithStudent> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<AssignmentWithStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAssignment = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: assignment, error: fetchError } = await supabase
        .from('assignments')
        .select(`
          *,
          student:students!student_id(*)
        `)
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData(assignment as AssignmentWithStudent);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch assignment');
      setError(errorMessage);
      console.error('useAssignment error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchAssignment();
  }, [fetchAssignment]);

  return { data, loading, error, refetch: fetchAssignment };
}

/**
 * Hook for creating a new assignment
 * @returns Mutation state with create function
 */
export function useCreateAssignment() {
  const [data, setData] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: CreateAssignmentInput): Promise<Assignment | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: assignment, error: createError } = await supabase
        .from('assignments')
        .insert({
          ...input,
          status: 'assigned',
          assigned_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (createError) {
        throw new Error(createError.message);
      }

      // TODO: Notify parent about new assignment when Edge Function is deployed
      // try {
      //   await supabase.functions.invoke('send-assignment-notification', {
      //     body: {
      //       assignmentId: assignment.id,
      //       type: 'assignment_created',
      //     },
      //   });
      // } catch (notificationError) {
      //   console.warn('Failed to send notification:', notificationError);
      // }

      setData(assignment);
      return assignment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to create assignment');
      setError(errorMessage);
      console.error('useCreateAssignment error:', errorMessage);
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
 * Hook for updating an assignment
 * @returns Mutation state with update function
 */
export function useUpdateAssignment() {
  const [data, setData] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string, input: UpdateAssignmentInput): Promise<Assignment | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: assignment, error: updateError } = await supabase
        .from('assignments')
        .update(input)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      setData(assignment);
      return assignment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to update assignment');
      setError(errorMessage);
      console.error('useUpdateAssignment error:', errorMessage);
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
 * Hook for marking an assignment as completed
 * @returns Mutation state with complete function
 */
export function useCompleteAssignment() {
  const [data, setData] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string): Promise<Assignment | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: assignment, error: updateError } = await supabase
        .from('assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      // TODO: Notify tutor that assignment was completed when Edge Function is deployed
      // try {
      //   await supabase.functions.invoke('send-assignment-notification', {
      //     body: {
      //       assignmentId: assignment.id,
      //       type: 'assignment_completed',
      //     },
      //   });
      // } catch (notificationError) {
      //   console.warn('Failed to send notification:', notificationError);
      // }

      setData(assignment);
      return assignment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to complete assignment');
      setError(errorMessage);
      console.error('useCompleteAssignment error:', errorMessage);
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
 * Hook for deleting an assignment
 * @returns Mutation state with delete function
 */
export function useDeleteAssignment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const mutate = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const { error: deleteError } = await supabase
        .from('assignments')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setSuccess(true);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete assignment');
      setError(errorMessage);
      console.error('useDeleteAssignment error:', errorMessage);
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
 * Get assignment statistics for a student
 * @param studentId - Student UUID
 * @returns Assignment statistics
 */
export function useAssignmentStats(studentId: string | null) {
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    pending: 0,
    completionRate: 0,
    overdueCount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: assignments, error: fetchError } = await supabase
        .from('assignments')
        .select('status, due_date')
        .eq('student_id', studentId);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const now = new Date();
      const total = assignments?.length || 0;
      const completed = assignments?.filter((a) => a.status === 'completed').length || 0;
      const pending = total - completed;

      const overdueCount = assignments?.filter((a) => {
        if (a.status === 'completed' || !a.due_date) return false;
        return new Date(a.due_date) < now;
      }).length || 0;

      setStats({
        total,
        completed,
        pending,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
        overdueCount,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch assignment stats');
      setError(errorMessage);
      console.error('useAssignmentStats error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

/**
 * Fetch overdue assignments
 * @param studentId - Optional student ID filter
 * @returns List of overdue assignments
 */
export function useOverdueAssignments(studentId?: string): ListQueryState<AssignmentWithStudent> {
  const [data, setData] = useState<AssignmentWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString().split('T')[0];

      let query = supabase
        .from('assignments')
        .select(`
          *,
          student:students!student_id(*)
        `)
        .eq('status', 'assigned')
        .not('due_date', 'is', null)
        .lt('due_date', now)
        .order('due_date', { ascending: true });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      const { data: assignments, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((assignments as AssignmentWithStudent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch overdue assignments');
      setError(errorMessage);
      console.error('useOverdueAssignments error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  return { data, loading, error, refetch: fetchAssignments };
}
