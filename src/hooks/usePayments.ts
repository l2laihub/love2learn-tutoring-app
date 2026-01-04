/**
 * usePayments Hook
 * Data fetching hooks for payment tracking in Love2Learn tutoring app
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Payment,
  PaymentWithParent,
  PaymentWithDetails,
  CreatePaymentInput,
  UpdatePaymentInput,
  ListQueryState,
  QueryState,
  PaymentStatus,
  TutoringSubject,
  SubjectRates,
  TutorSettings,
} from '../types/database';

/**
 * Get the first day of a month as an ISO string
 */
function getMonthStart(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth(), 1);
  return d.toISOString().split('T')[0];
}

/**
 * Get the last day of a month as an ISO string
 */
function getMonthEnd(date: Date): string {
  const d = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return d.toISOString().split('T')[0];
}

/**
 * Fetch payments for a specific month
 * @param month - Optional Date object (defaults to current month)
 * @returns List of payments with parent info for the specified month
 */
export function usePayments(month?: Date): ListQueryState<PaymentWithParent> {
  const [data, setData] = useState<PaymentWithParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const targetMonth = month || new Date();
  const monthStart = getMonthStart(targetMonth);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: payments, error: fetchError } = await supabase
        .from('payments')
        .select(`
          *,
          parent:parents(
            *,
            students(*)
          )
        `)
        .eq('month', monthStart)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((payments as PaymentWithParent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch payments');
      setError(errorMessage);
      console.error('usePayments error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [monthStart]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return { data, loading, error, refetch: fetchPayments };
}

/**
 * Fetch all payments (across all months) with optional status filter
 * @param status - Optional payment status filter
 * @returns List of all payments
 */
export function useAllPayments(status?: PaymentStatus): ListQueryState<PaymentWithParent> {
  const [data, setData] = useState<PaymentWithParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('payments')
        .select(`
          *,
          parent:parents(
            *,
            students(*)
          )
        `)
        .order('month', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data: payments, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((payments as PaymentWithParent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch payments');
      setError(errorMessage);
      console.error('useAllPayments error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return { data, loading, error, refetch: fetchPayments };
}

/**
 * Fetch a single payment by ID
 * @param id - Payment UUID
 * @returns Single payment with parent data, loading state, and error
 */
export function usePayment(id: string | null): QueryState<PaymentWithParent> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<PaymentWithParent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPayment = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: payment, error: fetchError } = await supabase
        .from('payments')
        .select(`
          *,
          parent:parents(
            *,
            students(*)
          )
        `)
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData(payment as PaymentWithParent);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch payment');
      setError(errorMessage);
      console.error('usePayment error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  return { data, loading, error, refetch: fetchPayment };
}

/**
 * Fetch payments for a specific parent
 * @param parentId - Parent UUID
 * @returns List of payments for the parent
 */
export function usePaymentsByParent(parentId: string | null): ListQueryState<Payment> {
  const [data, setData] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!parentId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: payments, error: fetchError } = await supabase
        .from('payments')
        .select('*')
        .eq('parent_id', parentId)
        .order('month', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData(payments || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch payments');
      setError(errorMessage);
      console.error('usePaymentsByParent error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return { data, loading, error, refetch: fetchPayments };
}

/**
 * Hook for creating a payment record
 * @returns Mutation state with create function
 */
export function useCreatePayment() {
  const [data, setData] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: CreatePaymentInput): Promise<Payment | null> => {
    try {
      setLoading(true);
      setError(null);

      // Calculate status based on amounts
      let status: PaymentStatus = 'unpaid';
      const amountPaid = input.amount_paid || 0;

      if (amountPaid >= input.amount_due) {
        status = 'paid';
      } else if (amountPaid > 0) {
        status = 'partial';
      }

      const { data: payment, error: createError } = await supabase
        .from('payments')
        .insert({
          ...input,
          status,
          amount_paid: amountPaid,
        })
        .select()
        .single();

      if (createError) {
        throw new Error(createError.message);
      }

      setData(payment);
      return payment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to create payment');
      setError(errorMessage);
      console.error('useCreatePayment error:', errorMessage);
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
 * Hook for updating a payment (mark paid, add notes, etc.)
 * @returns Mutation state with update function
 */
export function useUpdatePayment() {
  const [data, setData] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string, input: UpdatePaymentInput): Promise<Payment | null> => {
    try {
      setLoading(true);
      setError(null);

      // If amount_paid is being updated, recalculate status
      const updateData: UpdatePaymentInput & { updated_at: string } = {
        ...input,
        updated_at: new Date().toISOString(),
      };

      // First fetch current payment to calculate status if needed
      if (input.amount_paid !== undefined && input.status === undefined) {
        const { data: currentPayment } = await supabase
          .from('payments')
          .select('amount_due')
          .eq('id', id)
          .single();

        if (currentPayment) {
          const amountDue = input.amount_due || currentPayment.amount_due;
          if (input.amount_paid >= amountDue) {
            updateData.status = 'paid';
            updateData.paid_at = new Date().toISOString();
          } else if (input.amount_paid > 0) {
            updateData.status = 'partial';
          } else {
            updateData.status = 'unpaid';
            updateData.paid_at = null;
          }
        }
      }

      const { data: payment, error: updateError } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      setData(payment);
      return payment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to update payment');
      setError(errorMessage);
      console.error('useUpdatePayment error:', errorMessage);
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
 * Hook for marking a payment as fully paid
 * @returns Mutation state with markPaid function
 */
export function useMarkPaymentPaid() {
  const [data, setData] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string, notes?: string): Promise<Payment | null> => {
    try {
      setLoading(true);
      setError(null);

      // First get the amount due
      const { data: currentPayment, error: fetchError } = await supabase
        .from('payments')
        .select('amount_due')
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const updateData: Partial<Payment> = {
        amount_paid: currentPayment.amount_due,
        status: 'paid',
        paid_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (notes) {
        updateData.notes = notes;
      }

      const { data: payment, error: updateError } = await supabase
        .from('payments')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      setData(payment);
      return payment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to mark payment as paid');
      setError(errorMessage);
      console.error('useMarkPaymentPaid error:', errorMessage);
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
 * Fetch overdue payments (unpaid or partial, past the 7th of the month)
 * @returns List of overdue payments
 */
export function useOverduePayments(): ListQueryState<PaymentWithParent> {
  const [data, setData] = useState<PaymentWithParent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const now = new Date();
      const currentMonth = getMonthStart(now);
      const isAfter7th = now.getDate() > 7;

      let query = supabase
        .from('payments')
        .select(`
          *,
          parent:parents(
            *,
            students(*)
          )
        `)
        .in('status', ['unpaid', 'partial'])
        .order('month', { ascending: true });

      // If we're past the 7th, include current month in overdue
      if (isAfter7th) {
        query = query.lte('month', currentMonth);
      } else {
        query = query.lt('month', currentMonth);
      }

      const { data: payments, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((payments as PaymentWithParent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch overdue payments');
      setError(errorMessage);
      console.error('useOverduePayments error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  return { data, loading, error, refetch: fetchPayments };
}

/**
 * Get payment summary stats for a month
 * @param month - Optional Date object (defaults to current month)
 * @returns Summary of payment statistics
 */
export function usePaymentSummary(month?: Date) {
  const { data: payments, loading, error, refetch } = usePayments(month);

  const summary = {
    totalDue: 0,
    totalPaid: 0,
    totalOutstanding: 0,
    paidCount: 0,
    partialCount: 0,
    unpaidCount: 0,
    totalFamilies: payments.length,
  };

  payments.forEach((payment) => {
    summary.totalDue += payment.amount_due;
    summary.totalPaid += payment.amount_paid;

    switch (payment.status) {
      case 'paid':
        summary.paidCount++;
        break;
      case 'partial':
        summary.partialCount++;
        break;
      case 'unpaid':
        summary.unpaidCount++;
        break;
    }
  });

  summary.totalOutstanding = summary.totalDue - summary.totalPaid;

  return { summary, loading, error, refetch };
}

/**
 * Hook for deleting a payment
 * @returns Mutation state with delete function
 */
export function useDeletePayment() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('payments')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete payment');
      setError(errorMessage);
      console.error('useDeletePayment error:', errorMessage);
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
// INVOICE GENERATION
// ============================================================================

/**
 * Lesson with student info including rates for invoice calculation
 */
export interface LessonForInvoice {
  id: string;
  student_id: string;
  student_name: string;
  subject: TutoringSubject;
  scheduled_at: string;
  duration_min: number;
  rate: number;           // Rate amount (e.g., 35)
  base_duration: number;  // Base duration in minutes (e.g., 30 for $35/30min)
  rate_display: string;   // Display string (e.g., "$35/30min")
  calculated_amount: number;
  session_id: string | null; // If set, this is a combined session
  is_combined_session: boolean;
  override_amount: number | null; // Manual override for edge cases
}

/**
 * Invoice preview data before creating the payment
 */
export interface InvoicePreview {
  parent_id: string;
  parent_name: string;
  month: string;
  lessons: LessonForInvoice[];
  total_amount: number;
  total_lessons: number;
  total_minutes: number;
}

/**
 * Fetch completed lessons for a parent in a given month that haven't been invoiced yet
 * @param parentId - Parent UUID
 * @param month - Date object for the month to fetch
 * @returns List of uninvoiced completed lessons with calculated amounts
 */
export function useUninvoicedLessons(parentId: string | null, month?: Date) {
  const [data, setData] = useState<LessonForInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const targetMonth = month || new Date();
  const monthStart = getMonthStart(targetMonth);
  const monthEnd = getMonthEnd(targetMonth);

  const fetchLessons = useCallback(async () => {
    if (!parentId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First, get all students for this parent with their rates
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id, name, hourly_rate, subject_rates')
        .eq('parent_id', parentId);

      if (studentsError) {
        throw new Error(studentsError.message);
      }

      if (!students || students.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      const studentIds = students.map(s => s.id);
      const studentMap = new Map(students.map(s => [s.id, s]));

      // Get tutor settings for rate calculation
      const { data: tutorSettings } = await supabase
        .from('tutor_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      // Default rates if no tutor settings exist
      const defaultRate = tutorSettings?.default_rate || 45;
      const defaultBaseDuration = tutorSettings?.default_base_duration || 60;
      const tutorSubjectRates = (tutorSettings?.subject_rates as SubjectRates) || {};

      // Get completed lessons for these students in the month (include session_id and override_amount)
      const { data: lessons, error: lessonsError } = await supabase
        .from('scheduled_lessons')
        .select('id, student_id, subject, scheduled_at, duration_min, session_id, override_amount')
        .in('student_id', studentIds)
        .eq('status', 'completed')
        .gte('scheduled_at', monthStart)
        .lte('scheduled_at', monthEnd + 'T23:59:59.999Z')
        .order('scheduled_at', { ascending: true });

      if (lessonsError) {
        throw new Error(lessonsError.message);
      }

      if (!lessons || lessons.length === 0) {
        setData([]);
        setLoading(false);
        return;
      }

      // Get already invoiced lesson IDs
      const { data: invoicedLessons, error: invoicedError } = await supabase
        .from('payment_lessons')
        .select('lesson_id')
        .in('lesson_id', lessons.map(l => l.id));

      if (invoicedError) {
        throw new Error(invoicedError.message);
      }

      const invoicedLessonIds = new Set((invoicedLessons || []).map(il => il.lesson_id));

      // Helper to format rate display
      const formatRateDisplay = (rate: number, baseDuration: number): string => {
        if (baseDuration === 60) {
          return `$${rate}/hr`;
        }
        return `$${rate}/${baseDuration}min`;
      };

      // Filter out already invoiced lessons and calculate amounts
      // Combined sessions now use duration-based subject rates (same as regular lessons)
      const uninvoicedLessons: LessonForInvoice[] = lessons
        .filter(lesson => !invoicedLessonIds.has(lesson.id))
        .map(lesson => {
          const student = studentMap.get(lesson.student_id);
          const isCombinedSession = lesson.session_id !== null;

          // If override_amount is set, use it directly
          if (lesson.override_amount !== null && lesson.override_amount !== undefined) {
            return {
              id: lesson.id,
              student_id: lesson.student_id,
              student_name: student?.name || 'Unknown',
              subject: lesson.subject as TutoringSubject,
              scheduled_at: lesson.scheduled_at,
              duration_min: lesson.duration_min,
              rate: 0,
              base_duration: 0,
              rate_display: 'Override',
              calculated_amount: lesson.override_amount,
              session_id: lesson.session_id,
              is_combined_session: isCombinedSession,
              override_amount: lesson.override_amount,
            };
          }

          // Use duration-based subject rates for ALL lessons (including combined sessions)
          let rate: number;
          let baseDuration: number;

          const subjectRateConfig = tutorSubjectRates[lesson.subject as keyof SubjectRates];
          if (subjectRateConfig && subjectRateConfig.rate > 0 && subjectRateConfig.base_duration > 0) {
            rate = subjectRateConfig.rate;
            baseDuration = subjectRateConfig.base_duration;
          } else {
            rate = defaultRate;
            baseDuration = defaultBaseDuration;
          }

          // Calculate: (lesson duration / base duration) * rate
          const calculatedAmount = (lesson.duration_min / baseDuration) * rate;
          const rateDisplay = formatRateDisplay(rate, baseDuration);

          return {
            id: lesson.id,
            student_id: lesson.student_id,
            student_name: student?.name || 'Unknown',
            subject: lesson.subject as TutoringSubject,
            scheduled_at: lesson.scheduled_at,
            duration_min: lesson.duration_min,
            rate: rate,
            base_duration: baseDuration,
            rate_display: rateDisplay,
            calculated_amount: Math.round(calculatedAmount * 100) / 100, // Round to 2 decimal places
            session_id: lesson.session_id,
            is_combined_session: isCombinedSession,
            override_amount: null,
          };
        });

      setData(uninvoicedLessons);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch uninvoiced lessons');
      setError(errorMessage);
      console.error('useUninvoicedLessons error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parentId, monthStart, monthEnd]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  return { data, loading, error, refetch: fetchLessons };
}

/**
 * Generate invoice preview for a parent in a given month
 * This calculates the total amount based on completed lessons and student rates
 */
export function useInvoicePreview(parentId: string | null, month?: Date) {
  const { data: lessons, loading: lessonsLoading, error: lessonsError, refetch } = useUninvoicedLessons(parentId, month);
  const [parentName, setParentName] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const targetMonth = month || new Date();
  const monthStart = getMonthStart(targetMonth);

  // Fetch parent name
  useEffect(() => {
    async function fetchParent() {
      if (!parentId) {
        setParentName('');
        setLoading(false);
        return;
      }

      const { data: parent } = await supabase
        .from('parents')
        .select('name')
        .eq('id', parentId)
        .single();

      setParentName(parent?.name || 'Unknown');
      setLoading(false);
    }

    fetchParent();
  }, [parentId]);

  const preview: InvoicePreview | null = parentId ? {
    parent_id: parentId,
    parent_name: parentName,
    month: monthStart,
    lessons,
    total_amount: lessons.reduce((sum, l) => sum + l.calculated_amount, 0),
    total_lessons: lessons.length,
    total_minutes: lessons.reduce((sum, l) => sum + l.duration_min, 0),
  } : null;

  return {
    preview,
    loading: loading || lessonsLoading,
    error: lessonsError,
    refetch,
  };
}

/**
 * Hook for generating an invoice (creating payment with linked lessons)
 * @returns Mutation state with generateInvoice function
 */
export function useGenerateInvoice() {
  const [data, setData] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (
    parentId: string,
    month: string,
    lessons: LessonForInvoice[],
    notes?: string
  ): Promise<Payment | null> => {
    try {
      setLoading(true);
      setError(null);

      if (lessons.length === 0) {
        throw new Error('No lessons to invoice');
      }

      const totalAmount = lessons.reduce((sum, l) => sum + l.calculated_amount, 0);
      const roundedTotal = Math.round(totalAmount * 100) / 100;

      // Create the payment record
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          parent_id: parentId,
          month,
          amount_due: roundedTotal,
          amount_paid: 0,
          status: 'unpaid' as PaymentStatus,
          notes: notes || `Auto-generated invoice for ${lessons.length} lesson(s)`,
        })
        .select()
        .single();

      if (paymentError) {
        // Check if it's a duplicate month error
        if (paymentError.code === '23505') {
          throw new Error('A payment record already exists for this family and month. Please edit the existing payment instead.');
        }
        throw new Error(paymentError.message);
      }

      // Create payment_lessons records to link the lessons
      const paymentLessons = lessons.map(lesson => ({
        payment_id: payment.id,
        lesson_id: lesson.id,
        amount: lesson.calculated_amount,
      }));

      const { error: linkError } = await supabase
        .from('payment_lessons')
        .insert(paymentLessons);

      if (linkError) {
        // If linking fails, delete the payment to maintain consistency
        await supabase.from('payments').delete().eq('id', payment.id);
        throw new Error(`Failed to link lessons: ${linkError.message}`);
      }

      setData(payment);
      return payment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to generate invoice');
      setError(errorMessage);
      console.error('useGenerateInvoice error:', errorMessage);
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
 * Fetch payment with linked lesson details
 * @param paymentId - Payment UUID
 * @returns Payment with parent and linked lessons
 */
export function usePaymentWithLessons(paymentId: string | null): QueryState<PaymentWithDetails> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<PaymentWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPayment = useCallback(async () => {
    if (!paymentId) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch the payment with parent
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .select(`
          *,
          parent:parents(
            *,
            students(*)
          )
        `)
        .eq('id', paymentId)
        .single();

      if (paymentError) {
        throw new Error(paymentError.message);
      }

      // Fetch linked lessons
      const { data: paymentLessons, error: lessonsError } = await supabase
        .from('payment_lessons')
        .select(`
          *,
          lesson:scheduled_lessons(
            *,
            student:students(
              *,
              parent:parents(*)
            )
          )
        `)
        .eq('payment_id', paymentId);

      if (lessonsError) {
        throw new Error(lessonsError.message);
      }

      setData({
        ...payment,
        payment_lessons: paymentLessons || [],
      } as PaymentWithDetails);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch payment details');
      setError(errorMessage);
      console.error('usePaymentWithLessons error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    fetchPayment();
  }, [fetchPayment]);

  return { data, loading, error, refetch: fetchPayment };
}

// ============================================================================
// MONTHLY LESSON SUMMARY (Hybrid Payment Approach)
// ============================================================================

/**
 * Individual lesson detail with rate calculation breakdown
 */
export interface LessonDetail {
  id: string;
  student_id: string;
  student_name: string;
  subject: TutoringSubject;
  scheduled_at: string;
  duration_min: number;
  status: 'scheduled' | 'completed' | 'cancelled';
  payment_status: 'none' | 'invoiced' | 'paid';
  is_combined_session: boolean;
  session_id: string | null;
  // Rate calculation details
  rate: number;
  base_duration: number;
  rate_display: string;
  calculated_amount: number;
  calculation_formula: string; // e.g., "30min / 30min * $35 = $35"
  // Override for edge cases (Option B)
  override_amount: number | null; // When set, overrides calculated amount
}

/**
 * Summary of a family's lessons for a month
 */
export interface FamilyLessonSummary {
  parent_id: string;
  parent_name: string;
  // Lesson counts
  scheduled_count: number;  // Scheduled lessons (not yet completed)
  completed_count: number;  // Completed lessons (not yet invoiced)
  invoiced_count: number;   // Invoiced lessons (in pending/partial payment)
  paid_count: number;       // Paid lessons (in paid payment)
  cancelled_count: number;  // Cancelled lessons
  // Amount calculations
  expected_amount: number;  // All scheduled + completed (potential earnings)
  billable_amount: number;  // Completed but not invoiced (ready to invoice)
  invoiced_amount: number;  // Amount in pending/partial payments
  collected_amount: number; // Amount in paid payments
  // Combined session tracking
  combined_session_count: number;
  combined_session_amount: number;
  // Detailed lesson breakdown
  lessons: LessonDetail[];
}

/**
 * Overall monthly summary across all families
 */
export interface MonthlyLessonSummary {
  month: string;
  families: FamilyLessonSummary[];
  totals: {
    scheduled_count: number;
    completed_count: number;
    invoiced_count: number;
    paid_count: number;
    cancelled_count: number;
    expected_amount: number;
    billable_amount: number;
    invoiced_amount: number;
    collected_amount: number;
    combined_session_count: number;
    combined_session_amount: number;
  };
}

/**
 * Rate calculation result with breakdown details
 */
interface RateCalculationResult {
  amount: number;
  rate: number;
  baseDuration: number;
  rateDisplay: string;
  formula: string;
}

/**
 * Calculate lesson amount based on tutor settings
 * Supports duration-based rates for all lessons (including combined sessions)
 * Combined sessions now use the same subject rate calculation as regular lessons
 * Override amount can be provided to manually set the price for edge cases
 * Returns detailed breakdown for transparency
 */
function calculateLessonAmountWithDetails(
  tutorSettings: TutorSettings | null,
  subject: TutoringSubject,
  durationMin: number,
  isCombinedSession: boolean,
  overrideAmount?: number | null
): RateCalculationResult {
  const defaultRate = 45;
  const defaultBaseDuration = 60;

  // If override amount is set, use it directly
  if (overrideAmount !== undefined && overrideAmount !== null) {
    return {
      amount: overrideAmount,
      rate: 0,
      baseDuration: 0,
      rateDisplay: 'Override',
      formula: `Manual override = $${overrideAmount.toFixed(2)}`,
    };
  }

  // Use duration-based subject rates for ALL lessons (including combined sessions)
  let rate: number;
  let baseDuration: number;
  let rateSource: string;

  const subjectRates = tutorSettings?.subject_rates;
  if (subjectRates && subject in subjectRates) {
    const rateConfig = subjectRates[subject as keyof SubjectRates];
    if (rateConfig && rateConfig.rate > 0 && rateConfig.base_duration > 0) {
      rate = rateConfig.rate;
      baseDuration = rateConfig.base_duration;
      rateSource = `${subject} rate`;
    } else {
      rate = tutorSettings?.default_rate ?? defaultRate;
      baseDuration = tutorSettings?.default_base_duration ?? defaultBaseDuration;
      rateSource = 'default rate';
    }
  } else {
    rate = tutorSettings?.default_rate ?? defaultRate;
    baseDuration = tutorSettings?.default_base_duration ?? defaultBaseDuration;
    rateSource = 'default rate';
  }

  const amount = (durationMin / baseDuration) * rate;
  const rateDisplay = baseDuration === 60 ? `$${rate}/hr` : `$${rate}/${baseDuration}min`;
  const sessionType = isCombinedSession ? ' (combined session)' : '';
  const formula = `${durationMin}min / ${baseDuration}min × $${rate} = $${amount.toFixed(2)} (${rateSource}${sessionType})`;

  return {
    amount,
    rate,
    baseDuration,
    rateDisplay,
    formula,
  };
}

/**
 * Simple amount calculation (for backward compatibility)
 */
function calculateLessonAmountFromSettings(
  tutorSettings: TutorSettings | null,
  subject: TutoringSubject,
  durationMin: number,
  isCombinedSession: boolean,
  overrideAmount?: number | null
): number {
  return calculateLessonAmountWithDetails(tutorSettings, subject, durationMin, isCombinedSession, overrideAmount).amount;
}

/**
 * Hook for fetching monthly lesson summary with expected/completed/invoiced/paid tracking
 * This is the core hook for the hybrid payment approach
 *
 * @param month - Optional Date object (defaults to current month)
 * @returns Monthly summary with per-family breakdowns
 */
export function useMonthlyLessonSummary(month?: Date) {
  const [data, setData] = useState<MonthlyLessonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const targetMonth = month || new Date();
  const monthStart = getMonthStart(targetMonth);
  const monthEnd = getMonthEnd(targetMonth);

  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch tutor settings for rate calculation
      const { data: tutorSettings } = await supabase
        .from('tutor_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      // 2. Fetch all parents with students
      const { data: parents, error: parentsError } = await supabase
        .from('parents')
        .select('id, name, students(id, name)');

      if (parentsError) throw new Error(parentsError.message);
      if (!parents || parents.length === 0) {
        setData({
          month: monthStart,
          families: [],
          totals: {
            scheduled_count: 0,
            completed_count: 0,
            invoiced_count: 0,
            paid_count: 0,
            cancelled_count: 0,
            expected_amount: 0,
            billable_amount: 0,
            invoiced_amount: 0,
            collected_amount: 0,
            combined_session_count: 0,
            combined_session_amount: 0,
          },
        });
        return;
      }

      // Create parent-to-students map
      const parentMap = new Map<string, { name: string; studentIds: string[] }>();
      const studentToParentMap = new Map<string, string>();

      parents.forEach((parent: { id: string; name: string; students: { id: string; name: string }[] }) => {
        const studentIds = parent.students?.map((s: { id: string }) => s.id) || [];
        parentMap.set(parent.id, { name: parent.name, studentIds });
        studentIds.forEach((sid: string) => studentToParentMap.set(sid, parent.id));
      });

      const allStudentIds = Array.from(studentToParentMap.keys());

      if (allStudentIds.length === 0) {
        setData({
          month: monthStart,
          families: [],
          totals: {
            scheduled_count: 0,
            completed_count: 0,
            invoiced_count: 0,
            paid_count: 0,
            cancelled_count: 0,
            expected_amount: 0,
            billable_amount: 0,
            invoiced_amount: 0,
            collected_amount: 0,
            combined_session_count: 0,
            combined_session_amount: 0,
          },
        });
        return;
      }

      // 3. Fetch all lessons for this month (including override_amount for edge cases)
      const { data: lessons, error: lessonsError } = await supabase
        .from('scheduled_lessons')
        .select('id, student_id, subject, scheduled_at, duration_min, status, session_id, override_amount')
        .in('student_id', allStudentIds)
        .gte('scheduled_at', monthStart)
        .lte('scheduled_at', monthEnd + 'T23:59:59.999Z');

      if (lessonsError) throw new Error(lessonsError.message);

      // 4. Fetch all payments for this month with linked lessons
      const { data: payments, error: paymentsError } = await supabase
        .from('payments')
        .select(`
          id, parent_id, amount_due, amount_paid, status,
          payment_lessons:payment_lessons(lesson_id, amount)
        `)
        .eq('month', monthStart);

      if (paymentsError) throw new Error(paymentsError.message);

      // Create maps for payment status lookup
      const invoicedLessonIds = new Set<string>();
      const paidLessonIds = new Set<string>();
      const lessonPaymentAmounts = new Map<string, number>();

      (payments || []).forEach((payment: {
        id: string;
        parent_id: string;
        status: PaymentStatus;
        payment_lessons: { lesson_id: string; amount: number }[]
      }) => {
        (payment.payment_lessons || []).forEach((pl: { lesson_id: string; amount: number }) => {
          lessonPaymentAmounts.set(pl.lesson_id, pl.amount);
          if (payment.status === 'paid') {
            paidLessonIds.add(pl.lesson_id);
          } else {
            invoicedLessonIds.add(pl.lesson_id);
          }
        });
      });

      // 5. Calculate per-family summaries
      const familySummaries = new Map<string, FamilyLessonSummary>();

      // Create student id to name mapping
      const studentIdToName = new Map<string, string>();
      parents.forEach((parent: { id: string; name: string; students: { id: string; name: string }[] }) => {
        (parent.students || []).forEach((s: { id: string; name: string }) => {
          studentIdToName.set(s.id, s.name);
        });
      });

      // Initialize summaries for all parents
      parentMap.forEach((parentInfo, parentId) => {
        familySummaries.set(parentId, {
          parent_id: parentId,
          parent_name: parentInfo.name,
          scheduled_count: 0,
          completed_count: 0,
          invoiced_count: 0,
          paid_count: 0,
          cancelled_count: 0,
          expected_amount: 0,
          billable_amount: 0,
          invoiced_amount: 0,
          collected_amount: 0,
          combined_session_count: 0,
          combined_session_amount: 0,
          lessons: [],
        });
      });

      // Track combined sessions to avoid double counting
      const processedSessionIds = new Set<string>();

      // Process each lesson
      (lessons || []).forEach((lesson: {
        id: string;
        student_id: string;
        subject: TutoringSubject;
        scheduled_at: string;
        duration_min: number;
        status: 'scheduled' | 'completed' | 'cancelled';
        session_id: string | null;
        override_amount: number | null;
      }) => {
        const parentId = studentToParentMap.get(lesson.student_id);
        if (!parentId) return;

        const summary = familySummaries.get(parentId);
        if (!summary) return;

        const isCombinedSession = lesson.session_id !== null;
        const rateCalc = calculateLessonAmountWithDetails(
          tutorSettings as TutorSettings | null,
          lesson.subject,
          lesson.duration_min,
          isCombinedSession,
          lesson.override_amount
        );
        const amount = rateCalc.amount;

        // Determine payment status
        let paymentStatus: 'none' | 'invoiced' | 'paid' = 'none';
        if (paidLessonIds.has(lesson.id)) {
          paymentStatus = 'paid';
        } else if (invoicedLessonIds.has(lesson.id)) {
          paymentStatus = 'invoiced';
        }

        // Add lesson detail
        const lessonDetail: LessonDetail = {
          id: lesson.id,
          student_id: lesson.student_id,
          student_name: studentIdToName.get(lesson.student_id) || 'Unknown',
          subject: lesson.subject,
          scheduled_at: lesson.scheduled_at,
          duration_min: lesson.duration_min,
          status: lesson.status,
          payment_status: paymentStatus,
          is_combined_session: isCombinedSession,
          session_id: lesson.session_id,
          rate: rateCalc.rate,
          base_duration: rateCalc.baseDuration,
          rate_display: rateCalc.rateDisplay,
          calculated_amount: Math.round(amount * 100) / 100,
          calculation_formula: rateCalc.formula,
          override_amount: lesson.override_amount,
        };
        summary.lessons.push(lessonDetail);

        // Track combined sessions
        if (isCombinedSession && !processedSessionIds.has(lesson.session_id!)) {
          processedSessionIds.add(lesson.session_id!);
          summary.combined_session_count++;
        }

        if (isCombinedSession) {
          summary.combined_session_amount += amount;
        }

        // Categorize by status and payment state
        if (lesson.status === 'cancelled') {
          summary.cancelled_count++;
        } else if (lesson.status === 'scheduled') {
          summary.scheduled_count++;
          summary.expected_amount += amount;
        } else if (lesson.status === 'completed') {
          if (paidLessonIds.has(lesson.id)) {
            summary.paid_count++;
            summary.collected_amount += lessonPaymentAmounts.get(lesson.id) || amount;
          } else if (invoicedLessonIds.has(lesson.id)) {
            summary.invoiced_count++;
            summary.invoiced_amount += lessonPaymentAmounts.get(lesson.id) || amount;
          } else {
            summary.completed_count++;
            summary.billable_amount += amount;
          }
          // Expected includes all non-cancelled lessons
          summary.expected_amount += amount;
        }
      });

      // Sort lessons by scheduled_at within each family
      familySummaries.forEach((summary) => {
        summary.lessons.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
      });

      // 6. Calculate totals
      const totals = {
        scheduled_count: 0,
        completed_count: 0,
        invoiced_count: 0,
        paid_count: 0,
        cancelled_count: 0,
        expected_amount: 0,
        billable_amount: 0,
        invoiced_amount: 0,
        collected_amount: 0,
        combined_session_count: 0,
        combined_session_amount: 0,
      };

      const familyArray = Array.from(familySummaries.values());
      familyArray.forEach((family) => {
        totals.scheduled_count += family.scheduled_count;
        totals.completed_count += family.completed_count;
        totals.invoiced_count += family.invoiced_count;
        totals.paid_count += family.paid_count;
        totals.cancelled_count += family.cancelled_count;
        totals.expected_amount += family.expected_amount;
        totals.billable_amount += family.billable_amount;
        totals.invoiced_amount += family.invoiced_amount;
        totals.collected_amount += family.collected_amount;
        totals.combined_session_count += family.combined_session_count;
        totals.combined_session_amount += family.combined_session_amount;
      });

      // Round amounts to 2 decimal places
      totals.expected_amount = Math.round(totals.expected_amount * 100) / 100;
      totals.billable_amount = Math.round(totals.billable_amount * 100) / 100;
      totals.invoiced_amount = Math.round(totals.invoiced_amount * 100) / 100;
      totals.collected_amount = Math.round(totals.collected_amount * 100) / 100;
      totals.combined_session_amount = Math.round(totals.combined_session_amount * 100) / 100;

      familyArray.forEach((family) => {
        family.expected_amount = Math.round(family.expected_amount * 100) / 100;
        family.billable_amount = Math.round(family.billable_amount * 100) / 100;
        family.invoiced_amount = Math.round(family.invoiced_amount * 100) / 100;
        family.collected_amount = Math.round(family.collected_amount * 100) / 100;
        family.combined_session_amount = Math.round(family.combined_session_amount * 100) / 100;
      });

      // Filter out families with no lessons
      const activeFamilies = familyArray.filter(
        (f) =>
          f.scheduled_count > 0 ||
          f.completed_count > 0 ||
          f.invoiced_count > 0 ||
          f.paid_count > 0 ||
          f.cancelled_count > 0
      );

      setData({
        month: monthStart,
        families: activeFamilies,
        totals,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch monthly summary');
      setError(errorMessage);
      console.error('useMonthlyLessonSummary error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [monthStart, monthEnd]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return { data, loading, error, refetch: fetchSummary };
}

/**
 * Hook for quick invoice generation for a specific family
 * Generates invoice for all completed but uninvoiced lessons
 */
export function useQuickInvoice() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generateQuickInvoice = useCallback(async (
    parentId: string,
    month: Date
  ): Promise<Payment | null> => {
    try {
      setLoading(true);
      setError(null);

      const monthStart = getMonthStart(month);
      const monthEnd = getMonthEnd(month);

      // Check if payment already exists for this month
      const { data: existingPayment } = await supabase
        .from('payments')
        .select('id')
        .eq('parent_id', parentId)
        .eq('month', monthStart)
        .maybeSingle();

      if (existingPayment) {
        throw new Error('A payment record already exists for this family and month');
      }

      // Get tutor settings
      const { data: tutorSettings } = await supabase
        .from('tutor_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      // Get student IDs for this parent
      const { data: students, error: studentsError } = await supabase
        .from('students')
        .select('id')
        .eq('parent_id', parentId);

      if (studentsError) throw new Error(studentsError.message);
      if (!students || students.length === 0) {
        throw new Error('No students found for this parent');
      }

      const studentIds = students.map((s: { id: string }) => s.id);

      // Get completed lessons that aren't invoiced (include override_amount)
      const { data: lessons, error: lessonsError } = await supabase
        .from('scheduled_lessons')
        .select('id, student_id, subject, duration_min, session_id, override_amount')
        .in('student_id', studentIds)
        .eq('status', 'completed')
        .gte('scheduled_at', monthStart)
        .lte('scheduled_at', monthEnd + 'T23:59:59.999Z');

      if (lessonsError) throw new Error(lessonsError.message);
      if (!lessons || lessons.length === 0) {
        throw new Error('No uninvoiced lessons found for this month');
      }

      // Get already invoiced lessons
      const { data: invoicedLessons } = await supabase
        .from('payment_lessons')
        .select('lesson_id')
        .in('lesson_id', lessons.map((l: { id: string }) => l.id));

      const invoicedLessonIds = new Set((invoicedLessons || []).map((il: { lesson_id: string }) => il.lesson_id));

      // Filter to uninvoiced lessons and calculate amounts
      const uninvoicedLessons = lessons.filter((l: { id: string }) => !invoicedLessonIds.has(l.id));

      if (uninvoicedLessons.length === 0) {
        throw new Error('All completed lessons are already invoiced');
      }

      const lessonAmounts = uninvoicedLessons.map((lesson: {
        id: string;
        subject: TutoringSubject;
        duration_min: number;
        session_id: string | null;
        override_amount: number | null;
      }) => ({
        lesson_id: lesson.id,
        amount: calculateLessonAmountFromSettings(
          tutorSettings as TutorSettings | null,
          lesson.subject,
          lesson.duration_min,
          lesson.session_id !== null,
          lesson.override_amount
        ),
      }));

      const totalAmount = lessonAmounts.reduce((sum: number, l: { amount: number }) => sum + l.amount, 0);
      const roundedTotal = Math.round(totalAmount * 100) / 100;

      // Create payment
      const { data: payment, error: paymentError } = await supabase
        .from('payments')
        .insert({
          parent_id: parentId,
          month: monthStart,
          amount_due: roundedTotal,
          amount_paid: 0,
          status: 'unpaid' as PaymentStatus,
          notes: `Quick invoice for ${uninvoicedLessons.length} lesson(s)`,
        })
        .select()
        .single();

      if (paymentError) throw new Error(paymentError.message);

      // Link lessons to payment
      const paymentLessons = lessonAmounts.map((la: { lesson_id: string; amount: number }) => ({
        payment_id: payment.id,
        lesson_id: la.lesson_id,
        amount: Math.round(la.amount * 100) / 100,
      }));

      const { error: linkError } = await supabase
        .from('payment_lessons')
        .insert(paymentLessons);

      if (linkError) {
        // Rollback payment on link failure
        await supabase.from('payments').delete().eq('id', payment.id);
        throw new Error(`Failed to link lessons: ${linkError.message}`);
      }

      return payment;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to generate quick invoice');
      setError(errorMessage);
      console.error('useQuickInvoice error:', errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { loading, error, generateQuickInvoice, reset };
}
