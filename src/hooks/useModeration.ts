/**
 * Moderation hooks: report messages and block people.
 * App Store Guideline 1.2 (User-Generated Content).
 */

import { useCallback, useEffect, useState } from 'react';
import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';

// user_blocks is not in the generated Database types yet; use an untyped client
// for it until types are regenerated (npx supabase gen types).
const db = supabase as unknown as SupabaseClient;

export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'other';

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam' },
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'other', label: 'Something else' },
];

export interface BlockedUser {
  id: string;
  blocked_id: string;
  blocked_name: string | null;
  created_at: string;
}

export interface ReportMessageInput {
  messageId: string;
  reason: ReportReason;
  details?: string;
  block?: boolean;
}

export async function reportMessage(
  input: ReportMessageInput
): Promise<{ success: boolean; blocked: boolean; error: string | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('report-content', {
      body: {
        message_id: input.messageId,
        reason: input.reason,
        details: input.details?.trim() || undefined,
        block: input.block === true,
      },
    });
    if (error) {
      let message = 'Could not send your report. Please try again.';
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null);
        if (body?.error) message = body.error;
      }
      return { success: false, blocked: false, error: message };
    }
    return { success: true, blocked: data?.blocked === true, error: null };
  } catch (err) {
    console.error('[reportMessage] Error:', err);
    return { success: false, blocked: false, error: 'Could not send your report. Please try again.' };
  }
}

/**
 * The people the current user has blocked, plus block and unblock actions.
 */
export function useBlockedUsers() {
  const { parent } = useAuthContext();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!parent?.id) {
      setBlocked([]);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: fetchError } = await db
      .from('user_blocks')
      .select('id, blocked_id, blocked_name, created_at')
      .eq('blocker_id', parent.id)
      .order('created_at', { ascending: false });
    if (fetchError) {
      // Table may not exist until the migration is pushed; fail quietly.
      console.warn('[useBlockedUsers] fetch failed:', fetchError.message);
      setError(new Error(fetchError.message));
      setBlocked([]);
    } else {
      setBlocked((data as BlockedUser[]) ?? []);
    }
    setLoading(false);
  }, [parent?.id]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const blockUser = useCallback(
    async (blockedId: string, blockedName?: string | null) => {
      if (!parent?.id || blockedId === parent.id) return false;
      const { error: insertError } = await db.from('user_blocks').upsert(
        { blocker_id: parent.id, blocked_id: blockedId, blocked_name: blockedName ?? null },
        { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true }
      );
      if (insertError) {
        console.error('[blockUser] Error:', insertError.message);
        return false;
      }
      await refetch();
      return true;
    },
    [parent?.id, refetch]
  );

  const unblockUser = useCallback(
    async (blockedId: string) => {
      if (!parent?.id) return false;
      const { error: deleteError } = await db
        .from('user_blocks')
        .delete()
        .eq('blocker_id', parent.id)
        .eq('blocked_id', blockedId);
      if (deleteError) {
        console.error('[unblockUser] Error:', deleteError.message);
        return false;
      }
      await refetch();
      return true;
    },
    [parent?.id, refetch]
  );

  return {
    blocked,
    blockedIds: new Set(blocked.map((b) => b.blocked_id)),
    loading,
    error,
    refetch,
    blockUser,
    unblockUser,
  };
}
