/**
 * useLessons Hook
 * Data fetching hooks for scheduled tutoring lessons in Love2Learn app
 *
 * Note: These hooks work with the 'scheduled_lessons' table for tutoring sessions,
 * which is distinct from the 'lessons' table that stores educational content.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  ScheduledLesson,
  ScheduledLessonWithStudent,
  CreateScheduledLessonInput,
  UpdateScheduledLessonInput,
  ListQueryState,
  QueryState,
} from '../types/database';

/**
 * Options for filtering lessons
 */
export interface LessonsFilterOptions {
  startDate?: string;
  endDate?: string;
  studentId?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
}

/**
 * Fetch lessons within a date range with optional filters
 * @param options - Filter options including date range and studentId
 * @returns List of lessons with student info, loading state, and error
 */
export function useLessons(options: LessonsFilterOptions = {}): ListQueryState<ScheduledLessonWithStudent> {
  const [data, setData] = useState<ScheduledLessonWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { startDate, endDate, studentId, status } = options;

  const fetchLessons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('scheduled_lessons')
        .select(`
          *,
          student:students(
            *,
            parent:parents(*)
          )
        `)
        .order('scheduled_at', { ascending: true });

      // Apply date range filter
      if (startDate) {
        query = query.gte('scheduled_at', startDate);
      }
      if (endDate) {
        query = query.lte('scheduled_at', endDate);
      }

      // Apply student filter
      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      // Apply status filter
      if (status) {
        query = query.eq('status', status);
      }

      const { data: lessons, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((lessons as ScheduledLessonWithStudent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch lessons');
      setError(errorMessage);
      console.error('useLessons error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, studentId, status]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  return { data, loading, error, refetch: fetchLessons };
}

/**
 * Fetch today's lessons
 * @returns List of today's lessons with student info
 */
export function useTodaysLessons(): ListQueryState<ScheduledLessonWithStudent> {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999).toISOString();

  return useLessons({ startDate: startOfDay, endDate: endOfDay });
}

/**
 * Fetch upcoming lessons (from now onwards)
 * @param limit - Maximum number of lessons to return
 * @returns List of upcoming lessons
 */
export function useUpcomingLessons(limit: number = 10): ListQueryState<ScheduledLessonWithStudent> {
  const [data, setData] = useState<ScheduledLessonWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLessons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString();

      const { data: lessons, error: fetchError } = await supabase
        .from('scheduled_lessons')
        .select(`
          *,
          student:students(
            *,
            parent:parents(*)
          )
        `)
        .gte('scheduled_at', now)
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true })
        .limit(limit);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((lessons as ScheduledLessonWithStudent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch upcoming lessons');
      setError(errorMessage);
      console.error('useUpcomingLessons error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  return { data, loading, error, refetch: fetchLessons };
}

/**
 * Fetch a single lesson by ID with student info
 * @param id - Lesson UUID
 * @returns Single lesson with student data, loading state, and error
 */
export function useLesson(id: string | null): QueryState<ScheduledLessonWithStudent> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<ScheduledLessonWithStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLesson = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: lesson, error: fetchError } = await supabase
        .from('scheduled_lessons')
        .select(`
          *,
          student:students(
            *,
            parent:parents(*)
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData(lesson as ScheduledLessonWithStudent);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch lesson');
      setError(errorMessage);
      console.error('useLesson error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchLesson();
  }, [fetchLesson]);

  return { data, loading, error, refetch: fetchLesson };
}

/**
 * Hook for creating a new scheduled lesson
 * Triggers a notification to the parent upon creation
 * @returns Mutation state with create function
 */
export function useCreateLesson() {
  const [data, setData] = useState<ScheduledLesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: CreateScheduledLessonInput): Promise<ScheduledLesson | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: lesson, error: createError } = await supabase
        .from('scheduled_lessons')
        .insert({
          ...input,
          status: 'scheduled',
        })
        .select()
        .single();

      if (createError) {
        throw new Error(createError.message);
      }

      // Trigger notification to parent
      // This calls a Supabase Edge Function that handles push notifications
      try {
        await supabase.functions.invoke('send-lesson-notification', {
          body: {
            lessonId: lesson.id,
            type: 'lesson_created',
          },
        });
      } catch (notificationError) {
        // Log but don't fail the mutation if notification fails
        console.warn('Failed to send notification:', notificationError);
      }

      setData(lesson);
      return lesson;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to create lesson');
      setError(errorMessage);
      console.error('useCreateLesson error:', errorMessage);
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
 * Hook for updating an existing lesson
 * @returns Mutation state with update function
 */
export function useUpdateLesson() {
  const [data, setData] = useState<ScheduledLesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string, input: UpdateScheduledLessonInput): Promise<ScheduledLesson | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: lesson, error: updateError } = await supabase
        .from('scheduled_lessons')
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

      // If the time was changed, notify the parent
      if (input.scheduled_at) {
        try {
          await supabase.functions.invoke('send-lesson-notification', {
            body: {
              lessonId: lesson.id,
              type: 'lesson_rescheduled',
            },
          });
        } catch (notificationError) {
          console.warn('Failed to send notification:', notificationError);
        }
      }

      setData(lesson);
      return lesson;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to update lesson');
      setError(errorMessage);
      console.error('useUpdateLesson error:', errorMessage);
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
 * Hook for cancelling a lesson
 * Sets status to 'cancelled' and notifies the parent
 * @returns Mutation state with cancel function
 */
export function useCancelLesson() {
  const [data, setData] = useState<ScheduledLesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string, reason?: string): Promise<ScheduledLesson | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: lesson, error: updateError } = await supabase
        .from('scheduled_lessons')
        .update({
          status: 'cancelled',
          notes: reason || 'Lesson cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Notify the parent about cancellation
      try {
        await supabase.functions.invoke('send-lesson-notification', {
          body: {
            lessonId: lesson.id,
            type: 'lesson_cancelled',
            reason,
          },
        });
      } catch (notificationError) {
        console.warn('Failed to send notification:', notificationError);
      }

      setData(lesson);
      return lesson;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to cancel lesson');
      setError(errorMessage);
      console.error('useCancelLesson error:', errorMessage);
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
 * Hook for marking a lesson as completed
 * @returns Mutation state with complete function
 */
export function useCompleteLesson() {
  const [data, setData] = useState<ScheduledLesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string, notes?: string): Promise<ScheduledLesson | null> => {
    try {
      setLoading(true);
      setError(null);

      const updateData: UpdateScheduledLessonInput = {
        status: 'completed',
        updated_at: new Date().toISOString(),
      };

      if (notes) {
        updateData.notes = notes;
      }

      const { data: lesson, error: updateError } = await supabase
        .from('scheduled_lessons')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      setData(lesson);
      return lesson;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to complete lesson');
      setError(errorMessage);
      console.error('useCompleteLesson error:', errorMessage);
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
 * Fetch lessons for a specific week
 * @param weekStart - Start date of the week (typically Monday)
 * @returns List of lessons for the week
 */
export function useWeekLessons(weekStart: Date): ListQueryState<ScheduledLessonWithStudent> {
  const startDate = new Date(weekStart);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return useLessons({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
}
