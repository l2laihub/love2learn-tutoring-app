/**
 * Message types for Love2Learn tutoring app
 * Supports group chats, announcements, images, and emoji reactions
 */

import { Parent } from './database';

// ============================================================================
// Recipient type for message threads
// ============================================================================
export type MessageRecipientType = 'all' | 'group' | 'parent';

// ============================================================================
// Base database record types
// ============================================================================

/**
 * Parent group - for sending messages to specific groups of parents
 */
export interface ParentGroup {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * Parent group member - junction table
 */
export interface ParentGroupMember {
  id: string;
  group_id: string;
  parent_id: string;
  added_at: string;
}

/**
 * Message thread - conversation container
 */
export interface MessageThread {
  id: string;
  subject: string;
  created_by: string;
  recipient_type: MessageRecipientType;
  group_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Message - individual message in a thread
 */
export interface Message {
  id: string;
  thread_id: string;
  sender_id: string;
  content: string;
  images: string[]; // Array of storage paths (max 5)
  created_at: string;
}

/**
 * Message thread participant - tracks who can see threads
 */
export interface MessageThreadParticipant {
  id: string;
  thread_id: string;
  parent_id: string;
  last_read_at: string | null;
  joined_at: string;
}

/**
 * Message reaction - emoji reaction on a message
 */
export interface MessageReaction {
  id: string;
  message_id: string;
  parent_id: string;
  emoji: string;
  created_at: string;
}

// ============================================================================
// Extended types with relations
// ============================================================================

/**
 * Parent group with its members
 */
export interface ParentGroupWithMembers extends ParentGroup {
  members: Parent[];
  member_count?: number;
}

/**
 * Parent group member with parent details
 */
export interface ParentGroupMemberWithParent extends ParentGroupMember {
  parent: Parent;
}

/**
 * Message with sender info
 */
export interface MessageWithSender extends Message {
  sender: Parent;
}

/**
 * Reaction summary for display (aggregated by emoji)
 */
export interface ReactionSummary {
  emoji: string;
  count: number;
  reacted_by_me: boolean;
  reactors?: Parent[]; // Optional: list of who reacted
}

/**
 * Message with all details (sender + reactions)
 */
export interface MessageWithDetails extends Message {
  sender: Parent;
  reactions: ReactionSummary[];
}

/**
 * Thread preview for list display
 * Returned by get_threads_with_preview RPC
 */
export interface ThreadWithPreview {
  id: string;
  subject: string;
  created_by: string;
  creator_name: string;
  recipient_type: MessageRecipientType;
  group_id: string | null;
  group_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  latest_message_id: string | null;
  latest_message_content: string | null;
  latest_message_sender_id: string | null;
  latest_message_sender_name: string | null;
  latest_message_created_at: string | null;
  unread_count: number;
  participant_count: number;
}

/**
 * Thread with full details (for detail view)
 */
export interface ThreadWithDetails extends MessageThread {
  creator: Parent;
  group: ParentGroup | null;
  participants: Parent[];
  messages: MessageWithDetails[];
}

// ============================================================================
// Input types for mutations
// ============================================================================

/**
 * Input for creating a parent group
 */
export interface CreateParentGroupInput {
  name: string;
  description?: string | null;
  member_ids: string[]; // Parent IDs to add as members
}

/**
 * Input for updating a parent group
 */
export interface UpdateParentGroupInput {
  name?: string;
  description?: string | null;
  member_ids?: string[]; // If provided, replaces all members
}

/**
 * Input for creating a message thread (announcement)
 */
export interface CreateMessageThreadInput {
  subject: string;
  content: string; // Initial message content
  recipient_type: MessageRecipientType;
  group_id?: string | null; // Required if recipient_type is 'group'
  parent_ids?: string[]; // Required if recipient_type is 'parent' (individual parent selection)
  images?: string[]; // Optional images for initial message
}

/**
 * Input for sending a message (reply)
 */
export interface SendMessageInput {
  thread_id: string;
  content: string;
  images?: string[];
}

/**
 * Input for toggling a reaction
 */
export interface ToggleReactionInput {
  message_id: string;
  emoji: string;
}

// ============================================================================
// Quick reaction presets
// ============================================================================

/**
 * Default quick reaction emojis for the reaction picker
 */
export const QUICK_REACTIONS = ['👍', '❤️', '😊', '😂', '😮', '😢'] as const;

export type QuickReaction = typeof QUICK_REACTIONS[number];

// ============================================================================
// State types for hooks
// ============================================================================

/**
 * State for useMessageThreads hook
 */
export interface MessageThreadsState {
  threads: ThreadWithPreview[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * State for useMessageThread hook (single thread with messages)
 */
export interface MessageThreadState {
  thread: ThreadWithDetails | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * State for useParentGroups hook
 */
export interface ParentGroupsState {
  groups: ParentGroupWithMembers[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * State for mutation hooks
 */
export interface MessageMutationState<T, TInput = unknown> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  mutate: (input: TInput) => Promise<T | null>;
  reset: () => void;
}
