/**
 * usePaymentReminders Hook
 * Data fetching and mutation hooks for payment reminder tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  PaymentReminder,
  PaymentReminderType,
  SendPaymentReminderInput,
  SendPaymentReminderResponse,
  ReminderHistorySummary,
  ListQueryState,
} from '../types/database';

/**
 * Fetch payment reminders for a specific payment
 * @param paymentId - Payment UUID
 * @returns List of reminders for the payment
 */
export function usePaymentReminders(paymentId: string | undefined): ListQueryState<PaymentReminder> {
  const [data, setData] = useState<PaymentReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReminders = useCallback(async () => {
    if (!paymentId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: reminders, error: fetchError } = await supabase
        .from('payment_reminders')
        .select('*')
        .eq('payment_id', paymentId)
        .order('sent_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((reminders as PaymentReminder[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch reminders');
      setError(errorMessage);
      console.error('usePaymentReminders error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  return { data, loading, error, refetch: fetchReminders };
}

/**
 * Fetch all reminders for a list of payment IDs (for batch display)
 * @param paymentIds - Array of payment UUIDs
 * @returns Map of payment ID to reminder array
 */
export function usePaymentRemindersBatch(paymentIds: string[]): {
  data: Map<string, PaymentReminder[]>;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<Map<string, PaymentReminder[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchReminders = useCallback(async () => {
    if (paymentIds.length === 0) {
      setData(new Map());
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: reminders, error: fetchError } = await supabase
        .from('payment_reminders')
        .select('*')
        .in('payment_id', paymentIds)
        .order('sent_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // Group reminders by payment_id
      const reminderMap = new Map<string, PaymentReminder[]>();
      (reminders || []).forEach((reminder: PaymentReminder) => {
        const existing = reminderMap.get(reminder.payment_id) || [];
        existing.push(reminder);
        reminderMap.set(reminder.payment_id, existing);
      });

      setData(reminderMap);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch reminders');
      setError(errorMessage);
      console.error('usePaymentRemindersBatch error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [paymentIds.join(',')]);

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  return { data, loading, error, refetch: fetchReminders };
}

/**
 * Get reminder history summary for a payment
 * @param paymentId - Payment UUID
 * @returns Summary of reminder history
 */
export function useReminderHistory(paymentId: string | undefined): {
  summary: ReminderHistorySummary | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
} {
  const { data: reminders, loading, error, refetch } = usePaymentReminders(paymentId);

  const summary: ReminderHistorySummary | null = reminders.length > 0
    ? {
        totalReminders: reminders.length,
        lastReminderSent: reminders[0]?.sent_at || null,
        lastReminderType: reminders[0]?.reminder_type || null,
        remindersByType: reminders.reduce((acc, r) => {
          acc[r.reminder_type] = (acc[r.reminder_type] || 0) + 1;
          return acc;
        }, {} as Record<PaymentReminderType, number>),
      }
    : null;

  return { summary, loading, error, refetch };
}

/**
 * Check if a reminder of a specific type can be sent today
 * @param paymentId - Payment UUID
 * @param reminderType - Type of reminder to check
 * @returns Whether the reminder can be sent
 */
export function useCanSendReminder(
  paymentId: string | undefined,
  reminderType: PaymentReminderType
): {
  canSend: boolean;
  reason: string | null;
  loading: boolean;
} {
  const [canSend, setCanSend] = useState(true);
  const [reason, setReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkCanSend = async () => {
      if (!paymentId) {
        setCanSend(false);
        setReason('No payment selected');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const today = new Date().toISOString().split('T')[0];

        const { data: existingReminders, error } = await supabase
          .from('payment_reminders')
          .select('id')
          .eq('payment_id', paymentId)
          .eq('reminder_type', reminderType)
          .gte('sent_at', `${today}T00:00:00`)
          .lt('sent_at', `${today}T23:59:59`);

        if (error) {
          console.error('Error checking reminder:', error);
          setCanSend(true);
          setReason(null);
        } else if (existingReminders && existingReminders.length > 0) {
          setCanSend(false);
          setReason('Already sent today');
        } else {
          setCanSend(true);
          setReason(null);
        }
      } catch (err) {
        console.error('Error in useCanSendReminder:', err);
        setCanSend(true);
        setReason(null);
      } finally {
        setLoading(false);
      }
    };

    checkCanSend();
  }, [paymentId, reminderType]);

  return { canSend, reason, loading };
}

/**
 * Send a payment reminder via the edge function
 */
export function useSendPaymentReminder(): {
  sendReminder: (input: SendPaymentReminderInput) => Promise<SendPaymentReminderResponse>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendReminder = useCallback(async (input: SendPaymentReminderInput): Promise<SendPaymentReminderResponse> => {
    try {
      setLoading(true);
      setError(null);

      const response = await supabase.functions.invoke('send-payment-reminder', {
        body: {
          payment_id: input.payment_id,
          reminder_type: input.reminder_type,
          custom_message: input.custom_message,
        },
      });

      if (response.error) {
        throw new Error(response.error.message);
      }

      const data = response.data as SendPaymentReminderResponse;

      // Check for duplicate error from server
      if (data.duplicate) {
        return {
          success: false,
          message: data.message || 'Reminder already sent today',
          duplicate: true,
        };
      }

      return data;
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Failed to send reminder');
      setError(errorObj);
      console.error('useSendPaymentReminder error:', errorObj);
      return {
        success: false,
        message: errorObj.message,
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return { sendReminder, loading, error };
}

/**
 * Helper to format relative time for last reminder
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor(diffMs / (1000 * 60));

  if (diffMins < 1) {
    return 'Just now';
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
