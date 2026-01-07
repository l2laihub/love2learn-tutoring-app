/**
 * useNotifications Hook
 * Data fetching and real-time subscription hooks for the notification system
 *
 * Features:
 * - Real-time updates via Supabase Realtime
 * - Unread count tracking
 * - Support for both direct and broadcast (announcement) notifications
 * - Mark as read functionality
 * - Send announcements (for tutors)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import {
  Notification,
  NotificationWithSender,
  NotificationType,
  NotificationPriority,
  SendAnnouncementInput,
} from '../types/notifications';
import { ListQueryState } from '../types/database';
import type { RealtimeChannel } from '@supabase/supabase-js';

/**
 * Filter options for notifications
 */
export interface NotificationFilterOptions {
  type?: NotificationType;
  unreadOnly?: boolean;
  limit?: number;
}

/**
 * Fetch notifications for the current user with real-time updates
 */
export function useNotifications(
  options: NotificationFilterOptions = {}
): ListQueryState<NotificationWithSender> & {
  unreadCount: number;
  markAsRead: (notificationId: string) => Promise<boolean>;
  markAllAsRead: () => Promise<boolean>;
} {
  const { user, parent, isTutor } = useAuthContext();
  // Use parent.id if available, otherwise fall back to user.id (same value in this app)
  const parentId = parent?.id || user?.id || null;
  const [data, setData] = useState<NotificationWithSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const { type, unreadOnly, limit = 50 } = options;

  // Fetch notifications
  const fetchNotifications = useCallback(async () => {
    if (!parentId) {
      setData([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Build query based on user role
      let query = supabase
        .from('notifications')
        .select(`
          *,
          sender:parents!notifications_sender_id_fkey(id, name, email)
        `)
        .order('created_at', { ascending: false })
        .limit(limit);

      // Apply filters
      if (type) {
        query = query.eq('type', type);
      }

      // For parents, get their direct notifications + announcements (recipient_id IS NULL)
      // For tutors, get all notifications (handled by RLS)
      if (!isTutor) {
        query = query.or(`recipient_id.eq.${parentId},recipient_id.is.null`);
      }

      // Filter by expiration
      query = query.or('expires_at.is.null,expires_at.gt.now()');

      const { data: notifications, error: fetchError } = await query;

      if (fetchError) {
        throw new Error(fetchError.message);
      }

      // For unread filtering, we need to check notification_reads for announcements
      let filteredNotifications = notifications || [];

      if (unreadOnly && !isTutor) {
        // Get read announcement IDs for this user
        const { data: reads } = await supabase
          .from('notification_reads')
          .select('notification_id')
          .eq('parent_id', parentId);

        const readAnnouncementIds = new Set(reads?.map(r => r.notification_id) || []);

        filteredNotifications = filteredNotifications.filter(n => {
          if (n.recipient_id === null) {
            // Announcement - check notification_reads
            return !readAnnouncementIds.has(n.id);
          } else {
            // Direct notification - check read_at
            return n.read_at === null;
          }
        });
      }

      setData(filteredNotifications as NotificationWithSender[]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err : new Error('Failed to fetch notifications');
      setError(errorMessage);
      console.error('useNotifications error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [parentId, isTutor, type, unreadOnly, limit]);

  // Fetch unread count
  const fetchUnreadCount = useCallback(async () => {
    if (!parentId) {
      setUnreadCount(0);
      return;
    }

    try {
      // Use the database function to get accurate count
      const { data: count, error: countError } = await supabase
        .rpc('get_unread_notification_count', { p_parent_id: parentId });

      if (countError) {
        console.error('Error fetching unread count:', countError);
        return;
      }

      setUnreadCount(count || 0);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    }
  }, [parentId]);

  // Mark a single notification as read
  const markAsRead = useCallback(async (notificationId: string): Promise<boolean> => {
    if (!parentId) return false;

    try {
      const { data: success, error: markError } = await supabase
        .rpc('mark_notification_read', {
          p_notification_id: notificationId,
          p_parent_id: parentId,
        });

      if (markError) {
        throw new Error(markError.message);
      }

      if (success) {
        // Update local state
        setData(prev => prev.map(n =>
          n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n
        ));
        setUnreadCount(prev => Math.max(0, prev - 1));
      }

      return success;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      return false;
    }
  }, [parentId]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async (): Promise<boolean> => {
    if (!parentId) return false;

    try {
      // Get all unread notifications
      const unreadNotifications = data.filter(n => {
        if (n.recipient_id === null) {
          // Announcement - we don't have read status in local state
          return true;
        }
        return n.read_at === null;
      });

      // Mark each as read
      const promises = unreadNotifications.map(n =>
        supabase.rpc('mark_notification_read', {
          p_notification_id: n.id,
          p_parent_id: parentId,
        })
      );

      await Promise.all(promises);

      // Update local state
      setData(prev => prev.map(n => ({ ...n, read_at: new Date().toISOString() })));
      setUnreadCount(0);

      return true;
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
      return false;
    }
  }, [parentId, data]);

  // Set up real-time subscription
  useEffect(() => {
    if (!parentId) return;

    // Subscribe to notifications table changes
    const channel = supabase
      .channel(`notifications:${parentId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const newNotification = payload.new as Notification;

          // Check if this notification is for us
          const isForUs = newNotification.recipient_id === parentId ||
            newNotification.recipient_id === null ||
            isTutor;

          if (isForUs) {
            // Refresh to get full data with sender info
            fetchNotifications();
            fetchUnreadCount();
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const updatedNotification = payload.new as Notification;

          // Update local state
          setData(prev => prev.map(n =>
            n.id === updatedNotification.id ? { ...n, ...updatedNotification } : n
          ));
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notifications',
        },
        (payload) => {
          const deletedId = (payload.old as { id: string }).id;
          setData(prev => prev.filter(n => n.id !== deletedId));
          fetchUnreadCount();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [parentId, isTutor, fetchNotifications, fetchUnreadCount]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
    fetchUnreadCount();
  }, [fetchNotifications, fetchUnreadCount]);

  return {
    data,
    loading,
    error,
    refetch: fetchNotifications,
    unreadCount,
    markAsRead,
    markAllAsRead,
  };
}

/**
 * Get unread notification count only (lightweight hook for badge display)
 */
export function useUnreadNotificationCount(): {
  count: number;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const { user, parent } = useAuthContext();
  // Use parent.id if available, otherwise fall back to user.id (same value in this app)
  const parentId = parent?.id || user?.id || null;
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
      setLoading(true);

      const { data: unreadCount, error } = await supabase
        .rpc('get_unread_notification_count', { p_parent_id: parentId });

      if (error) {
        console.error('Error fetching unread count:', error);
        return;
      }

      setCount(unreadCount || 0);
    } catch (err) {
      console.error('Error fetching unread count:', err);
    } finally {
      setLoading(false);
    }
  }, [parentId]);

  // Real-time subscription for count updates
  useEffect(() => {
    if (!parentId) return;

    const channel = supabase
      .channel(`notification_count:${parentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
        },
        () => {
          fetchCount();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_reads',
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

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return { count, loading, refetch: fetchCount };
}

/**
 * Send an announcement (for tutors only)
 */
export function useSendAnnouncement(): {
  sendAnnouncement: (input: SendAnnouncementInput) => Promise<string | null>;
  loading: boolean;
  error: Error | null;
} {
  const { user, parent, isTutor } = useAuthContext();
  // Use parent.id if available, otherwise fall back to user.id (same value in this app)
  const senderId = parent?.id || user?.id || null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const sendAnnouncement = useCallback(
    async (input: SendAnnouncementInput): Promise<string | null> => {
      if (!senderId || !isTutor) {
        setError(new Error('Only tutors can send announcements'));
        return null;
      }

      try {
        setLoading(true);
        setError(null);

        const { data: notificationId, error: sendError } = await supabase
          .rpc('send_announcement', {
            p_sender_id: senderId,
            p_title: input.title,
            p_message: input.message,
            p_priority: input.priority || 'normal',
            p_expires_at: input.expires_at || null,
          });

        if (sendError) {
          throw new Error(sendError.message);
        }

        return notificationId;
      } catch (err) {
        const errorMessage = err instanceof Error ? err : new Error('Failed to send announcement');
        setError(errorMessage);
        console.error('useSendAnnouncement error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [senderId, isTutor]
  );

  return { sendAnnouncement, loading, error };
}

/**
 * Create a notification (for system use or tutors)
 */
export function useCreateNotification(): {
  createNotification: (
    recipientId: string | null,
    type: NotificationType,
    title: string,
    message: string,
    options?: {
      data?: Record<string, unknown>;
      priority?: NotificationPriority;
      actionUrl?: string;
      expiresAt?: string;
    }
  ) => Promise<string | null>;
  loading: boolean;
  error: Error | null;
} {
  const { user, parent } = useAuthContext();
  // Use parent.id if available, otherwise fall back to user.id (same value in this app)
  const parentId = parent?.id || user?.id || null;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createNotification = useCallback(
    async (
      recipientId: string | null,
      type: NotificationType,
      title: string,
      message: string,
      options?: {
        data?: Record<string, unknown>;
        priority?: NotificationPriority;
        actionUrl?: string;
        expiresAt?: string;
      }
    ): Promise<string | null> => {
      try {
        setLoading(true);
        setError(null);

        const { data: notificationId, error: createError } = await supabase
          .rpc('create_notification', {
            p_recipient_id: recipientId,
            p_sender_id: parentId,
            p_type: type,
            p_title: title,
            p_message: message,
            p_data: options?.data || {},
            p_priority: options?.priority || 'normal',
            p_action_url: options?.actionUrl || null,
            p_expires_at: options?.expiresAt || null,
          });

        if (createError) {
          throw new Error(createError.message);
        }

        return notificationId;
      } catch (err) {
        const errorMessage = err instanceof Error ? err : new Error('Failed to create notification');
        setError(errorMessage);
        console.error('useCreateNotification error:', errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [parentId]
  );

  return { createNotification, loading, error };
}

/**
 * Delete a notification (for tutors only)
 */
export function useDeleteNotification(): {
  deleteNotification: (notificationId: string) => Promise<boolean>;
  loading: boolean;
  error: Error | null;
} {
  const { isTutor } = useAuthContext();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const deleteNotification = useCallback(
    async (notificationId: string): Promise<boolean> => {
      if (!isTutor) {
        setError(new Error('Only tutors can delete notifications'));
        return false;
      }

      try {
        setLoading(true);
        setError(null);

        const { error: deleteError } = await supabase
          .from('notifications')
          .delete()
          .eq('id', notificationId);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        return true;
      } catch (err) {
        const errorMessage = err instanceof Error ? err : new Error('Failed to delete notification');
        setError(errorMessage);
        console.error('useDeleteNotification error:', errorMessage);
        return false;
      } finally {
        setLoading(false);
      }
    },
    [isTutor]
  );

  return { deleteNotification, loading, error };
}

/**
 * Get notification type display info
 */
export function getNotificationTypeInfo(type: NotificationType): {
  label: string;
  icon: string;
  color: string;
} {
  switch (type) {
    case 'announcement':
      return { label: 'Announcement', icon: 'megaphone-outline', color: '#6B7AE8' };
    case 'reschedule_request':
      return { label: 'Reschedule Request', icon: 'calendar-outline', color: '#FFC107' };
    case 'reschedule_response':
      return { label: 'Reschedule Update', icon: 'calendar-outline', color: '#3D9CA8' };
    case 'lesson_reminder':
      return { label: 'Lesson Reminder', icon: 'alarm-outline', color: '#FF9800' };
    case 'worksheet_assigned':
      return { label: 'New Worksheet', icon: 'document-text-outline', color: '#7CB342' };
    case 'payment_due':
      return { label: 'Payment Due', icon: 'card-outline', color: '#E53935' };
    case 'general':
    default:
      return { label: 'Notification', icon: 'notifications-outline', color: '#9E9E9E' };
  }
}

/**
 * Get notification priority display info
 */
export function getNotificationPriorityInfo(priority: NotificationPriority): {
  label: string;
  color: string;
  bgColor: string;
} {
  switch (priority) {
    case 'urgent':
      return { label: 'Urgent', color: '#D32F2F', bgColor: '#FFEBEE' };
    case 'high':
      return { label: 'High', color: '#F57C00', bgColor: '#FFF3E0' };
    case 'normal':
      return { label: 'Normal', color: '#1976D2', bgColor: '#E3F2FD' };
    case 'low':
    default:
      return { label: 'Low', color: '#757575', bgColor: '#F5F5F5' };
  }
}
