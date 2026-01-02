/**
 * usePayments Hook
 * Data fetching hooks for payment tracking in Love2Learn tutoring app
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  Payment,
  PaymentWithParent,
  CreatePaymentInput,
  UpdatePaymentInput,
  ListQueryState,
  QueryState,
  PaymentStatus,
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
