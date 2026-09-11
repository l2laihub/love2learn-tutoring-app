/**
 * useParents Hook
 * Data fetching hooks for parent management in DaLesson tutoring app
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { parentSaveErrorMessage } from '../lib/parentSaveError';
import {
  Parent,
  ParentWithStudents,
  CreateParentInput,
  UpdateParentInput,
  ListQueryState,
  QueryState,
  BillingMode,
} from '../types/database';

/**
 * Parent with student count for list views
 */
interface ParentWithCount extends Parent {
  student_count: number;
}

/**
 * Fetch all parents with their students
 * @returns List of parents with students, loading state, and error
 */
export function useParents(): ListQueryState<ParentWithStudents> {
  const [data, setData] = useState<ParentWithStudents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchParents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch parents with students (only role='parent', not tutors)
      const { data: parents, error: fetchError } = await supabase
        .from('parents')
        .select(`
          *,
          students!parent_id(*)
        `)
        .eq('role', 'parent')
        .order('name', { ascending: true });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((parents as ParentWithStudents[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch parents');
      setError(errorMessage);
      console.error('useParents error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  return { data, loading, error, refetch: fetchParents };
}

/**
 * Fetch a single parent by ID with their students
 * @param id - Parent UUID
 * @returns Single parent with students, loading state, and error
 */
export function useParent(id: string | null): QueryState<ParentWithStudents> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<ParentWithStudents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchParent = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: parent, error: fetchError } = await supabase
        .from('parents')
        .select(`
          *,
          students!parent_id(*)
        `)
        .eq('id', id)
        // maybeSingle, not single: a deleted (or RLS-invisible) row is a normal
        // outcome here, and single() surfaces PGRST116 "Cannot coerce the result
        // to a single JSON object" straight into the screen's error text.
        .maybeSingle();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData(parent as ParentWithStudents | null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch parent');
      setError(errorMessage);
      console.error('useParent error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchParent();
  }, [fetchParent]);

  return { data, loading, error, refetch: fetchParent };
}

/**
 * Hook for creating a new parent
 * @returns Mutation state with create function
 */
export function useCreateParent() {
  const [data, setData] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: CreateParentInput): Promise<Parent | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: parent, error: createError } = await supabase
        .from('parents')
        .insert(input)
        .select()
        .single();

      if (createError) {
        // Rethrow as-is: .code is what tells a duplicate email (23505) apart
        // from an RLS refusal, and new Error(message) would drop it.
        throw createError;
      }

      setData(parent);
      return parent;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(parentSaveErrorMessage(err)));
      console.error('useCreateParent error:', err);
      // Swallowing this returned null, which every caller rendered as "the
      // button did nothing". The caller shows the message instead.
      throw err;
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
 * Hook for updating an existing parent
 * @returns Mutation state with update function
 */
