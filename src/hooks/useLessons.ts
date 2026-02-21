/**
 * useLessons Hook
 * Data fetching hooks for scheduled tutoring lessons in Love2Learn app
 *
 * Note: These hooks work with the 'scheduled_lessons' table for tutoring sessions,
 * which is distinct from the 'lessons' table that stores educational content.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  ScheduledLesson,
  ScheduledLessonWithStudent,
  CreateScheduledLessonInput,
  UpdateScheduledLessonInput,
  ListQueryState,
  QueryState,
  LessonSession,
  CreateLessonSessionInput,
  GroupedLesson,
  TutoringSubject,
  TutoringLessonStatus,
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
          student:students!student_id(
            *,
            parent:parents!parent_id(*)
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
          student:students!student_id(
            *,
            parent:parents!parent_id(*)
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
 * Fetch upcoming lessons grouped by session (for home page display)
 * @param limit - Maximum number of grouped lessons to return
 * @returns List of upcoming grouped lessons
 */
export function useUpcomingGroupedLessons(limit: number = 10): ListQueryState<GroupedLesson> {
  const [data, setData] = useState<GroupedLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLessons = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date().toISOString();

      // Fetch more lessons than limit to account for grouping
      const { data: lessons, error: fetchError } = await supabase
        .from('scheduled_lessons')
        .select(`
          *,
          student:students!student_id(
            *,
            parent:parents!parent_id(*)
          )
        `)
        .gte('scheduled_at', now)
        .eq('status', 'scheduled')
        .order('scheduled_at', { ascending: true })
        .limit(limit * 3); // Fetch more to account for grouping

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Group the lessons by session
      const grouped = groupLessonsBySession((lessons as ScheduledLessonWithStudent[]) || []);

      // Limit to requested number of groups
      setData(grouped.slice(0, limit));
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch upcoming lessons');
      setError(errorMessage);
      console.error('useUpcomingGroupedLessons error:', errorMessage);
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
          student:students!student_id(
            *,
            parent:parents!parent_id(*)
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

      // TODO: Trigger notification to parent when Edge Function is deployed
      // The 'send-lesson-notification' Edge Function needs to be created in Supabase
      // Once deployed, uncomment the following code:
      // try {
      //   await supabase.functions.invoke('send-lesson-notification', {
      //     body: {
      //       lessonId: lesson.id,
      //       type: 'lesson_created',
      //     },
      //   });
      // } catch (notificationError) {
      //   console.warn('Failed to send notification:', notificationError);
      // }

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

      // TODO: Notify parent when Edge Function is deployed
      // if (input.scheduled_at) {
      //   try {
      //     await supabase.functions.invoke('send-lesson-notification', {
      //       body: {
      //         lessonId: lesson.id,
      //         type: 'lesson_rescheduled',
      //       },
      //     });
      //   } catch (notificationError) {
      //     console.warn('Failed to send notification:', notificationError);
      //   }
      // }

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
 * Hook for updating all lessons in a series
 * Updates the time for each lesson while keeping the same day
 * @returns Mutation state with update function
 */
export function useUpdateLessonSeries() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Update a series of lessons with new time/duration
   * @param lessonIds - Array of lesson IDs to update
   * @param updates - The updates to apply (time, duration, notes)
   * @param originalScheduledAt - The original scheduled_at of the clicked lesson (for time offset calculation)
   */
  const mutate = useCallback(async (
    lessonIds: string[],
    updates: {
      newTime?: string; // New time in HH:MM format
      duration_min?: number;
      notes?: string;
    },
    originalScheduledAt?: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // First, fetch all lessons to get their current scheduled_at
      const { data: lessons, error: fetchError } = await supabase
        .from('scheduled_lessons')
        .select('id, scheduled_at, duration_min')
        .in('id', lessonIds);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!lessons || lessons.length === 0) {
        throw new Error('No lessons found');
      }

      // Update each lesson
      for (const lesson of lessons) {
        const updateData: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        // If new time is provided, update scheduled_at while keeping the same date
        if (updates.newTime) {
          const currentDate = new Date(lesson.scheduled_at);
          const [hours, minutes] = updates.newTime.split(':').map(Number);
          currentDate.setHours(hours, minutes, 0, 0);
          updateData.scheduled_at = currentDate.toISOString();
        }

        // Update duration if provided
        if (updates.duration_min !== undefined) {
          updateData.duration_min = updates.duration_min;
        }

        // Update notes if provided
        if (updates.notes !== undefined) {
          updateData.notes = updates.notes;
        }

        const { error: updateError } = await supabase
          .from('scheduled_lessons')
          .update(updateData)
          .eq('id', lesson.id);

        if (updateError) {
          throw new Error(`Failed to update lesson ${lesson.id}: ${updateError.message}`);
        }
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to update lesson series');
      setError(errorMessage);
      console.error('useUpdateLessonSeries error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { loading, error, mutate, reset };
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

      // Clean up payment_lessons link if this lesson was already invoiced
      const { data: paymentLessonLinks } = await supabase
        .from('payment_lessons')
        .select('id, payment_id, amount')
        .eq('lesson_id', id);

      if (paymentLessonLinks && paymentLessonLinks.length > 0) {
        for (const pl of paymentLessonLinks) {
          // Remove the payment_lessons record
          await supabase
            .from('payment_lessons')
            .delete()
            .eq('id', pl.id);

          // Reduce the payment's amount_due
          const { data: payment } = await supabase
            .from('payments')
            .select('id, amount_due, amount_paid')
            .eq('id', pl.payment_id)
            .single();

          if (payment) {
            const newAmountDue = Math.max(0, Math.round((payment.amount_due - pl.amount) * 100) / 100);
            const newStatus = newAmountDue <= payment.amount_paid ? 'paid' : 'unpaid';
            await supabase
              .from('payments')
              .update({
                amount_due: newAmountDue,
                status: newStatus,
              })
              .eq('id', payment.id);
          }
        }
      }

      // TODO: Notify parent about cancellation when Edge Function is deployed
      // try {
      //   await supabase.functions.invoke('send-lesson-notification', {
      //     body: {
      //       lessonId: lesson.id,
      //       type: 'lesson_cancelled',
      //       reason,
      //     },
      //   });
      // } catch (notificationError) {
      //   console.warn('Failed to send notification:', notificationError);
      // }

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

      // Update prepaid session usage if applicable
      // First get the lesson details to find the parent and subject
      const { data: lessonDetails } = await supabase
        .from('scheduled_lessons')
        .select('scheduled_at, subject, student:students!student_id(parent_id)')
        .eq('id', id)
        .single();

      if (lessonDetails?.student?.parent_id) {
        const parentId = lessonDetails.student.parent_id;
        const lessonDate = new Date(lessonDetails.scheduled_at);
        const lessonSubject = lessonDetails.subject;
        const monthStart = new Date(lessonDate.getFullYear(), lessonDate.getMonth(), 1)
          .toISOString().split('T')[0];

        // Fetch parent's prepaid_subjects to determine billing mode
        const { data: parentRecord } = await supabase
          .from('parents')
          .select('prepaid_subjects')
          .eq('id', parentId)
          .single();
        const prepaidSubjects: string[] = ((parentRecord?.prepaid_subjects as string[]) || [])
          .map((s: string) => s.toLowerCase());

        // Try subject-specific prepaid payment first
        const { data: subjectPrepaid } = await supabase
          .from('payments')
          .select('id, sessions_used')
          .eq('parent_id', parentId)
          .eq('month', monthStart)
          .eq('payment_type', 'prepaid')
          .eq('subject', lessonSubject)
          .maybeSingle();

        let prepaidPayment = subjectPrepaid;

        if (!prepaidPayment && prepaidSubjects.length === 0) {
          // Only fall back to legacy all-subjects prepaid when no per-subject config exists.
          // If prepaid_subjects is non-empty, the family is in hybrid mode and
          // subjects NOT in the list should be invoiced, not counted against legacy prepaid.
          const { data: legacyPrepaid } = await supabase
            .from('payments')
            .select('id, sessions_used')
            .eq('parent_id', parentId)
            .eq('month', monthStart)
            .eq('payment_type', 'prepaid')
            .is('subject', null)
            .maybeSingle();
          prepaidPayment = legacyPrepaid;
        }

        if (prepaidPayment) {
          // Increment sessions_used
          await supabase
            .from('payments')
            .update({
              sessions_used: (prepaidPayment.sessions_used || 0) + 1,
              updated_at: new Date().toISOString(),
            })
            .eq('id', prepaidPayment.id);
        }
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
 * Hook for reverting a completed lesson back to scheduled status
 * Also decrements prepaid session usage if applicable
 * Admin/tutor only - allows undoing accidental completion
 * @returns Mutation state with uncomplete function
 */
export function useUncompleteLesson() {
  const [data, setData] = useState<ScheduledLesson | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string): Promise<ScheduledLesson | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: lesson, error: updateError } = await supabase
        .from('scheduled_lessons')
        .update({
          status: 'scheduled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      // Decrement prepaid session usage if applicable
      // First get the lesson details to find the parent and subject
      const { data: lessonDetails } = await supabase
        .from('scheduled_lessons')
        .select('scheduled_at, subject, student:students!student_id(parent_id)')
        .eq('id', id)
        .single();

      if (lessonDetails?.student?.parent_id) {
        const parentId = lessonDetails.student.parent_id;
        const lessonDate = new Date(lessonDetails.scheduled_at);
        const lessonSubject = lessonDetails.subject;
        const monthStart = new Date(lessonDate.getFullYear(), lessonDate.getMonth(), 1)
          .toISOString().split('T')[0];

        // Fetch parent's prepaid_subjects to determine billing mode
        const { data: parentRecord } = await supabase
          .from('parents')
          .select('prepaid_subjects')
          .eq('id', parentId)
          .single();
        const prepaidSubjects: string[] = ((parentRecord?.prepaid_subjects as string[]) || [])
          .map((s: string) => s.toLowerCase());

        // Try subject-specific prepaid payment first
        const { data: subjectPrepaid } = await supabase
          .from('payments')
          .select('id, sessions_used')
          .eq('parent_id', parentId)
          .eq('month', monthStart)
          .eq('payment_type', 'prepaid')
          .eq('subject', lessonSubject)
          .maybeSingle();

        let prepaidPayment = subjectPrepaid;

        if (!prepaidPayment && prepaidSubjects.length === 0) {
          // Only fall back to legacy all-subjects prepaid when no per-subject config exists
          const { data: legacyPrepaid } = await supabase
            .from('payments')
            .select('id, sessions_used')
            .eq('parent_id', parentId)
            .eq('month', monthStart)
            .eq('payment_type', 'prepaid')
            .is('subject', null)
            .maybeSingle();
          prepaidPayment = legacyPrepaid;
        }

        if (prepaidPayment && (prepaidPayment.sessions_used || 0) > 0) {
          // Decrement sessions_used (but not below 0)
          await supabase
            .from('payments')
            .update({
              sessions_used: Math.max(0, (prepaidPayment.sessions_used || 0) - 1),
              updated_at: new Date().toISOString(),
            })
            .eq('id', prepaidPayment.id);
        }
      }

      setData(lesson);
      return lesson;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to uncomplete lesson');
      setError(errorMessage);
      console.error('useUncompleteLesson error:', errorMessage);
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
 * Hook for permanently deleting a lesson
 * Use with caution - this cannot be undone
 * @returns Mutation state with delete function
 */
export function useDeleteLesson() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('scheduled_lessons')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete lesson');
      setError(errorMessage);
      console.error('useDeleteLesson error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { loading, error, mutate, reset };
}

/**
 * Hook to find recurring series lessons
 * Finds lessons that match the same student, subject, time of day, and day of week
 * @returns Function to find series and count
 */
export function useFindRecurringSeries() {
  // Find recurring series for standalone lessons
  const findSeries = useCallback(async (lesson: ScheduledLessonWithStudent): Promise<string[]> => {
    try {
      const lessonDate = new Date(lesson.scheduled_at);
      const dayOfWeek = lessonDate.getDay();
      const timeString = lessonDate.toTimeString().slice(0, 5); // HH:MM format

      // Get all lessons for this student with same subject
      const { data: allLessons, error: fetchError } = await supabase
        .from('scheduled_lessons')
        .select('id, scheduled_at')
        .eq('student_id', lesson.student_id)
        .eq('subject', lesson.subject)
        .eq('duration_min', lesson.duration_min);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!allLessons) return [lesson.id];

      // Filter to lessons on same day of week and same time
      const seriesLessons = allLessons.filter(l => {
        const d = new Date(l.scheduled_at);
        const lDayOfWeek = d.getDay();
        const lTimeString = d.toTimeString().slice(0, 5);
        return lDayOfWeek === dayOfWeek && lTimeString === timeString;
      });

      return seriesLessons.map(l => l.id);
    } catch (err) {
      console.error('useFindRecurringSeries error:', err);
      return [lesson.id];
    }
  }, []);

  // Find recurring series for grouped sessions (Combined Sessions)
  // Returns session IDs that match same students, subjects, time, and day of week
  const findSessionSeries = useCallback(async (groupedLesson: GroupedLesson): Promise<string[]> => {
    try {
      if (!groupedLesson.session_id) return [];

      const sessionDate = new Date(groupedLesson.scheduled_at);
      const dayOfWeek = sessionDate.getDay();
      const timeString = sessionDate.toTimeString().slice(0, 5); // HH:MM format

      // Get all lesson IDs in this session
      const lessonIds = groupedLesson.lessons.map(l => l.id);

      // Get all sessions that have similar characteristics
      // We'll find sessions with same time, day of week, and matching student/subject combinations
      const { data: allLessons, error: fetchError } = await supabase
        .from('scheduled_lessons')
        .select('id, session_id, scheduled_at, student_id, subject')
        .not('session_id', 'is', null);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      if (!allLessons) return [groupedLesson.session_id];

      // Group lessons by session_id
      const sessionMap = new Map<string, typeof allLessons>();
      for (const lesson of allLessons) {
        if (!lesson.session_id) continue;
        const existing = sessionMap.get(lesson.session_id) || [];
        existing.push(lesson);
        sessionMap.set(lesson.session_id, existing);
      }

      // Get the student-subject pairs from the current session
      const currentPairs = new Set(
        groupedLesson.lessons.map(l => `${l.student_id}:${l.subject}`)
      );

      // Find sessions that match:
      // 1. Same day of week
      // 2. Same time
      // 3. Same student-subject combinations
      const matchingSessions: string[] = [];

      for (const [sessionId, lessons] of sessionMap) {
        if (lessons.length === 0) continue;

        const firstLesson = lessons[0];
        const d = new Date(firstLesson.scheduled_at);
        const lDayOfWeek = d.getDay();
        const lTimeString = d.toTimeString().slice(0, 5);

        // Check day and time match
        if (lDayOfWeek !== dayOfWeek || lTimeString !== timeString) continue;

        // Check student-subject pairs match
        const sessionPairs = new Set(
          lessons.map(l => `${l.student_id}:${l.subject}`)
        );

        // Check if all pairs match (same size and all elements present)
        if (sessionPairs.size !== currentPairs.size) continue;

        let allMatch = true;
        for (const pair of currentPairs) {
          if (!sessionPairs.has(pair)) {
            allMatch = false;
            break;
          }
        }

        if (allMatch) {
          matchingSessions.push(sessionId);
        }
      }

      return matchingSessions;
    } catch (err) {
      console.error('useFindRecurringSeries findSessionSeries error:', err);
      return groupedLesson.session_id ? [groupedLesson.session_id] : [];
    }
  }, []);

  return { findSeries, findSessionSeries };
}

/**
 * Hook for deleting an entire recurring lesson series
 * @returns Mutation state with delete function for lessons and sessions
 */
export function useDeleteLessonSeries() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Delete standalone lessons by their IDs
  const mutate = useCallback(async (lessonIds: string[]): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // Delete all lessons in the series
      const { error: deleteError } = await supabase
        .from('scheduled_lessons')
        .delete()
        .in('id', lessonIds);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete lesson series');
      setError(errorMessage);
      console.error('useDeleteLessonSeries error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Delete sessions (Combined Sessions) by their session IDs
  // This deletes the session and all lessons associated with it
  const mutateSessions = useCallback(async (sessionIds: string[]): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // First delete all lessons associated with these sessions
      const { error: lessonsError } = await supabase
        .from('scheduled_lessons')
        .delete()
        .in('session_id', sessionIds);

      if (lessonsError) {
        throw new Error(lessonsError.message);
      }

      // Then delete the sessions themselves
      const { error: sessionsError } = await supabase
        .from('lesson_sessions')
        .delete()
        .in('id', sessionIds);

      if (sessionsError) {
        throw new Error(sessionsError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete session series');
      setError(errorMessage);
      console.error('useDeleteLessonSeries mutateSessions error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { loading, error, mutate, mutateSessions, reset };
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

// ============================================================================
// SESSION-RELATED HOOKS
// ============================================================================

/**
 * Hook for creating a new lesson session (groups related lessons)
 * @returns Mutation state with create function
 */
export function useCreateLessonSession() {
  const [data, setData] = useState<LessonSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: CreateLessonSessionInput): Promise<LessonSession | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: session, error: createError } = await supabase
        .from('lesson_sessions')
        .insert(input)
        .select()
        .single();

      if (createError) {
        throw new Error(createError.message);
      }

      setData(session);
      return session;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to create lesson session');
      setError(errorMessage);
      console.error('useCreateLessonSession error:', errorMessage);
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
 * Hook for deleting a lesson session and its associated lessons
 * @returns Mutation state with delete function
 */
export function useDeleteLessonSession() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (sessionId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      // First, delete all lessons in the session
      const { error: lessonsDeleteError } = await supabase
        .from('scheduled_lessons')
        .delete()
        .eq('session_id', sessionId);

      if (lessonsDeleteError) {
        throw new Error(lessonsDeleteError.message);
      }

      // Then delete the session itself
      const { error: sessionDeleteError } = await supabase
        .from('lesson_sessions')
        .delete()
        .eq('id', sessionId);

      if (sessionDeleteError) {
        throw new Error(sessionDeleteError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete lesson session');
      setError(errorMessage);
      console.error('useDeleteLessonSession error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { loading, error, mutate, reset };
}

// ============================================================================
// GROUPING UTILITIES
// ============================================================================

/**
 * Helper function to calculate end time from start time and duration
 */
function calculateEndTime(scheduledAt: string, durationMin: number): string {
  const startTime = new Date(scheduledAt);
  const endTime = new Date(startTime.getTime() + durationMin * 60 * 1000);
  return endTime.toISOString();
}

/**
 * Helper function to derive the overall status from a group of lessons
 */
function deriveGroupStatus(lessons: ScheduledLessonWithStudent[]): TutoringLessonStatus {
  if (lessons.every(l => l.status === 'completed')) return 'completed';
  if (lessons.every(l => l.status === 'cancelled')) return 'cancelled';
  if (lessons.some(l => l.status === 'cancelled')) return 'scheduled'; // Partial cancel = still scheduled
  return 'scheduled';
}

/**
 * Groups lessons by session_id for calendar display
 * Lessons without a session_id become their own group (standalone lessons)
 * @param lessons - Array of lessons with student info
 * @returns Array of grouped lessons for calendar display
 */
export function groupLessonsBySession(lessons: ScheduledLessonWithStudent[]): GroupedLesson[] {
  const sessionMap = new Map<string, ScheduledLessonWithStudent[]>();
  const standaloneLessons: ScheduledLessonWithStudent[] = [];

  // Filter out lessons with null students (orphaned lessons from deleted students)
  const validLessons = lessons.filter(lesson => lesson.student !== null);

  // Separate lessons into sessions and standalone
  for (const lesson of validLessons) {
    if (lesson.session_id) {
      const existing = sessionMap.get(lesson.session_id) || [];
      existing.push(lesson);
      sessionMap.set(lesson.session_id, existing);
    } else {
      standaloneLessons.push(lesson);
    }
  }

  const grouped: GroupedLesson[] = [];

  // Process session groups
  for (const [sessionId, sessionLessons] of sessionMap) {
    // Sort by scheduled_at to get proper order
    sessionLessons.sort((a, b) =>
      new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );

    const firstLesson = sessionLessons[0];

    // For grouped sessions, calculate total session duration as sum of all lesson durations
    // This handles both same-subject sessions (equal split) and multi-subject sessions
    // E.g., Long Bui (30min Piano) + An Bui (30min Speech) = 60min total session
    const sessionDuration = sessionLessons.reduce((sum, lesson) => sum + lesson.duration_min, 0);

    // Get unique student names and subjects
    const studentNames = [...new Set(sessionLessons.map(l => l.student.name))];
    const subjects = [...new Set(sessionLessons.map(l => l.subject))] as TutoringSubject[];

    grouped.push({
      session_id: sessionId,
      lessons: sessionLessons,
      scheduled_at: firstLesson.scheduled_at,
      end_time: calculateEndTime(firstLesson.scheduled_at, sessionDuration),
      duration_min: sessionDuration,
      student_names: studentNames,
      subjects,
      status: deriveGroupStatus(sessionLessons),
    });
  }

  // Process standalone lessons
  for (const lesson of standaloneLessons) {
    grouped.push({
      session_id: null,
      lessons: [lesson],
      scheduled_at: lesson.scheduled_at,
      end_time: calculateEndTime(lesson.scheduled_at, lesson.duration_min),
      duration_min: lesson.duration_min,
      student_names: [lesson.student.name],
      subjects: [lesson.subject],
      status: lesson.status,
    });
  }

  // Sort all grouped lessons by scheduled_at
  grouped.sort((a, b) =>
    new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
  );

  return grouped;
}

/**
 * Hook that returns lessons grouped by session for calendar display
 * @param options - Filter options
 * @returns Grouped lessons with loading/error state
 */
export function useGroupedLessons(options: LessonsFilterOptions = {}): ListQueryState<GroupedLesson> {
  const { data: lessons, loading, error, refetch } = useLessons(options);

  const groupedData = useMemo(() => {
    return groupLessonsBySession(lessons);
  }, [lessons]);

  return { data: groupedData, loading, error, refetch };
}

/**
 * Hook that returns grouped lessons for a specific week
 * @param weekStart - Start date of the week
 * @returns Grouped lessons for the week
 */
export function useWeekGroupedLessons(weekStart: Date): ListQueryState<GroupedLesson> {
  const startDate = new Date(weekStart);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  return useGroupedLessons({
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString(),
  });
}

/**
 * Hook for creating a grouped lesson session with multiple lessons
 * Creates a session and all related lessons in one operation
 * @returns Mutation state with create function
 */
export function useCreateGroupedLesson() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<{ session: LessonSession; lessons: ScheduledLesson[] } | null>(null);

  const mutate = useCallback(async (
    sessionInput: CreateLessonSessionInput,
    lessonInputs: Omit<CreateScheduledLessonInput, 'session_id'>[]
  ): Promise<{ session: LessonSession; lessons: ScheduledLesson[] } | null> => {
    try {
      setLoading(true);
      setError(null);

      // Create the session first
      const { data: session, error: sessionError } = await supabase
        .from('lesson_sessions')
        .insert(sessionInput)
        .select()
        .single();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      // Create all lessons with the session_id
      const lessonsWithSession = lessonInputs.map(input => ({
        ...input,
        session_id: session.id,
        status: 'scheduled' as const,
      }));

      const { data: lessons, error: lessonsError } = await supabase
        .from('scheduled_lessons')
        .insert(lessonsWithSession)
        .select();

      if (lessonsError) {
        // Try to clean up the session if lessons failed
        await supabase.from('lesson_sessions').delete().eq('id', session.id);
        throw new Error(lessonsError.message);
      }

      const result = { session, lessons };
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to create grouped lesson');
      setError(errorMessage);
      console.error('useCreateGroupedLesson error:', errorMessage);
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
