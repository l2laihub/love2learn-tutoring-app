/**
 * Notification types for Love2Learn tutoring app
 */

import { Json, Parent } from './database';

// Notification type enum
export type NotificationType =
  | 'announcement'
  | 'reschedule_request'
  | 'reschedule_response'
  | 'enrollment_request'
  | 'enrollment_response'
  | 'dropin_request'
  | 'dropin_response'
  | 'lesson_reminder'
  | 'worksheet_assigned'
  | 'payment_due'
  | 'general';

// Notification priority enum
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// Notification record
export interface Notification {
  id: string;
  recipient_id: string | null; // NULL = broadcast to all parents
  sender_id: string | null;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  data: Json;
  action_url: string | null;
  read_at: string | null;
  created_at: string;
  expires_at: string | null;
}

// Notification with sender info
export interface NotificationWithSender extends Notification {
  sender?: Parent | null;
}

// Notification read record (for tracking broadcast reads)
export interface NotificationRead {
  id: string;
  notification_id: string;
  parent_id: string;
  read_at: string;
}

// Input types for notifications
export interface CreateNotificationInput {
  recipient_id?: string | null;
  type: NotificationType;
  title: string;
  message: string;
  data?: Json;
  priority?: NotificationPriority;
  action_url?: string | null;
  expires_at?: string | null;
}

export interface SendAnnouncementInput {
  title: string;
  message: string;
  priority?: NotificationPriority;
  expires_at?: string | null;
}

// Notification data types for specific notification types
export interface RescheduleRequestNotificationData {
  request_id: string;
  student_id: string;
  student_name: string;
  parent_name: string;
  subject: string;
  preferred_date: string;
  preferred_time: string | null;
}

export interface RescheduleResponseNotificationData {
  request_id: string;
  student_id: string;
  student_name: string;
  status: 'approved' | 'rejected' | 'scheduled';
  tutor_response: string | null;
}