export function useUpdateParent() {
  const [data, setData] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string, input: UpdateParentInput): Promise<Parent | null> => {
    try {
      setLoading(true);
      setError(null);

      const { data: parent, error: updateError } = await supabase
        .from('parents')
        .update({
          ...input,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select()
        .single();

      if (updateError) {
        throw updateError;
      }

      setData(parent);
      return parent;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(parentSaveErrorMessage(err)));
      console.error('useUpdateParent error:', err);
      throw err;
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
 * Hook for deleting a parent
 * Note: This will cascade delete all associated students due to FK constraint
 * @returns Mutation state with delete function
 */
export function useDeleteParent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const mutate = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      // .select() so a delete that matched no row is distinguishable from a
      // real one: under RLS a DELETE matching nothing returns success with no
      // error, which is how "Delete Parent" once reported success and did
      // nothing (see 20260520000002_add_parents_delete_policy.sql).
      const { data: deleted, error: deleteError } = await supabase
        .from('parents')
        .delete()
        .eq('id', id)
        .select('id');

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      if (!deleted || deleted.length === 0) {
        throw new Error(
          'Nothing was deleted - this parent may already be gone, or may belong to another tutor.'
        );
      }

      setSuccess(true);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete parent');
      setError(errorMessage);
      console.error('useDeleteParent error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
    setSuccess(false);
  }, []);

  return { loading, error, success, mutate, reset };
}

/**
 * Fetch parent by user ID (for current logged in user)
 * @param userId - Auth user UUID
 * @returns Parent profile for the authenticated user
 */
export function useParentByUserId(userId: string | null): QueryState<ParentWithStudents> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<ParentWithStudents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchParent = useCallback(async () => {
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: parent, error: fetchError } = await supabase
        .from('parents')
        .select(`
          *,
          students!parent_id(*)
        `)
        .eq('user_id', userId)
        .single();

      if (fetchError) {
        // Not found is not necessarily an error - user might not have a parent profile
        // PGRST116 = "The result contains 0 rows" (no matching row found)
        if (fetchError.code === 'PGRST116') {
          console.log('[useParentByUserId] No parent profile found for user:', userId);
          setData(null);
          return;
        }
        // Don't log as error for expected scenarios
        console.warn('[useParentByUserId] Query error:', fetchError.code, fetchError.message);
        throw new Error(fetchError.message);
      }

      setData(parent as ParentWithStudents);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch parent');
      setError(errorMessage);
      // Only log unexpected errors, not routine lookup failures
      if (errorMessage.message !== 'Failed to fetch parent') {
        console.error('[useParentByUserId] Unexpected error:', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchParent();
  }, [fetchParent]);

  return { data, loading, error, refetch: fetchParent };
}

/**
 * Search parents by name or email
 * @param searchTerm - Search string to match against name or email
 * @returns Filtered list of parents
 */
export function useSearchParents(searchTerm: string): ListQueryState<Parent> {
  const [data, setData] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchParents = useCallback(async () => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: parents, error: fetchError } = await supabase
        .from('parents')
        .select('*')
        .eq('role', 'parent')
        .or(`name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .order('name', { ascending: true })
        .limit(20);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData(parents || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to search parents');
      setError(errorMessage);
      console.error('useSearchParents error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    const debounceTimer = setTimeout(fetchParents, 300);
    return () => clearTimeout(debounceTimer);
  }, [fetchParents]);

  return { data, loading, error, refetch: fetchParents };
}

/**
 * Fetch the tutor (parent with role='tutor')
 * Returns the tutor record for the current authenticated user
 * @returns The tutor's parent profile
 */
export function useTutor(): QueryState<Parent> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTutor = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Get the current authenticated user
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setData(null);
        setLoading(false);
        return;
      }

      // Fetch tutor record for the current user
      const { data: tutor, error: fetchError } = await supabase
        .from('parents')
        .select('*')
        .eq('role', 'tutor')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // tutor may be null if user is not a tutor
      setData(tutor as Parent | null);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch tutor');
      setError(errorMessage);
      console.error('useTutor error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTutor();
  }, [fetchTutor]);

  return { data, loading, error, refetch: fetchTutor };
}

/**
 * Get the tutor ID for the current user (works for both tutors and parents).
 * Uses the `get_my_tutor_info` RPC (SECURITY DEFINER) which resolves:
 * - For tutors: their own parents.id
 * - For parents: their assigned parents.tutor_id
 */
export function useMyTutorId(): { tutorId: string | null; loading: boolean } {
  const [tutorId, setTutorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTutorId = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_my_tutor_info');
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      setTutorId(row?.tutor_id || null);
    } catch (err) {
      console.error('useMyTutorId error:', err);
      setTutorId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTutorId(); }, [fetchTutorId]);
  return { tutorId, loading };
}

/**
 * Hook for updating a parent's billing mode
 * @returns Mutation state with update function
 */
export function useUpdateBillingMode() {
  const [data, setData] = useState<Parent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (parentId: string, billingMode: BillingMode): Promise<Parent | null> => {
    try {
      setLoading(true);
      setError(null);

      const update: { billing_mode: BillingMode; updated_at: string; prepaid_subjects?: string[] } = {
        billing_mode: billingMode,
        updated_at: new Date().toISOString(),
      };
      // Switching to invoice must also clear per-subject prepaid config:
      // a family with leftover prepaid_subjects stays on the Prepaid tab and
      // those subjects are skipped when invoices are generated.
      if (billingMode === 'invoice') {
        update.prepaid_subjects = [];
      }

      const { data: parent, error: updateError } = await supabase
        .from('parents')
        .update(update)
        .eq('id', parentId)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      setData(parent);
      return parent;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to update billing mode');
      setError(errorMessage);
      console.error('useUpdateBillingMode error:', errorMessage);
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
 * Fetch parents filtered by billing mode
 * @param billingMode - Filter by invoice or prepaid
 * @returns List of parents with the specified billing mode
 */
export function useParentsByBillingMode(billingMode: BillingMode): ListQueryState<ParentWithStudents> {
  const [data, setData] = useState<ParentWithStudents[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchParents = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const { data: parents, error: fetchError } = await supabase
        .from('parents')
        .select(`
          *,
          students!parent_id(*)
        `)
        .eq('role', 'parent')
        .eq('billing_mode', billingMode)
        .order('name', { ascending: true });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((parents as ParentWithStudents[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch parents by billing mode');
      setError(errorMessage);
      console.error('useParentsByBillingMode error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [billingMode]);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  return { data, loading, error, refetch: fetchParents };
}
