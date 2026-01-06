/**
 * useSharedResources Hook
 * Data fetching hooks for shared resources (worksheets, PDFs, images, videos)
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
  SharedResource,
  SharedResourceWithStudent,
  SharedResourceWithDetails,
  CreateSharedResourceInput,
  UpdateSharedResourceInput,
  ListQueryState,
  QueryState,
  ResourceType,
  Student,
} from '../types/database';

/**
 * Options for filtering shared resources
 */
export interface SharedResourcesFilterOptions {
  studentId?: string;
  parentId?: string;
  tutorId?: string;
  resourceType?: ResourceType;
  includeViewed?: boolean;
  lessonId?: string;
}

/**
 * Fetch shared resources with optional filters
 * @param options - Filter options
 * @returns List of shared resources with student info
 */
export function useSharedResources(
  options: SharedResourcesFilterOptions = {}
): ListQueryState<SharedResourceWithStudent> {
  const [data, setData] = useState<SharedResourceWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { studentId, parentId, tutorId, resourceType, includeViewed = true, lessonId } = options;

  const fetchResources = useCallback(async () => {
    console.log('[useSharedResources] Fetching resources with filters:', { studentId, parentId, tutorId, resourceType, includeViewed, lessonId });
    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('shared_resources')
        .select(
          `
          *,
          student:students(*)
        `
        )
        .eq('is_visible_to_parent', true)
        .order('created_at', { ascending: false });

      if (studentId) {
        query = query.eq('student_id', studentId);
      }

      if (parentId) {
        query = query.eq('parent_id', parentId);
      }

      if (tutorId) {
        query = query.eq('tutor_id', tutorId);
      }

      if (resourceType) {
        query = query.eq('resource_type', resourceType);
      }

      if (!includeViewed) {
        query = query.is('viewed_at', null);
      }

      if (lessonId) {
        query = query.eq('lesson_id', lessonId);
      }

      const { data: resources, error: fetchError } = await query;

      console.log('[useSharedResources] Query result:', { count: resources?.length, error: fetchError?.message });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((resources as SharedResourceWithStudent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch shared resources');
      setError(errorMessage);
      console.error('useSharedResources error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [studentId, parentId, tutorId, resourceType, includeViewed, lessonId]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  return { data, loading, error, refetch: fetchResources };
}

/**
 * Fetch shared resources for a parent (filtered by their children)
 * @param parentId - Parent ID
 * @param resourceType - Optional resource type filter
 * @returns List of shared resources
 */
export function useParentSharedResources(
  parentId: string | null,
  resourceType?: ResourceType
): ListQueryState<SharedResourceWithStudent> {
  const [data, setData] = useState<SharedResourceWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchResources = useCallback(async () => {
    console.log('[useParentSharedResources] Fetching for parentId:', parentId);
    if (!parentId) {
      console.log('[useParentSharedResources] No parentId, skipping fetch');
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from('shared_resources')
        .select(
          `
          *,
          student:students(*)
        `
        )
        .eq('parent_id', parentId)
        .eq('is_visible_to_parent', true)
        .order('created_at', { ascending: false });

      if (resourceType) {
        query = query.eq('resource_type', resourceType);
      }

      const { data: resources, error: fetchError } = await query;

      console.log('[useParentSharedResources] Query result:', { parentId, count: resources?.length, error: fetchError?.message });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((resources as SharedResourceWithStudent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch shared resources');
      setError(errorMessage);
      console.error('useParentSharedResources error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parentId, resourceType]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  return { data, loading, error, refetch: fetchResources };
}

/**
 * Fetch unviewed shared resources for a parent
 * @param parentId - Parent ID
 * @returns List of unviewed resources
 */
export function useUnviewedResources(parentId: string | null): ListQueryState<SharedResourceWithStudent> {
  const [data, setData] = useState<SharedResourceWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchResources = useCallback(async () => {
    if (!parentId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: resources, error: fetchError } = await supabase
        .from('shared_resources')
        .select(
          `
          *,
          student:students(*)
        `
        )
        .eq('parent_id', parentId)
        .eq('is_visible_to_parent', true)
        .is('viewed_at', null)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((resources as SharedResourceWithStudent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch unviewed resources');
      setError(errorMessage);
      console.error('useUnviewedResources error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  return { data, loading, error, refetch: fetchResources };
}

/**
 * Get unviewed resource count for a parent
 * @param parentId - Parent ID
 * @returns Count of unviewed resources
 */
export function useUnviewedResourceCount(parentId: string | null) {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchCount = useCallback(async () => {
    if (!parentId) {
      setCount(0);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { count: resourceCount, error: fetchError } = await supabase
        .from('shared_resources')
        .select('*', { count: 'exact', head: true })
        .eq('parent_id', parentId)
        .eq('is_visible_to_parent', true)
        .is('viewed_at', null);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setCount(resourceCount || 0);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch unviewed count');
      setError(errorMessage);
      console.error('useUnviewedResourceCount error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return { count, loading, error, refetch: fetchCount };
}

/**
 * Fetch a single shared resource by ID
 * @param id - Resource UUID
 * @returns Single shared resource with details
 */
export function useSharedResource(
  id: string | null
): QueryState<SharedResourceWithDetails> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<SharedResourceWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchResource = useCallback(async () => {
    if (!id) {
      setData(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: resource, error: fetchError } = await supabase
        .from('shared_resources')
        .select(
          `
          *,
          student:students(*),
          parent:parents(*),
          assignment:assignments(*)
        `
        )
        .eq('id', id)
        .single();

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData(resource as SharedResourceWithDetails);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch shared resource');
      setError(errorMessage);
      console.error('useSharedResource error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchResource();
  }, [fetchResource]);

  return { data, loading, error, refetch: fetchResource };
}

/**
 * Hook for creating a new shared resource
 * @returns Mutation state with create function
 */
export function useCreateSharedResource() {
  const [data, setData] = useState<SharedResource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: CreateSharedResourceInput): Promise<SharedResource | null> => {
    console.log('[useCreateSharedResource] Creating resource:', input);
    try {
      setLoading(true);
      setError(null);

      const { data: resource, error: createError } = await supabase
        .from('shared_resources')
        .insert({
          ...input,
          is_visible_to_parent: true,
        })
        .select()
        .single();

      if (createError) {
        console.error('[useCreateSharedResource] Create error:', createError);
        throw new Error(createError.message);
      }

      console.log('[useCreateSharedResource] Created successfully:', resource);
      setData(resource);
      return resource;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to create shared resource');
      setError(errorMessage);
      console.error('[useCreateSharedResource] error:', errorMessage);
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
 * Hook for updating a shared resource
 * @returns Mutation state with update function
 */
export function useUpdateSharedResource() {
  const [data, setData] = useState<SharedResource | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(
    async (id: string, input: UpdateSharedResourceInput): Promise<SharedResource | null> => {
      try {
        setLoading(true);
        setError(null);

        const { data: resource, error: updateError } = await supabase
          .from('shared_resources')
          .update(input)
          .eq('id', id)
          .select()
          .single();

        if (updateError) {
          throw new Error(updateError.message);
        }

        setData(resource);
        return resource;
      } catch (err) {
        const errorMessage = err instanceof Error ? err : new Error('Failed to update shared resource');
        setError(errorMessage);
        console.error('useUpdateSharedResource error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  return { data, loading, error, mutate, reset };
}

/**
 * Hook for marking a resource as viewed
 * @returns Mutation state with markViewed function
 */
export function useMarkResourceViewed() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('shared_resources')
        .update({ viewed_at: new Date().toISOString() })
        .eq('id', id)
        .is('viewed_at', null); // Only update if not already viewed

      if (updateError) {
        throw new Error(updateError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to mark resource as viewed');
      setError(errorMessage);
      console.error('useMarkResourceViewed error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, mutate };
}

/**
 * Hook for deleting a shared resource
 * @returns Mutation state with delete function
 */
export function useDeleteSharedResource() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const mutate = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const { error: deleteError } = await supabase.from('shared_resources').delete().eq('id', id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setSuccess(true);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete shared resource');
      setError(errorMessage);
      console.error('useDeleteSharedResource error:', errorMessage);
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
 * Hook for deleting a shared resource with its storage file
 * This performs a full delete including the file from Supabase Storage
 * @returns Mutation state with delete function
 */
export function useDeleteSharedResourceWithFile() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState(false);

  const mutate = useCallback(async (
    id: string,
    storagePath: string | null,
    resourceType: string
  ): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      // Delete the file from storage first (if it exists)
      if (storagePath) {
        // Determine the bucket based on resource type
        const bucket = resourceType === 'image' ? 'session-media' : 'worksheets';

        console.log('[useDeleteSharedResourceWithFile] Deleting file:', { bucket, storagePath });

        const { error: storageError } = await supabase.storage
          .from(bucket)
          .remove([storagePath]);

        if (storageError) {
          console.warn('[useDeleteSharedResourceWithFile] Storage delete warning:', storageError.message);
          // Continue with database delete even if storage delete fails
          // The file might have already been deleted or doesn't exist
        }
      }

      // Delete the database record
      const { error: deleteError } = await supabase
        .from('shared_resources')
        .delete()
        .eq('id', id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setSuccess(true);
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete resource');
      setError(errorMessage);
      console.error('[useDeleteSharedResourceWithFile] error:', errorMessage);
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
 * Hook for hiding a resource from parent view (soft delete)
 * @returns Mutation state with hide function
 */
export function useHideSharedResource() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (id: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);

      const { error: updateError } = await supabase
        .from('shared_resources')
        .update({ is_visible_to_parent: false })
        .eq('id', id);

      if (updateError) {
        throw new Error(updateError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to hide shared resource');
      setError(errorMessage);
      console.error('useHideSharedResource error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, mutate };
}

/**
 * Get shared resource statistics for a student
 * @param studentId - Student UUID
 * @returns Resource statistics by type
 */
export function useSharedResourceStats(studentId: string | null) {
  const [stats, setStats] = useState({
    total: 0,
    worksheets: 0,
    pdfs: 0,
    images: 0,
    videos: 0,
    unviewed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!studentId) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: resources, error: fetchError } = await supabase
        .from('shared_resources')
        .select('resource_type, viewed_at')
        .eq('student_id', studentId)
        .eq('is_visible_to_parent', true);

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      const total = resources?.length || 0;
      const worksheets = resources?.filter((r) => r.resource_type === 'worksheet').length || 0;
      const pdfs = resources?.filter((r) => r.resource_type === 'pdf').length || 0;
      const images = resources?.filter((r) => r.resource_type === 'image').length || 0;
      const videos = resources?.filter((r) => r.resource_type === 'video').length || 0;
      const unviewed = resources?.filter((r) => !r.viewed_at).length || 0;

      setStats({ total, worksheets, pdfs, images, videos, unviewed });
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch resource stats');
      setError(errorMessage);
      console.error('useSharedResourceStats error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [studentId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, error, refetch: fetchStats };
}

/**
 * Fetch resources by lesson (for session media)
 * @param lessonId - Lesson UUID
 * @returns List of resources associated with the lesson
 */
export function useResourcesByLesson(lessonId: string | null): ListQueryState<SharedResourceWithStudent> {
  const [data, setData] = useState<SharedResourceWithStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchResources = useCallback(async () => {
    if (!lessonId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: resources, error: fetchError } = await supabase
        .from('shared_resources')
        .select(
          `
          *,
          student:students(*)
        `
        )
        .eq('lesson_id', lessonId)
        .eq('is_visible_to_parent', true)
        .order('created_at', { ascending: false });

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      setData((resources as SharedResourceWithStudent[]) || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch lesson resources');
      setError(errorMessage);
      console.error('useResourcesByLesson error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchResources();
  }, [fetchResources]);

  return { data, loading, error, refetch: fetchResources };
}
