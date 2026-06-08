/**
 * useTutorTelegram.ts
 * Hook backing the tutor Telegram recap settings screen.
 *
 * Exposes the tutor's Telegram link status and actions:
 *  - getLinkUrl: mint a one-time deep-link token and build the t.me start URL
 *  - sendPreview: invoke the recap edge function in preview mode
 *  - setEnabled: toggle the weekly recap on/off (without disconnecting)
 *  - disconnect: clear the Telegram link
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';

export interface TelegramStatus {
  linked: boolean;
  username: string | null;
  enabled: boolean;
}

const BOT_USERNAME = process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME ?? '';

export function useTutorTelegram() {
  const { parent } = useAuthContext();
  const tutorId = parent?.id ?? null;

  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!tutorId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data, error: qErr } = await supabase
        .from('parents')
        .select('telegram_chat_id, telegram_username, telegram_recap_enabled')
        .eq('id', tutorId)
        .single();
      if (qErr) throw qErr;
      setStatus({
        linked: !!data?.telegram_chat_id,
        username: data?.telegram_username ?? null,
        enabled: data?.telegram_recap_enabled ?? true,
      });
      setError(null);
    } catch (e) {
      setError(e as Error);
    } finally {
      setLoading(false);
    }
  }, [tutorId]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Mint a one-time token and return the t.me deep link.
  const getLinkUrl = useCallback(async (): Promise<string> => {
    if (!BOT_USERNAME) {
      throw new Error('EXPO_PUBLIC_TELEGRAM_BOT_USERNAME is not set');
    }
    const { data, error: rpcErr } = await supabase.rpc('create_telegram_link_token');
    if (rpcErr) throw rpcErr;
    return `https://t.me/${BOT_USERNAME}?start=${encodeURIComponent(data)}`;
  }, []);

  const sendPreview = useCallback(async () => {
    if (!tutorId) throw new Error('No tutor');
    const { data, error: invErr } = await supabase.functions.invoke('send-telegram-recap', {
      body: { tutor_id: tutorId, preview: true },
    });
    if (invErr) throw invErr;
    return data;
  }, [tutorId]);

  const setEnabled = useCallback(
    async (enabled: boolean) => {
      if (!tutorId) throw new Error('No tutor');
      const { error: upErr } = await supabase
        .from('parents')
        .update({ telegram_recap_enabled: enabled })
        .eq('id', tutorId);
      if (upErr) throw upErr;
      await refetch();
    },
    [tutorId, refetch],
  );

  const disconnect = useCallback(async () => {
    if (!tutorId) throw new Error('No tutor');
    const { error: upErr } = await supabase
      .from('parents')
      .update({
        telegram_chat_id: null,
        telegram_username: null,
        telegram_linked_at: null,
      })
      .eq('id', tutorId);
    if (upErr) throw upErr;
    await refetch();
  }, [tutorId, refetch]);

  return { status, loading, error, refetch, getLinkUrl, sendPreview, setEnabled, disconnect };
}
