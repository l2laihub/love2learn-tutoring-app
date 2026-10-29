/**
 * Account management helpers
 * DaLesson Tutoring App
 */

import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface DeleteAccountResult {
  success: boolean;
  error: string | null;
}

/**
 * Permanently delete the signed-in user's account.
 *
 * Calls the `delete-account` edge function, which cancels any Stripe
 * subscription, removes or unlinks app data, and deletes the auth user.
 * On success the local session is cleared.
 */
export async function deleteAccount(): Promise<DeleteAccountResult> {
  try {
    const { error } = await supabase.functions.invoke('delete-account', {
      body: { confirm: 'DELETE' },
    });

    if (error) {
      let message = 'Could not delete your account. Please try again.';
      if (error instanceof FunctionsHttpError) {
        const body = await error.context.json().catch(() => null);
        if (body?.error) message = body.error;
      }
      return { success: false, error: message };
    }

    // The auth user no longer exists, so only clear the local session.
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    return { success: true, error: null };
  } catch (err) {
    console.error('[deleteAccount] Error:', err);
    return {
      success: false,
      error: 'Could not reach the server. Check your connection and try again.',
    };
  }
}
