/**
 * useLessonRequests Hook
 * Data fetching hooks for lesson request management in Love2Learn tutoring app
 *
 * Parents can request reschedules or new lessons, and tutors/admin can approve/reject them.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  LessonRequest,
  LessonRequestWithStudent,
  CreateLessonRequestInput,
  UpdateLessonRequestInput,
  LessonRequestStatus,
  ListQueryState,
  QueryState,
} from '../types/database';

/**
 * Filter options for lesson requests
 */
export interface LessonRequestsFilterOptions {
  parentId?: string;
  studentId?: string;
  status?: LessonRequestStatus;
  startDate?: string;
  endDate?: string;
}

/**
 * Extended input for reschedule requests
 */
export interface CreateRescheduleRequestInput extends CreateLessonRequestInput {
  original_lesson_id?: string;
  request_type: 'new' | 'reschedule';
}

/**
 * Fetch lesson requests with optional filters
 * @param options - Filter options
 * @returns List of lesson requests with student info, loading state, and error
 */
export function useLessonRequests(
  options: LessonRequestsFilterOptions = {}
): ListQueryState<LessonRequestWithStudent> {
  const [data, setData] = useState<LessonRequestWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { parentId, studentId, status, startDate, endDate } = options;

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('lesson_requests')
        .select(`
          *,
          student:students(
            *,
            parent:parents(*)
          )
        `)
        .order('created_at', { ascending: false });

      // Apply filters
      if (parentId) {
        query = query.eq('parent_id', parentId);
      }

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (startDate) {
        query = query.gte('preferred_date', startDate);
      }

      if (endDate) {
        query = query.lte('preferred_date', endDate);
      }

      const { data: requests, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((requests as LessonRequestWithStudent[]) || []);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch lesson requests');
      setError(errorMessage);
      console.error('useLessonRequests error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parentId, studentId, status, startDate, endDate]);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  return { data, loading, error, refetch: fetchRequests };
}

/**
 * Fetch pending lesson requests (for tutor/admin dashboard)
 */
export function usePendingLessonRequests(): ListQueryState<LessonRequestWithStudent> {
  return useLessonRequests({ status: 'pending' });
}

/**
 * Fetch a single lesson request by ID
 * @param id - Request UUID
 * @returns Single request with student info, loading state, and error
 */
export function useLessonRequest(
  id: string | null
): QueryState<LessonRequestWithStudent> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<LessonRequestWithStudent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchRequest = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: request, error: fetchError } = await supabase
        .from('lesson_requests')
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

      setData(request as LessonRequestWithStudent);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to fetch lesson request');
      setError(errorMessage);
      console.error('useLessonRequest error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  return { data, loading, error, refetch: fetchRequest };
}

/**
 * Create a new lesson request (for parents)
 * @returns Mutation function, loading state, and error
 */
export function useCreateLessonRequest(): {
  createRequest: (input: CreateLessonRequestInput) => Promise<LessonRequest | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createRequest = useCallback(
    async (input: CreateLessonRequestInput): Promise<LessonRequest | null> => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: createError } = await supabase
          .from('lesson_requests')
          .insert({
            ...input,
            status: 'pending',
          })
          .select()
          .single();

        if (createError) {
          throw new Error(createError.message);
        }

        return data as LessonRequest;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to create lesson request');
        setError(errorMessage);
        console.error('useCreateLessonRequest error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createRequest, loading, error };
}

/**
 * Update a lesson request (for tutor/admin)
 * @returns Mutation function, loading state, and error
 */
export function useUpdateLessonRequest(): {
  updateRequest: (
    id: string,
    input: UpdateLessonRequestInput
  ) => Promise<LessonRequest | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateRequest = useCallback(
    async (
      id: string,
      input: UpdateLessonRequestInput
    ): Promise<LessonRequest | null> => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: updateError } = await supabase
          .from('lesson_requests')
          .update(input)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        return data as LessonRequest;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to update lesson request');
        setError(errorMessage);
        console.error('useUpdateLessonRequest error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateRequest, loading, error };
}

/**
 * Approve a lesson request and optionally create the scheduled lesson
 * @returns Mutation function, loading state, and error
 */
export function useApproveLessonRequest(): {
  approveRequest: (
    id: string,
    response?: string,
    scheduledLessonId?: string
  ) => Promise<LessonRequest | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const approveRequest = useCallback(
    async (
      id: string,
      response?: string,
      scheduledLessonId?: string
    ): Promise<LessonRequest | null> => {
      try {
        setLoading(true);
        setError(null);

        const updateData: UpdateLessonRequestInput = {
          status: scheduledLessonId ? 'scheduled' : 'approved',
          tutor_response: response || null,
          scheduled_lesson_id: scheduledLessonId || null,
        };

        const { data, error: updateError } = await supabase
          .from('lesson_requests')
          .update(updateData)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        return data as LessonRequest;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to approve lesson request');
        setError(errorMessage);
        console.error('useApproveLessonRequest error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { approveRequest, loading, error };
}

/**
 * Reject a lesson request
 * @returns Mutation function, loading state, and error
 */
export function useRejectLessonRequest(): {
  rejectRequest: (id: string, reason?: string) => Promise<LessonRequest | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const rejectRequest = useCallback(
    async (id: string, reason?: string): Promise<LessonRequest | null> => {
      try {
        setLoading(true);
        setError(null);

        // First get the request details with student info for the email
        const { data: requestData, error: fetchError } = await supabase
          .from('lesson_requests')
          .select(`
            parent_id,
            subject,
            preferred_date,
            request_group_id,
            student:students (name)
          `)
          .eq('id', id)
          .single();

        if (fetchError) {
          throw new Error(fetchError.message);
        }

        // Update the request status
        const { data, error: updateError } = await supabase
          .from('lesson_requests')
          .update({
            status: 'rejected' as const,
            tutor_response: reason || null,
          })
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        // Send rejection email via edge function (fire-and-forget to not block UI)
        if (requestData) {
          const studentData = requestData.student as { name: string } | null;
          sendRejectionEmail({
            parent_id: requestData.parent_id,
            student_name: studentData?.name || 'Student',
            subject: requestData.subject,
            preferred_date: requestData.preferred_date,
            tutor_response: reason || null,
            request_group_id: requestData.request_group_id,
          }).catch((emailError) => {
            // Log but don't fail the rejection if email fails
            console.error('Failed to send rejection email:', emailError);
          });
        }

        return data as LessonRequest;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err : new Error('Failed to reject lesson request');
        setError(errorMessage);
        console.error('useRejectLessonRequest error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { rejectRequest, loading, error };
}

/**
 * Helper function to send rejection email via edge function
 */
async function sendRejectionEmail(data: {
  parent_id: string;
  student_name: string;
  subject: string;
  preferred_date: string;
  tutor_response: string | null;
  request_group_id: string | null;
}): Promise<void> {
  const response = await supabase.functions.invoke('send-reschedule-rejection', {
    body: data,
  });

  if (response.error) {
    throw new Error(response.error.message);
  }
}

/**
 * Delete a lesson request (for parents - only pending requests)
 * @returns Mutation function, loading state, and error
 */
export function useDeleteLessonRequest(): {
  deleteRequest: (id: string) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteRequest = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('lesson_requests')
        .delete()
        .eq('id', id)
        .eq('status', 'pending'); // Only allow deleting pending requests

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return true;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to delete lesson request');
      setError(errorMessage);
      console.error('useDeleteLessonRequest error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteRequest, loading, error };
}

/**
 * Count pending requests (for badge display)
 */
export function usePendingRequestsCount(): {
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
        .from('lesson_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      if (countError) {
        throw new Error(countError.message);
      }

      setCount(pendingCount || 0);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err : new Error('Failed to count pending requests');
      setError(errorMessage);
      console.error('usePendingRequestsCount error:', errorMessage);
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
 * Get request status display info
 */
export function getRequestStatusInfo(status: LessonRequestStatus): {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
} {
  switch (status) {
    case 'pending':
      return {
        label: 'Pending',
        color: '#FFC107',
        bgColor: '#FFF8E1',
        icon: 'time-outline',
      };
    case 'approved':
      return {
        label: 'Approved',
        color: '#7CB342',
        bgColor: '#F1F8E9',
        icon: 'checkmark-circle-outline',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        color: '#E53935',
        bgColor: '#FFEBEE',
        icon: 'close-circle-outline',
      };
    case 'scheduled':
      return {
        label: 'Scheduled',
        color: '#3D9CA8',
        bgColor: '#E8F5F7',
        icon: 'calendar-outline',
      };
    default:
      return {
        label: 'Unknown',
        color: '#9E9E9E',
        bgColor: '#F5F5F5',
        icon: 'help-circle-outline',
      };
  }
}
