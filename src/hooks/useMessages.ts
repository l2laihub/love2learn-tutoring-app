/**
 * useMessages Hook
 * Messaging functionality with real-time updates
 *
 * Features:
 * - List message threads with previews
 * - Get single thread with all messages
 * - Send messages with images
 * - Create new announcement threads
 * - Real-time message updates
 * - Emoji reactions
 * - Unread count tracking
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import {
  Message,
  MessageWithDetails,
  MessageThread,
  ThreadWithPreview,
  ThreadWithDetails,
  ReactionSummary,
  CreateMessageThreadInput,
  SendMessageInput,
  ToggleReactionInput,
  MessageThreadsState,
  MessageThreadState,
} from '../types/messages';
import { Parent } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Fetch message threads with previews (list view)
 */
export function useMessageThreads(limit: number = 50): MessageThreadsState & {
  unreadCount: number;
} {
  const { parent } = useAuthContext();
  const parentId = parent?.id || null;
  const [threads, setThreads] = useState<ThreadWithPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchThreads = useCallback(async () => {
    if (!parentId) {
      setThreads([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Use the RPC function for efficient thread fetching
      const { data: threadsData, error: threadsError } = await supabase
        .rpc('get_threads_with_preview', {
          p_parent_id: parentId,
          p_limit: limit,
        });

      if (threadsError) {
        throw new Error(threadsError.message);
      }

      setThreads(threadsData || []);

      // Calculate total unread
      const totalUnread = (threadsData || []).reduce(
        (sum: number, t: ThreadWithPreview) => sum + (t.unread_count || 0),
        0
      );
      setUnreadCount(totalUnread);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch threads');
      setError(errorMessage);
      console.error('useMessageThreads error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parentId, limit]);

  // Setup real-time subscription
  useEffect(() => {
    if (!parentId) return;

    fetchThreads();

    // Subscribe to message changes (insert, update, delete)
    const channel = supabase
      .channel(`messages-list:${parentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Refetch threads when a new message arrives
          fetchThreads();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Refetch threads when a message is deleted
          fetchThreads();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_threads',
        },
        () => {
          // Refetch threads when a thread is deleted
          fetchThreads();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_threads',
        },
        () => {
          // Refetch when thread is updated (e.g., archived)
          fetchThreads();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_thread_participants',
        },
        () => {
          // Refetch when read status changes
          fetchThreads();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [parentId, fetchThreads]);

  return {
    threads,
    loading,
    error,
    refetch: fetchThreads,
    unreadCount,
  };
}

/**
 * Fetch unread message count only (for badge)
 */
export function useUnreadMessageCount(): {
  count: number;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const { parent } = useAuthContext();
  const parentId = parent?.id || null;
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchCount = useCallback(async () => {
    if (!parentId) {
      setCount(0);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .rpc('get_unread_message_count', { p_parent_id: parentId });

      if (error) {
        console.error('Error fetching unread count:', error);
        return;
      }

      setCount(data || 0);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  // Setup real-time subscription
  useEffect(() => {
    if (!parentId) return;

    fetchCount();

    const channel = supabase
      .channel(`unread-messages-count:${parentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'message_threads',
        },
        () => {
          fetchCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'message_thread_participants',
        },
        () => {
          fetchCount();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [parentId, fetchCount]);

  return {
    count,
    loading,
    refetch: fetchCount,
  };
}

/**
 * Fetch a single thread with all messages
 */
export function useMessageThread(threadId: string | null): MessageThreadState & {
  markAsRead: () => Promise<boolean>;
} {
  const { parent } = useAuthContext();
  const parentId = parent?.id || null;
  const [thread, setThread] = useState<ThreadWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchThread = useCallback(async () => {
    if (!threadId || !parentId) {
      setThread(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch thread details - use maybeSingle to handle deleted threads gracefully
      const { data: threadData, error: threadError } = await supabase
        .from('message_threads')
        .select(`
          *,
          creator:parents!message_threads_created_by_fkey(*),
          group:parent_groups(*)
        `)
        .eq('id', threadId)
        .maybeSingle();

      if (threadError) {
        throw new Error(threadError.message);
      }

      // Thread was deleted - set to null without error
      if (!threadData) {
        setThread(null);
        setLoading(false);
        return;
      }

      // Fetch participants
      const { data: participantsData } = await supabase
        .from('message_thread_participants')
        .select('parent:parents(*)')
        .eq('thread_id', threadId);

      // Fetch messages with sender using RPC to bypass RLS
      const { data: messagesData, error: messagesError } = await supabase
        .rpc('get_thread_messages', {
          p_thread_id: threadId,
          p_parent_id: parentId,
        });

      if (messagesError) {
        throw new Error(messagesError.message);
      }

      // Transform RPC result to include sender object
      const transformedMessages = (messagesData || []).map((m: {
        id: string;
        thread_id: string;
        sender_id: string;
        content: string;
        images: string[];
        created_at: string;
        sender_name: string;
        sender_email: string;
        sender_role: string;
      }) => ({
        id: m.id,
        thread_id: m.thread_id,
        sender_id: m.sender_id,
        content: m.content,
        images: m.images || [],
        created_at: m.created_at,
        sender: {
          id: m.sender_id,
          name: m.sender_name,
          email: m.sender_email,
          role: m.sender_role,
        },
      }));

      // Fetch all reactions for these messages
      const messageIds = transformedMessages.map(m => m.id);
      let reactionsMap: Record<string, ReactionSummary[]> = {};

      if (messageIds.length > 0) {
        const { data: reactionsData } = await supabase
          .from('message_reactions')
          .select('*')
          .in('message_id', messageIds);

        // Group reactions by message
        reactionsMap = (reactionsData || []).reduce((acc, r) => {
          if (!acc[r.message_id]) {
            acc[r.message_id] = {};
          }
          if (!acc[r.message_id][r.emoji]) {
            acc[r.message_id][r.emoji] = {
              emoji: r.emoji,
              count: 0,
              reacted_by_me: false,
            };
          }
          acc[r.message_id][r.emoji].count++;
          if (r.parent_id === parentId) {
            acc[r.message_id][r.emoji].reacted_by_me = true;
          }
          return acc;
        }, {} as Record<string, Record<string, ReactionSummary>>);

        // Convert to array format
        Object.keys(reactionsMap).forEach(msgId => {
          reactionsMap[msgId] = Object.values(reactionsMap[msgId] as Record<string, ReactionSummary>);
        });
      }

      // Build messages with details
      const messagesWithDetails: MessageWithDetails[] = transformedMessages.map(m => ({
        ...m,
        reactions: (reactionsMap[m.id] as ReactionSummary[]) || [],
      }));

      const fullThread: ThreadWithDetails = {
        ...threadData,
        participants: participantsData?.map((p: { parent: Parent }) => p.parent).filter(Boolean) || [],
        messages: messagesWithDetails,
      };

      setThread(fullThread);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch thread');
      setError(errorMessage);
      console.error('useMessageThread error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [threadId, parentId]);

  // Mark thread as read
  const markAsRead = useCallback(async (): Promise<boolean> => {
    if (!threadId || !parentId) return false;

    try {
      const { error } = await supabase
        .rpc('mark_thread_read', {
          p_thread_id: threadId,
          p_parent_id: parentId,
        });

      if (error) {
        console.error('Error marking thread as read:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error marking thread as read:', err);
      return false;
    }
  }, [threadId, parentId]);

  // Setup real-time subscription
  useEffect(() => {
    if (!threadId || !parentId) return;

    fetchThread();

    // Mark as read when viewing
    markAsRead();

    // Subscribe to messages in this thread (insert, update, delete)
    const channel = supabase
      .channel(`thread-detail:${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          fetchThread();
          markAsRead();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
        },
        () => {
          // Refetch when a message is deleted
          // Note: DELETE events don't include filter data, so we refetch regardless
          fetchThread();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `thread_id=eq.${threadId}`,
        },
        () => {
          fetchThread();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          fetchThread();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [threadId, parentId, fetchThread, markAsRead]);

  return {
    thread,
    loading,
    error,
    refetch: fetchThread,
    markAsRead,
  };
}

/**
 * Create a new message thread (announcement)
 */
export function useCreateThread() {
  const { parent, isTutor } = useAuthContext();
  const [data, setData] = useState<string | null>(null); // Returns thread ID
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: CreateMessageThreadInput): Promise<string | null> => {
    if (!parent?.id || !isTutor) {
      setError(new Error('Only tutors can create announcements'));
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: threadId, error: createError } = await supabase
        .rpc('create_message_thread', {
          p_subject: input.subject,
          p_content: input.content,
          p_sender_id: parent.id,
          p_recipient_type: input.recipient_type,
          p_group_id: input.group_id || null,
          p_images: input.images || [],
          p_parent_ids: input.parent_ids || [],
        });

      if (createError) {
        throw new Error(createError.message);
      }

      setData(threadId);
      return threadId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to create thread');
      setError(errorMessage);
      console.error('useCreateThread error:', errorMessage);
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
 * Send a message to an existing thread
 */
export function useSendMessage() {
  const { parent } = useAuthContext();
  const [data, setData] = useState<string | null>(null); // Returns message ID
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: SendMessageInput): Promise<string | null> => {
    if (!parent?.id) {
      setError(new Error('Must be logged in to send messages'));
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: messageId, error: sendError } = await supabase
        .rpc('send_message', {
          p_thread_id: input.thread_id,
          p_sender_id: parent.id,
          p_content: input.content,
          p_images: input.images || [],
        });

      if (sendError) {
        throw new Error(sendError.message);
      }

      setData(messageId);
      return messageId;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to send message');
      setError(errorMessage);
      console.error('useSendMessage error:', errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, [parent?.id]);

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
 * Toggle a reaction on a message (add or remove)
 */
export function useToggleReaction() {
  const { parent } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (input: ToggleReactionInput): Promise<boolean> => {
    if (!parent?.id) {
      setError(new Error('Must be logged in to react'));
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: added, error: toggleError } = await supabase
        .rpc('toggle_reaction', {
          p_message_id: input.message_id,
          p_parent_id: parent.id,
          p_emoji: input.emoji,
        });

      if (toggleError) {
        throw new Error(toggleError.message);
      }

      return added;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to toggle reaction');
      setError(errorMessage);
      console.error('useToggleReaction error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [parent?.id]);

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
 * Mark a thread as read
 */
export function useMarkThreadRead() {
  const { parent } = useAuthContext();

  const mutate = useCallback(async (threadId: string): Promise<boolean> => {
    if (!parent?.id) return false;

    try {
      const { error } = await supabase
        .rpc('mark_thread_read', {
          p_thread_id: threadId,
          p_parent_id: parent.id,
        });

      if (error) {
        console.error('Error marking thread as read:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error marking thread as read:', err);
      return false;
    }
  }, [parent?.id]);

  return { mutate };
}

/**
 * Archive a thread (tutor only)
 */
export function useArchiveThread() {
  const { isTutor } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (threadId: string): Promise<boolean> => {
    if (!isTutor) {
      setError(new Error('Only tutors can archive threads'));
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: archiveError } = await supabase
        .rpc('archive_thread', { p_thread_id: threadId });

      if (archiveError) {
        throw new Error(archiveError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to archive thread');
      setError(errorMessage);
      console.error('useArchiveThread error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isTutor]);

  return { loading, error, mutate };
}

/**
 * Delete a message (tutor can delete any, users can delete their own)
 */
export function useDeleteMessage() {
  const { parent } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (messageId: string): Promise<boolean> => {
    if (!parent?.id) {
      setError(new Error('Must be logged in to delete messages'));
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .rpc('delete_message', {
          p_message_id: messageId,
          p_parent_id: parent.id,
        });

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete message');
      setError(errorMessage);
      console.error('useDeleteMessage error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [parent?.id]);

  return { loading, error, mutate };
}

/**
 * Delete a thread permanently (tutor only)
 */
export function useDeleteThread() {
  const { isTutor } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (threadId: string): Promise<boolean> => {
    if (!isTutor) {
      setError(new Error('Only tutors can delete threads'));
      return false;
    }

    try {
      setLoading(true);
      setError(null);

      const { error: deleteError } = await supabase
        .rpc('delete_thread', { p_thread_id: threadId });

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete thread');
      setError(errorMessage);
      console.error('useDeleteThread error:', errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [isTutor]);

  return { loading, error, mutate };
}

/**
 * Bulk delete messages (tutor only)
 */
export function useBulkDeleteMessages() {
  const { isTutor } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (messageIds: string[]): Promise<number> => {
    if (!isTutor) {
      setError(new Error('Only tutors can bulk delete messages'));
      return 0;
    }

    if (messageIds.length === 0) {
      return 0;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: deletedCount, error: deleteError } = await supabase
        .rpc('bulk_delete_messages', { p_message_ids: messageIds });

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return deletedCount || 0;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete messages');
      setError(errorMessage);
      console.error('useBulkDeleteMessages error:', errorMessage);
      return 0;
    } finally {
      setLoading(false);
    }
  }, [isTutor]);

  return { loading, error, mutate };
}

/**
 * Bulk delete threads (tutor only)
 */
export function useBulkDeleteThreads() {
  const { isTutor } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (threadIds: string[]): Promise<number> => {
    if (!isTutor) {
      setError(new Error('Only tutors can bulk delete threads'));
      return 0;
    }

    if (threadIds.length === 0) {
      return 0;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: deletedCount, error: deleteError } = await supabase
        .rpc('bulk_delete_threads', { p_thread_ids: threadIds });

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      return deletedCount || 0;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to delete threads');
      setError(errorMessage);
      console.error('useBulkDeleteThreads error:', errorMessage);
      return 0;
    } finally {
      setLoading(false);
    }
  }, [isTutor]);

  return { loading, error, mutate };
}

/**
 * Bulk archive threads (tutor only)
 */
export function useBulkArchiveThreads() {
  const { isTutor } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutate = useCallback(async (threadIds: string[]): Promise<number> => {
    if (!isTutor) {
      setError(new Error('Only tutors can bulk archive threads'));
      return 0;
    }

    if (threadIds.length === 0) {
      return 0;
    }

    try {
      setLoading(true);
      setError(null);

      const { data: archivedCount, error: archiveError } = await supabase
        .rpc('bulk_archive_threads', { p_thread_ids: threadIds });

      if (archiveError) {
        throw new Error(archiveError.message);
      }

      return archivedCount || 0;
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to archive threads');
      setError(errorMessage);
      console.error('useBulkArchiveThreads error:', errorMessage);
      return 0;
    } finally {
      setLoading(false);
    }
  }, [isTutor]);

  return { loading, error, mutate };
}
