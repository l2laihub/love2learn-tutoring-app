/**
 * useGroupSessions Hook
 * Data fetching hooks for group session enrollment management
 *
 * Parents can browse available group sessions and sign up to join them.
 * Tutors can configure sessions for enrollment and approve/reject requests.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  GroupSessionSettings,
  SessionEnrollment,
  SessionEnrollmentWithStudent,
  SessionEnrollmentWithDetails,
  AvailableGroupSession,
  CreateGroupSessionSettingsInput,
  UpdateGroupSessionSettingsInput,
  CreateSessionEnrollmentInput,
  UpdateSessionEnrollmentInput,
  EnrollmentStatus,
  ListQueryState,
  QueryState,
  TutoringSubject,
} from '../types/database';

// ============================================================================
// Group Session Settings Hooks
// ============================================================================

/**
 * Fetch settings for a specific session
 */
export function useGroupSessionSettings(
  sessionId: string | null
): QueryState<GroupSessionSettings> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<GroupSessionSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSettings = useCallback(async () => {
    if (!sessionId) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: settings, error: fetchError } = await supabase
        .from('group_session_settings')
        .select('*')
        .eq('session_id', sessionId)
        .maybeSingle();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData(settings);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch session settings');
      setError(errorMessage);
      console.error('useGroupSessionSettings error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return { data, loading, error, refetch: fetchSettings };
}

/**
 * Create or update group session settings
 */
export function useUpsertGroupSessionSettings(): {
  upsert: (input: CreateGroupSessionSettingsInput) => Promise<GroupSessionSettings | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const upsert = useCallback(
    async (input: CreateGroupSessionSettingsInput): Promise<GroupSessionSettings | null> => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: upsertError } = await supabase
          .from('group_session_settings')
          .upsert(
            {
              session_id: input.session_id,
              is_open_for_enrollment: input.is_open_for_enrollment ?? true,
              max_students: input.max_students ?? 4,
              enrollment_deadline_hours: input.enrollment_deadline_hours ?? 24,
              allowed_subjects: input.allowed_subjects,
              notes: input.notes,
            },
            { onConflict: 'session_id' }
          )
          .select()
          .single();

        if (upsertError) {
          throw new Error(upsertError.message);
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to save session settings');
        setError(errorMessage);
        console.error('useUpsertGroupSessionSettings error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { upsert, loading, error };
}

/**
 * Update group session settings
 */
export function useUpdateGroupSessionSettings(): {
  update: (
    sessionId: string,
    input: UpdateGroupSessionSettingsInput
  ) => Promise<GroupSessionSettings | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(
    async (
      sessionId: string,
      input: UpdateGroupSessionSettingsInput
    ): Promise<GroupSessionSettings | null> => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: updateError } = await supabase
          .from('group_session_settings')
          .update(input)
          .eq('session_id', sessionId)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to update session settings');
        setError(errorMessage);
        console.error('useUpdateGroupSessionSettings error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { update, loading, error };
}

/**
 * Convert a standalone lesson into a session
 * Creates a lesson_sessions record and updates the lesson's session_id
 */
export function useConvertLessonToSession(): {
  convert: (lessonId: string, scheduledAt: string, durationMin: number) => Promise<string | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const convert = useCallback(
    async (lessonId: string, scheduledAt: string, durationMin: number): Promise<string | null> => {
      try {
        setLoading(true);
        setError(null);

        // Create a new session
        const { data: session, error: sessionError } = await supabase
          .from('lesson_sessions')
          .insert({
            scheduled_at: scheduledAt,
            duration_min: durationMin,
          })
          .select()
          .single();

        if (sessionError) {
          throw new Error(sessionError.message);
        }

        // Update the lesson to link to the session
        const { error: updateError } = await supabase
          .from('scheduled_lessons')
          .update({ session_id: session.id })
          .eq('id', lessonId);

        if (updateError) {
          // Cleanup: delete the session if lesson update failed
          await supabase.from('lesson_sessions').delete().eq('id', session.id);
          throw new Error(updateError.message);
        }

        return session.id;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to convert lesson to session');
        setError(errorMessage);
        console.error('useConvertLessonToSession error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { convert, loading, error };
}

// ============================================================================
// Available Sessions for Parents
// ============================================================================

/**
 * Fetch available group sessions that a parent can enroll in
 */
export function useAvailableGroupSessions(
  parentId: string | null
): ListQueryState<AvailableGroupSession> {
  const [data, setData] = useState<AvailableGroupSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    if (!parentId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get parent's student IDs
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('parent_id', parentId);

      if (studentsError) {
        throw new Error(studentsError.message);
      }

      const studentIds = students?.map((s) => s.id) || [];

      // Get sessions with settings that are open for enrollment
      const { data: settingsData, error: settingsError } = await supabase
        .from('group_session_settings')
        .select(`
          *,
          session:lesson_sessions(
            *,
            lessons:scheduled_lessons(
              *,
              student:students(
                *,
                parent:parents(*)
              )
            )
          )
        `)
        .eq('is_open_for_enrollment', true);

      if (settingsError) {
        throw new Error(settingsError.message);
      }

      // Get existing enrollments for these sessions
      const sessionIds = settingsData?.map((s) => s.session_id) || [];
      const { data: enrollments, error: enrollmentsError } = await supabase
        .from('session_enrollments')
        .select('session_id, student_id, status')
        .in('session_id', sessionIds.length > 0 ? sessionIds : ['00000000-0000-0000-0000-000000000000']);

      if (enrollmentsError) {
        throw new Error(enrollmentsError.message);
      }

      const now = new Date();
      const availableSessions: AvailableGroupSession[] = [];

      for (const settings of settingsData || []) {
        const session = settings.session as any;
        if (!session) continue;

        // Calculate enrollment deadline
        const sessionTime = new Date(session.scheduled_at);
        const enrollmentDeadline = new Date(
          sessionTime.getTime() - settings.enrollment_deadline_hours * 60 * 60 * 1000
        );

        // Skip if enrollment deadline has passed
        if (now > enrollmentDeadline) continue;

        // Skip if session is in the past
        if (now > sessionTime) continue;

        // Count current students (from scheduled_lessons)
        const lessons = session.lessons || [];
        const currentStudentIds = new Set(
          lessons
            .filter((l: any) => l.status !== 'cancelled')
            .map((l: any) => l.student_id)
        );
        const currentStudents = currentStudentIds.size;

        // Count pending enrollments
        const sessionEnrollments = enrollments?.filter(
          (e) => e.session_id === settings.session_id
        ) || [];
        const pendingEnrollments = sessionEnrollments.filter(
          (e) => e.status === 'pending' || e.status === 'approved'
        ).length;

        // Calculate available slots
        const availableSlots = settings.max_students - currentStudents - pendingEnrollments;

        // Skip if no slots available
        if (availableSlots <= 0) continue;

        // Check if parent's students are already enrolled or in session
        const parentStudentsAlreadyIn = studentIds.some(
          (sid) =>
            currentStudentIds.has(sid) ||
            sessionEnrollments.some((e) => e.student_id === sid && e.status !== 'cancelled')
        );

        // We still show the session even if some students are in it
        // The UI will filter which students can be selected

        availableSessions.push({
          session_id: settings.session_id,
          session,
          settings,
          current_students: currentStudents,
          pending_enrollments: pendingEnrollments,
          available_slots: availableSlots,
          lessons,
          enrollment_deadline: enrollmentDeadline.toISOString(),
          is_enrollment_open: true,
        });
      }

      // Sort by session date
      availableSessions.sort(
        (a, b) =>
          new Date(a.session.scheduled_at).getTime() -
          new Date(b.session.scheduled_at).getTime()
      );

      setData(availableSessions);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch available sessions');
      setError(errorMessage);
      console.error('useAvailableGroupSessions error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  return { data, loading, error, refetch: fetchSessions };
}

// ============================================================================
// Session Enrollments Hooks
// ============================================================================

/**
 * Fetch enrollments for a specific session
 */
export function useSessionEnrollments(
  sessionId: string | null
): ListQueryState<SessionEnrollmentWithDetails> {
  const [data, setData] = useState<SessionEnrollmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEnrollments = useCallback(async () => {
    if (!sessionId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: enrollments, error: fetchError } = await supabase
        .from('session_enrollments')
        .select(`
          *,
          student:students(*),
          parent:parents(*)
        `)
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((enrollments as SessionEnrollmentWithDetails[]) || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch enrollments');
      setError(errorMessage);
      console.error('useSessionEnrollments error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  return { data, loading, error, refetch: fetchEnrollments };
}

/**
 * Fetch all pending enrollments (for tutor dashboard)
 */
export function usePendingEnrollments(): ListQueryState<SessionEnrollmentWithDetails> {
  const [data, setData] = useState<SessionEnrollmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEnrollments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: enrollments, error: fetchError } = await supabase
        .from('session_enrollments')
        .select(`
          *,
          student:students(*),
          parent:parents(*),
          session:lesson_sessions(*)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((enrollments as SessionEnrollmentWithDetails[]) || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch pending enrollments');
      setError(errorMessage);
      console.error('usePendingEnrollments error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  return { data, loading, error, refetch: fetchEnrollments };
}

/**
 * Count pending enrollments (for badge display)
 */
export function usePendingEnrollmentsCount(): {
  count: number;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCount = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { count: pendingCount, error: countError } = await supabase
        .from('session_enrollments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (countError) {
        throw new Error(countError.message);
      }

      setCount(pendingCount || 0);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to count pending enrollments');
      setError(errorMessage);
      console.error('usePendingEnrollmentsCount error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return { count, loading, error, refetch: fetchCount };
}

/**
 * Fetch parent's own enrollments
 */
export function useMyEnrollments(
  parentId: string | null
): ListQueryState<SessionEnrollmentWithDetails> {
  const [data, setData] = useState<SessionEnrollmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEnrollments = useCallback(async () => {
    if (!parentId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: enrollments, error: fetchError } = await supabase
        .from('session_enrollments')
        .select(`
          *,
          student:students(*),
          parent:parents(*),
          session:lesson_sessions(*)
        `)
        .eq('parent_id', parentId)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((enrollments as SessionEnrollmentWithDetails[]) || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch my enrollments');
      setError(errorMessage);
      console.error('useMyEnrollments error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  return { data, loading, error, refetch: fetchEnrollments };
}

// ============================================================================
// Enrollment Mutations
// ============================================================================

/**
 * Create a new enrollment request (for parents)
 */
export function useCreateEnrollment(): {
  createEnrollment: (input: CreateSessionEnrollmentInput) => Promise<SessionEnrollment | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createEnrollment = useCallback(
    async (input: CreateSessionEnrollmentInput): Promise<SessionEnrollment | null> => {
      try {
        setLoading(true);
        setError(null);

        // First check if session is still open for enrollment
        const { data: settings, error: settingsError } = await supabase
          .from('group_session_settings')
          .select(`
            *,
            session:lesson_sessions(scheduled_at)
          `)
          .eq('session_id', input.session_id)
          .single();

        if (settingsError || !settings) {
          throw new Error('Session is not open for enrollment');
        }

        // Check deadline
        const session = settings.session as any;
        const sessionTime = new Date(session.scheduled_at);
        const deadline = new Date(
          sessionTime.getTime() - settings.enrollment_deadline_hours * 60 * 60 * 1000
        );
        if (new Date() > deadline) {
          throw new Error('Enrollment deadline has passed');
        }

        // Check if student is already enrolled
        const { data: existingEnrollment, error: existingError } = await supabase
          .from('session_enrollments')
          .select('id, status')
          .eq('session_id', input.session_id)
          .eq('student_id', input.student_id)
          .maybeSingle();

        if (existingError) {
          throw new Error(existingError.message);
        }

        // Check if student already has an active enrollment (pending or approved)
        if (existingEnrollment && existingEnrollment.status !== 'cancelled' && existingEnrollment.status !== 'rejected') {
          throw new Error('Student is already enrolled in this session');
        }

        let data: SessionEnrollment;

        // If there's a cancelled or rejected enrollment, update it instead of creating new
        if (existingEnrollment && (existingEnrollment.status === 'cancelled' || existingEnrollment.status === 'rejected')) {
          const { data: updatedData, error: updateError } = await supabase
            .from('session_enrollments')
            .update({
              subject: input.subject,
              duration_min: input.duration_min,
              notes: input.notes,
              status: 'pending',
              tutor_response: null, // Clear previous response
              scheduled_lesson_id: null, // Clear any previous lesson link
            })
            .eq('id', existingEnrollment.id)
            .select()
            .single();

          if (updateError) {
            throw new Error(updateError.message);
          }
          data = updatedData;
        } else {
          // Create new enrollment
          const { data: newData, error: createError } = await supabase
            .from('session_enrollments')
            .insert({
              session_id: input.session_id,
              student_id: input.student_id,
              parent_id: input.parent_id,
              subject: input.subject,
              duration_min: input.duration_min,
              notes: input.notes,
              status: 'pending',
            })
            .select()
            .single();

          if (createError) {
            throw new Error(createError.message);
          }
          data = newData;
        }

        // Create notification for tutor (recipient_id = null means tutors see it via RLS)
        try {
          const { data: student } = await supabase
            .from('students')
            .select('name')
            .eq('id', input.student_id)
            .single();

          console.log('[Enrollment] Creating notification for tutor...');
          const { error: notifyError } = await supabase.from('notifications').insert({
            recipient_id: null, // Tutors see all notifications via RLS
            sender_id: input.parent_id,
            type: 'enrollment_request',
            title: 'New Group Session Enrollment',
            message: `${student?.name || 'A student'} has requested to join a group session for ${input.subject}`,
            data: {
              enrollment_id: data.id,
              session_id: input.session_id,
              student_id: input.student_id,
              subject: input.subject,
            },
            action_url: '/requests?tab=enrollments',
          });

          if (notifyError) {
            console.error('[Enrollment] Notification insert error:', notifyError);
          } else {
            console.log('[Enrollment] Notification created successfully');
          }
        } catch (notifyErr) {
          console.error('[Enrollment] Failed to create notification:', notifyErr);
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to create enrollment');
        setError(errorMessage);
        console.error('useCreateEnrollment error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createEnrollment, loading, error };
}

/**
 * Approve an enrollment and create the scheduled lesson
 */
export function useApproveEnrollment(): {
  approveEnrollment: (
    enrollmentId: string,
    response?: string
  ) => Promise<SessionEnrollment | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const approveEnrollment = useCallback(
    async (
      enrollmentId: string,
      response?: string
    ): Promise<SessionEnrollment | null> => {
      try {
        setLoading(true);
        setError(null);

        // Get enrollment details
        const { data: enrollment, error: enrollmentError } = await supabase
          .from('session_enrollments')
          .select(`
            *,
            session:lesson_sessions(scheduled_at, notes)
          `)
          .eq('id', enrollmentId)
          .single();

        if (enrollmentError || !enrollment) {
          throw new Error('Enrollment not found');
        }

        const session = enrollment.session as any;

        // Create the scheduled lesson
        const { data: lesson, error: lessonError } = await supabase
          .from('scheduled_lessons')
          .insert({
            student_id: enrollment.student_id,
            session_id: enrollment.session_id,
            subject: enrollment.subject,
            scheduled_at: session.scheduled_at,
            duration_min: enrollment.duration_min,
            notes: enrollment.notes || session.notes,
            status: 'scheduled',
          })
          .select()
          .single();

        if (lessonError) {
          throw new Error(lessonError.message);
        }

        // Update enrollment status
        const { data, error: updateError } = await supabase
          .from('session_enrollments')
          .update({
            status: 'approved',
            tutor_response: response || null,
            scheduled_lesson_id: lesson.id,
          })
          .eq('id', enrollmentId)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Create notification for parent and send email
        try {
          const { data: student } = await supabase
            .from('students')
            .select('name')
            .eq('id', enrollment.student_id)
            .single();

          await supabase.from('notifications').insert({
            recipient_id: enrollment.parent_id,
            sender_id: null,
            type: 'enrollment_response',
            title: 'Enrollment Approved',
            message: `${student?.name || 'Your student'}'s enrollment for ${enrollment.subject} has been approved`,
            data: {
              enrollment_id: enrollmentId,
              session_id: enrollment.session_id,
              lesson_id: lesson.id,
            },
          });

          // Send email notification (fire-and-forget to not block UI)
          const sessionDate = new Date(session.scheduled_at);
          const dateStr = sessionDate.toISOString().split('T')[0];
          const timeStr = sessionDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });

          sendEnrollmentApprovalEmail({
            parent_id: enrollment.parent_id,
            student_name: student?.name || 'Student',
            subject: enrollment.subject,
            session_date: dateStr,
            session_time: timeStr,
            tutor_response: response || null,
            duration_min: enrollment.duration_min,
          });
        } catch (notifyErr) {
          console.error('Failed to create notification:', notifyErr);
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to approve enrollment');
        setError(errorMessage);
        console.error('useApproveEnrollment error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { approveEnrollment, loading, error };
}

/**
 * Reject an enrollment request
 */
export function useRejectEnrollment(): {
  rejectEnrollment: (enrollmentId: string, reason?: string) => Promise<SessionEnrollment | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const rejectEnrollment = useCallback(
    async (enrollmentId: string, reason?: string): Promise<SessionEnrollment | null> => {
      try {
        setLoading(true);
        setError(null);

        // Get enrollment details for notification (include session for email)
        const { data: enrollment, error: enrollmentError } = await supabase
          .from('session_enrollments')
          .select('*, student:students(name), session:lesson_sessions(scheduled_at)')
          .eq('id', enrollmentId)
          .single();

        if (enrollmentError) {
          throw new Error(enrollmentError.message);
        }

        // Update enrollment status
        const { data, error: updateError } = await supabase
          .from('session_enrollments')
          .update({
            status: 'rejected',
            tutor_response: reason || null,
          })
          .eq('id', enrollmentId)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Create notification for parent and send email
        try {
          const student = enrollment.student as any;
          const session = enrollment.session as any;

          await supabase.from('notifications').insert({
            recipient_id: enrollment.parent_id,
            sender_id: null,
            type: 'enrollment_response',
            title: 'Enrollment Declined',
            message: `${student?.name || 'Your student'}'s enrollment request has been declined${reason ? `: ${reason}` : ''}`,
            data: {
              enrollment_id: enrollmentId,
              session_id: enrollment.session_id,
              reason: reason || null,
            },
          });

          // Send email notification (fire-and-forget to not block UI)
          const sessionDate = new Date(session.scheduled_at);
          const dateStr = sessionDate.toISOString().split('T')[0];
          const timeStr = sessionDate.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          });

          sendEnrollmentRejectionEmail({
            parent_id: enrollment.parent_id,
            student_name: student?.name || 'Student',
            subject: enrollment.subject,
            session_date: dateStr,
            session_time: timeStr,
            tutor_response: reason || null,
          });
        } catch (notifyErr) {
          console.error('Failed to create notification:', notifyErr);
        }

        return data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to reject enrollment');
        setError(errorMessage);
        console.error('useRejectEnrollment error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { rejectEnrollment, loading, error };
}

/**
 * Cancel a pending enrollment (for parents)
 */
export function useCancelEnrollment(): {
  cancelEnrollment: (enrollmentId: string) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const cancelEnrollment = useCallback(
    async (enrollmentId: string): Promise<boolean> => {
      try {
        setLoading(true);
        setError(null);

        const { error: updateError } = await supabase
          .from('session_enrollments')
          .update({ status: 'cancelled' })
          .eq('id', enrollmentId)
          .eq('status', 'pending'); // Can only cancel pending enrollments

        if (updateError) {
          throw new Error(updateError.message);
        }

        return true;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to cancel enrollment');
        setError(errorMessage);
        console.error('useCancelEnrollment error:', errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { cancelEnrollment, loading, error };
}

/**
 * Fetch all enrollments (for tutor - all statuses)
 */
export function useAllEnrollments(
  status?: EnrollmentStatus
): ListQueryState<SessionEnrollmentWithDetails> {
  const [data, setData] = useState<SessionEnrollmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEnrollments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('session_enrollments')
        .select(`
          *,
          student:students(*),
          parent:parents(*),
          session:lesson_sessions(*)
        `)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: enrollments, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((enrollments as SessionEnrollmentWithDetails[]) || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch enrollments');
      setError(errorMessage);
      console.error('useAllEnrollments error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  return { data, loading, error, refetch: fetchEnrollments };
}

// ============================================================================
// Email Helper Functions
// ============================================================================

/**
 * Helper function to send enrollment approval email via edge function
 */
async function sendEnrollmentApprovalEmail(data: {
  parent_id: string;
  student_name: string;
  subject: string;
  session_date: string;
  session_time: string;
  tutor_response: string | null;
  duration_min: number;
}): Promise<void> {
  try {
    const response = await supabase.functions.invoke('send-enrollment-approval', {
      body: data,
    });

    if (response.error) {
      console.error('[Enrollment] Approval email error:', response.error);
    } else {
      console.log('[Enrollment] Approval email sent successfully');
    }
  } catch (err) {
    console.error('[Enrollment] Failed to send approval email:', err);
  }
}

/**
 * Helper function to send enrollment rejection email via edge function
 */
async function sendEnrollmentRejectionEmail(data: {
  parent_id: string;
  student_name: string;
  subject: string;
  session_date: string;
  session_time: string;
  tutor_response: string | null;
}): Promise<void> {
  try {
    const response = await supabase.functions.invoke('send-enrollment-rejection', {
      body: data,
    });

    if (response.error) {
      console.error('[Enrollment] Rejection email error:', response.error);
    } else {
      console.log('[Enrollment] Rejection email sent successfully');
    }
  } catch (err) {
    console.error('[Enrollment] Failed to send rejection email:', err);
  }
}
