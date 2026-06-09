/**
 * useWaitingList Hook
 * Data hooks for the tutor waiting list (prospective-parent inquiries),
 * plus a public submit helper that calls the submit-inquiry edge function.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  WaitingListEntry,
  WaitingListStatus,
  CreateWaitingListInput,
  UpdateWaitingListInput,
  ListQueryState,
} from '../types/database';

export interface WaitingListFilterOptions {
  status?: WaitingListStatus;
  statuses?: WaitingListStatus[];
}

/**
 * Fetch waiting-list entries for the current tutor (RLS scopes to own rows).
 */
export function useWaitingList(
  options: WaitingListFilterOptions = {}
): ListQueryState<WaitingListEntry> {
  const [data, setData] = useState<WaitingListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { status } = options;
  // Serialize the array so the callback dependency is stable.
  const statusesKey = options.statuses ? options.statuses.join(',') : '';

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('waiting_list')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      } else if (statusesKey) {
        query = query.in('status', statusesKey.split(','));
      }

      const { data: rows, error: fetchError } = await query;
      if (fetchError) {
        throw new Error(fetchError.message);
      }
      setData((rows as WaitingListEntry[]) || []);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to fetch waiting list');
      setError(e);
      console.error('useWaitingList error:', e);
    } finally {
      setLoading(false);
    }
  }, [status, statusesKey]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  return { data, loading, error, refetch: fetchEntries };
}

/**
 * Count of 'new' (unreviewed) inquiries — for the tab badge.
 */
export function useNewInquiriesCount(): {
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
      const { count: c, error: countError } = await supabase
        .from('waiting_list')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'new');
      if (countError) {
        throw new Error(countError.message);
      }
      setCount(c || 0);
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to count inquiries');
      setError(e);
      console.error('useNewInquiriesCount error:', e);
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
 * Update an entry's status and/or notes (tutor only; RLS-enforced).
 */
export function useUpdateWaitingListEntry(): {
  updateEntry: (
    id: string,
    input: UpdateWaitingListInput
  ) => Promise<WaitingListEntry | null>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const updateEntry = useCallback(
    async (id: string, input: UpdateWaitingListInput): Promise<WaitingListEntry | null> => {
      try {
        setLoading(true);
        setError(null);
        const { data, error: updateError } = await supabase
          .from('waiting_list')
          .update(input)
          .eq('id', id)
          .select()
          .single();
        if (updateError) {
          throw new Error(updateError.message);
        }
        return data as WaitingListEntry;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update inquiry');
        setError(e);
        console.error('useUpdateWaitingListEntry error:', e);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateEntry, loading, error };
}

/**
 * Delete (archive) an entry (tutor only; RLS-enforced).
 */
export function useDeleteWaitingListEntry(): {
  deleteEntry: (id: string) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteEntry = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      const { error: deleteError } = await supabase
        .from('waiting_list')
        .delete()
        .eq('id', id);
      if (deleteError) {
        throw new Error(deleteError.message);
      }
      return true;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('Failed to delete inquiry');
      setError(e);
      console.error('useDeleteWaitingListEntry error:', e);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteEntry, loading, error };
}

/**
 * Public submit — called from the unauthenticated inquiry form.
 * Invokes the submit-inquiry edge function (anon-callable, verify_jwt=false).
 */
export async function submitInquiry(
  // `company` is the honeypot field — not persisted, only inspected by the edge function.
  input: CreateWaitingListInput & { company?: string }
): Promise<{ success: boolean; error?: string }> {
  const { data, error } = await supabase.functions.invoke('submit-inquiry', {
    body: input,
  });
  if (error) {
    return { success: false, error: error.message };
  }
  if (data && typeof data === 'object' && 'error' in data) {
    return { success: false, error: String((data as { error: unknown }).error) };
  }
  return { success: true };
}

/**
 * Status display info for badges/cards.
 */
export function getWaitingListStatusInfo(status: WaitingListStatus): {
  label: string;
  color: string;
  bgColor: string;
  icon: string;
} {
  switch (status) {
    case 'new':
      return { label: 'New', color: '#3D9CA8', bgColor: '#E8F5F7', icon: 'sparkles-outline' };
    case 'contacted':
      return { label: 'Contacted', color: '#FFC107', bgColor: '#FFF8E1', icon: 'call-outline' };
    case 'waitlisted':
      return { label: 'Waitlisted', color: '#FF9800', bgColor: '#FFF3E0', icon: 'hourglass-outline' };
    case 'converted':
      return { label: 'Converted', color: '#7CB342', bgColor: '#F1F8E9', icon: 'checkmark-circle-outline' };
    case 'declined':
      return { label: 'Declined', color: '#E53935', bgColor: '#FFEBEE', icon: 'close-circle-outline' };
    default:
      return { label: 'Unknown', color: '#9E9E9E', bgColor: '#F5F5F5', icon: 'help-circle-outline' };
  }
}
