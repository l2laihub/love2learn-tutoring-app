/**
 * useParentGroups Hook
 * CRUD operations for parent groups (tutor only feature)
 *
 * Features:
 * - List all parent groups with member counts
 * - Get single group with members
 * - Create, update, delete groups
 * - Add/remove group members
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import {
  ParentGroup,
  ParentGroupWithMembers,
  CreateParentGroupInput,
  UpdateParentGroupInput,
  ParentGroupsState,
} from '../types/messages';
import { Parent } from '../types/database';

/**
 * Fetch all parent groups with member counts
 */
export function useParentGroups(): ParentGroupsState {
  const { parent, isTutor } = useAuthContext();
  const [groups, setGroups] = useState<ParentGroupWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGroups = useCallback(async () => {
    if (!parent?.id || !isTutor) {
      setGroups([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use RPC function to avoid RLS recursion issues
      const { data: groupsData, error: groupsError } = await supabase
        .rpc('get_parent_groups_with_members');

      if (groupsError) {
        throw new Error(groupsError.message);
      }

      // Transform the data from RPC result
      const transformedGroups: ParentGroupWithMembers[] = (groupsData || []).map((group: {
        id: string;
        name: string;
        description: string | null;
        created_by: string;
        created_at: string;
        updated_at: string;
        member_count: number;
        members: Array<{ id: string; name: string; email: string }>;
      }) => ({
        id: group.id,
        name: group.name,
        description: group.description,
        created_by: group.created_by,
        created_at: group.created_at,
        updated_at: group.updated_at,
        members: group.members || [],
        member_count: Number(group.member_count) || 0,
      }));

      setGroups(transformedGroups);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch groups');
      setError(errorMessage);
      console.error('useParentGroups error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parent?.id, isTutor]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  return {
    groups,
    loading,
    error,
    refetch: fetchGroups,
  };
}

/**
 * Fetch a single parent group with its members
 */
export function useParentGroup(groupId: string | null) {
  const { isTutor } = useAuthContext();
  const [group, setGroup] = useState<ParentGroupWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchGroup = useCallback(async () => {
    if (!groupId || !isTutor) {
      setGroup(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch group info directly (no nested members to avoid RLS issues)
      const { data: groupData, error: groupError } = await supabase
        .from('parent_groups')
        .select('*')
        .eq('id', groupId)
        .single();

      if (groupError) {
        throw new Error(groupError.message);
      }

      // Fetch members using RPC function to avoid RLS recursion
      const { data: membersData, error: membersError } = await supabase
        .rpc('get_group_members', { p_group_id: groupId });

      if (membersError) {
        console.error('Error fetching group members:', membersError);
      }

      // Transform the data
      const members = (membersData || []).map((m: {
        parent_id: string;
        parent_name: string;
        parent_email: string;
      }) => ({
        id: m.parent_id,
        name: m.parent_name,
        email: m.parent_email,
      }));

      const transformedGroup: ParentGroupWithMembers = {
        ...groupData,
        members,
        member_count: members.length,
      };

      setGroup(transformedGroup);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch group');
      setError(errorMessage);
      console.error('useParentGroup error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [groupId, isTutor]);

  useEffect(() => {
    fetchGroup();
  }, [fetchGroup]);

  return {
    group,
    loading,
    error,
    refetch: fetchGroup,
  };
}

/**
 * Create a new parent group
 */
export function useCreateParentGroup() {
  const { parent, isTutor } = useAuthContext();
  const [data, setData] = useState<ParentGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: CreateParentGroupInput): Promise<ParentGroup | null> => {
    if (!parent?.id || !isTutor) {
      setError(new Error('Only tutors can create groups'));
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // Create the group
      const { data: groupData, error: groupError } = await supabase
        .from('parent_groups')
        .insert({
          name: input.name,
          description: input.description || null,
          created_by: parent.id,
        })
        .select()
        .single();

      if (groupError) {
        throw new Error(groupError.message);
      }

      // Add members if provided
      if (input.member_ids && input.member_ids.length > 0) {
        const memberInserts = input.member_ids.map(parentId => ({
          group_id: groupData.id,
          parent_id: parentId,
        }));

        const { error: memberError } = await supabase
          .from('parent_group_members')
          .insert(memberInserts);

        if (memberError) {
          console.error('Error adding group members:', memberError);
          // Don't fail the whole operation if member add fails
        }
      }

      setData(groupData);
      return groupData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to create group');
      setError(errorMessage);
      console.error('useCreateParentGroup error:', errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [parent?.id, isTutor]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    mutate,
    reset,
  };
}

/**
 * Update a parent group
 */
export function useUpdateParentGroup() {
  const { isTutor } = useAuthContext();
  const [data, setData] = useState<ParentGroup | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (
    groupId: string,
    input: UpdateParentGroupInput
  ): Promise<ParentGroup | null> => {
    if (!isTutor) {
      setError(new Error('Only tutors can update groups'));
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      // Update group name/description if provided
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      updateData.updated_at = new Date().toISOString();

      const { data: groupData, error: groupError } = await supabase
        .from('parent_groups')
        .update(updateData)
        .eq('id', groupId)
        .select()
        .single();

      if (groupError) {
        throw new Error(groupError.message);
      }

      // Update members if provided (replace all)
      if (input.member_ids !== undefined) {
        // Delete existing members
        await supabase
          .from('parent_group_members')
          .delete()
          .eq('group_id', groupId);

        // Add new members
        if (input.member_ids.length > 0) {
          const memberInserts = input.member_ids.map(parentId => ({
            group_id: groupId,
            parent_id: parentId,
          }));

          const { error: memberError } = await supabase
            .from('parent_group_members')
            .insert(memberInserts);

          if (memberError) {
            console.error('Error updating group members:', memberError);
          }
        }
      }

      setData(groupData);
      return groupData;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to update group');
      setError(errorMessage);
      console.error('useUpdateParentGroup error:', errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [isTutor]);

  const reset = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return {
    data,
    loading,
    error,
    mutate,
    reset,
  };
}

/**
 * Delete a parent group
 */
export function useDeleteParentGroup() {
  const { isTutor } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (groupId: string): Promise<boolean> => {
    if (!isTutor) {
      setError(new Error('Only tutors can delete groups'));
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .from('parent_groups')
        .delete()
        .eq('id', groupId);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete group');
      setError(errorMessage);
      console.error('useDeleteParentGroup error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isTutor]);

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return {
    loading,
    error,
    mutate,
    reset,
  };
}

/**
 * Get all parents that can be added to groups (for the selector)
 */
export function useParentsForGroupSelection() {
  const { isTutor } = useAuthContext();
  const [parents, setParents] = useState<Parent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchParents = useCallback(async () => {
    if (!isTutor) {
      setParents([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: parentsData, error: parentsError } = await supabase
        .from('parents')
        .select('*')
        .eq('role', 'parent')
        .order('name', { ascending: true });

      if (parentsError) {
        throw new Error(parentsError.message);
      }

      setParents(parentsData || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch parents');
      setError(errorMessage);
      console.error('useParentsForGroupSelection error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [isTutor]);

  useEffect(() => {
    fetchParents();
  }, [fetchParents]);

  return {
    parents,
    loading,
    error,
    refetch: fetchParents,
  };
}
