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
  PaymentLesson,
  CreatePaymentInput,
  UpdatePaymentInput,
  ListQueryState,
  QueryState,
  PaymentStatus,
  ScheduledLessonWithStudent,
  TutoringSubject,
  SubjectRates,
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
 * Calculate the hourly rate for a student's subject
 * Uses subject-specific rate if available, otherwise falls back to default hourly rate
 */
function getStudentSubjectRate(
  hourlyRate: number,
  subjectRates: SubjectRates | null | undefined,
  subject: TutoringSubject
): number {
  if (subjectRates && subject in subjectRates) {
    const rate = subjectRates[subject as keyof SubjectRates];
    if (rate !== undefined && rate > 0) {
      return rate;
    }
  }
  return hourlyRate || 50; // Default to $50/hour if no rate set
}

/**
 * Calculate the amount for a lesson based on duration and hourly rate
 */
function calculateLessonAmount(
  durationMin: number,
  hourlyRate: number,
  subjectRates: SubjectRates | null | undefined,
  subject: TutoringSubject
): number {
  const rate = getStudentSubjectRate(hourlyRate, subjectRates, subject);
  return (durationMin / 60) * rate;
}

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
      const combinedSessionRate = tutorSettings?.combined_session_rate || 40;

      // Get completed lessons for these students in the month (include session_id)
      const { data: lessons, error: lessonsError } = await supabase
        .from('scheduled_lessons')
        .select('id, student_id, subject, scheduled_at, duration_min, session_id')
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
      const uninvoicedLessons: LessonForInvoice[] = lessons
        .filter(lesson => !invoicedLessonIds.has(lesson.id))
        .map(lesson => {
          const student = studentMap.get(lesson.student_id);
          const isCombinedSession = lesson.session_id !== null;

          // For combined sessions, use flat rate; for single lessons, use duration-based rate
          let calculatedAmount: number;
          let rate: number;
          let baseDuration: number;
          let rateDisplay: string;

          if (isCombinedSession) {
            // Flat rate per student for combined sessions
            calculatedAmount = combinedSessionRate;
            rate = combinedSessionRate;
            baseDuration = 0; // Not applicable for flat rate
            rateDisplay = `$${combinedSessionRate}/session`;
          } else {
            // Use tutor subject rates first, then default
            const subjectRateConfig = tutorSubjectRates[lesson.subject as keyof SubjectRates];
            if (subjectRateConfig && subjectRateConfig.rate > 0 && subjectRateConfig.base_duration > 0) {
              rate = subjectRateConfig.rate;
              baseDuration = subjectRateConfig.base_duration;
            } else {
              rate = defaultRate;
              baseDuration = defaultBaseDuration;
            }
            // Calculate: (lesson duration / base duration) * rate
            calculatedAmount = (lesson.duration_min / baseDuration) * rate;
            rateDisplay = formatRateDisplay(rate, baseDuration);
          }

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
