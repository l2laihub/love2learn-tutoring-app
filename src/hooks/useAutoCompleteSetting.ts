/**
 * useAutoCompleteSetting.ts
 * Reads/updates the tutor's parents.auto_complete_lessons flag.
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export function useAutoCompleteSetting() {
  const [enabled, setEnabled] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data, error: e } = await supabase
        .from('parents')
        .select('auto_complete_lessons')
        .eq('user_id', user.id)
        .maybeSingle();
      if (e) throw new Error(e.message);
      if (data) setEnabled(data.auto_complete_lessons !== false);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load setting'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (next: boolean): Promise<boolean> => {
    setSaving(true);
    setError(null);
    const prev = enabled;
    setEnabled(next); // optimistic
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      const { error: e } = await supabase
        .from('parents')
        .update({ auto_complete_lessons: next, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (e) throw new Error(e.message);
      return true;
    } catch (err) {
      setEnabled(prev); // revert on failure
      setError(err instanceof Error ? err : new Error('Failed to update setting'));
      return false;
    } finally {
      setSaving(false);
    }
  }, [enabled]);

  return { enabled, loading, saving, error, update, refetch: load };
}
