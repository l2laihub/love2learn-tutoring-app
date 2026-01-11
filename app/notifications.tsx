/**
 * Notifications Screen
 * View all notifications and announcements with real-time updates
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../src/contexts/AuthContext';
import {
  useNotifications,
  getNotificationTypeInfo,
  getNotificationPriorityInfo,
} from '../src/hooks/useNotifications';
import { NotificationWithSender, NotificationType } from '../src/types/notifications';
import { colors, spacing, typography, borderRadius, shadows } from '../src/theme';
import { AnnouncementModal } from '../src/components/AnnouncementModal';

type TabType = 'all' | 'unread';

export default function NotificationsScreen() {
  const router = useRouter();
  const { isTutor } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationWithSender | null>(null);

  const {
    data: notifications,
    loading,
    error,
    refetch,
    unreadCount,
    markAsRead,
    markAllAsRead,
  } = useNotifications({
    unreadOnly: activeTab === 'unread',
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleNotificationPress = async (notification: NotificationWithSender) => {
    // Mark as read
    await markAsRead(notification.id);

    // For rejected reschedule responses, always show the detail modal so parent can see the rejection note
    const notificationData = notification.data as Record<string, unknown> | null;
    const isRejectedReschedule = notification.type === 'reschedule_response' &&
      notificationData?.status === 'rejected';

    if (isRejectedReschedule) {
      // Show detail modal with rejection note
      setSelectedNotification(notification);
    } else if (notification.action_url) {
      // Navigate to action URL for other notifications
      router.push(notification.action_url as any);
    } else {
      // Show notification detail modal for notifications without action URL
      setSelectedNotification(notification);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          headerRight: () =>
            isTutor ? (
              <Pressable
                onPress={() => setShowAnnouncementModal(true)}
                style={{ padding: spacing.sm, marginRight: spacing.xs }}
              >
                <Ionicons name="megaphone-outline" size={24} color={colors.neutral.textInverse} />
              </Pressable>
            ) : null,
        }}
      />

      {/* Tabs and Mark All Read */}
      <View style={styles.header}>
        <View style={styles.tabsContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'all' && styles.tabActive]}
            onPress={() => setActiveTab('all')}
          >
            <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
              All
            </Text>
          </Pressable>
          <Pressable
            style={[styles.tab, activeTab === 'unread' && styles.tabActive]}
            onPress={() => setActiveTab('unread')}
          >
            <Text style={[styles.tabText, activeTab === 'unread' && styles.tabTextActive]}>
              Unread
            </Text>
            {unreadCount > 0 && (
              <View style={styles.tabBadge}>
                <Text style={styles.tabBadgeText}>{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {unreadCount > 0 && (
          <Pressable style={styles.markAllButton} onPress={handleMarkAllRead}>
            <Text style={styles.markAllButtonText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={24} color={colors.status.error} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}

        {/* Empty State */}
        {!loading && notifications.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.neutral.textMuted} />
            <Text style={styles.emptyStateTitle}>
              {activeTab === 'unread' ? 'All Caught Up!' : 'No Notifications Yet'}
            </Text>
            <Text style={styles.emptyStateText}>
              {activeTab === 'unread'
                ? "You've read all your notifications."
                : 'Notifications will appear here when you receive them.'}
            </Text>
          </View>
        )}

        {/* Notification Cards */}
        {!loading && notifications.length > 0 && (
          <View style={styles.notificationsList}>
            {notifications.map((notification) => (
              <NotificationCard
                key={notification.id}
                notification={notification}
                onPress={() => handleNotificationPress(notification)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Floating Action Button for tutors to create announcements */}
      {isTutor && (
        <Pressable
          style={styles.fab}
          onPress={() => setShowAnnouncementModal(true)}
        >
          <Ionicons name="megaphone" size={24} color={colors.neutral.white} />
          <Text style={styles.fabText}>New Announcement</Text>
        </Pressable>
      )}

      {/* Announcement Modal (for tutors) */}
      {isTutor && (
        <AnnouncementModal
          visible={showAnnouncementModal}
          onClose={() => setShowAnnouncementModal(false)}
          onSuccess={() => {
            setShowAnnouncementModal(false);
            refetch();
          }}
        />
      )}

      {/* Notification Detail Modal */}
      <NotificationDetailModal
        notification={selectedNotification}
        visible={selectedNotification !== null}
        onClose={() => setSelectedNotification(null)}
      />
    </SafeAreaView>
  );
}

// Notification Card Component
interface NotificationCardProps {
  notification: NotificationWithSender;
  onPress: () => void;
}

function NotificationCard({ notification, onPress }: NotificationCardProps) {
  const typeInfo = getNotificationTypeInfo(notification.type);
  const priorityInfo = getNotificationPriorityInfo(notification.priority);
  const isUnread = notification.read_at === null;
  const createdAt = new Date(notification.created_at);

  // Format relative time
  const getRelativeTime = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Pressable
      style={[
        styles.notificationCard,
        isUnread && styles.notificationCardUnread,
      ]}
      onPress={onPress}
    >
      {/* Icon */}
      <View style={[styles.notificationIcon, { backgroundColor: typeInfo.color + '20' }]}>
        <Ionicons name={typeInfo.icon as any} size={24} color={typeInfo.color} />
      </View>

      {/* Content */}
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <View style={styles.notificationTitleRow}>
            <Text style={[styles.notificationTitle, isUnread && styles.notificationTitleUnread]}>
              {notification.title}
            </Text>
            {notification.priority === 'high' || notification.priority === 'urgent' ? (
              <View style={[styles.priorityBadge, { backgroundColor: priorityInfo.bgColor }]}>
                <Text style={[styles.priorityBadgeText, { color: priorityInfo.color }]}>
                  {priorityInfo.label}
                </Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.notificationTime}>{getRelativeTime(createdAt)}</Text>
        </View>

        <Text style={styles.notificationMessage} numberOfLines={2}>
          {notification.message}
        </Text>

        {/* Type badge and sender info */}
        <View style={styles.notificationFooter}>
          <View style={[styles.typeBadge, { backgroundColor: typeInfo.color + '15' }]}>
            <Text style={[styles.typeBadgeText, { color: typeInfo.color }]}>
              {typeInfo.label}
            </Text>
          </View>
          {notification.sender && (
            <Text style={styles.senderText}>
              from {notification.sender.name}
            </Text>
          )}
        </View>
      </View>

      {/* Unread indicator */}
      {isUnread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

// Notification Detail Modal Component
interface NotificationDetailModalProps {
  notification: NotificationWithSender | null;
  visible: boolean;
  onClose: () => void;
}

function NotificationDetailModal({ notification, visible, onClose }: NotificationDetailModalProps) {
  if (!notification) return null;

  const typeInfo = getNotificationTypeInfo(notification.type);
  const priorityInfo = getNotificationPriorityInfo(notification.priority);
  const createdAt = new Date(notification.created_at);

  // Extract tutor response from notification data for reschedule responses
  const notificationData = notification.data as Record<string, unknown> | null;
  const isRejectedReschedule = notification.type === 'reschedule_response' &&
    notificationData?.status === 'rejected';
  const tutorResponse = notificationData?.tutor_response as string | null;

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.modalContainer}>
        {/* Header */}
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose} style={styles.modalCloseButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={styles.modalHeaderTitle}>Notification</Text>
          <View style={styles.modalCloseButton} />
        </View>

        <ScrollView style={styles.modalContent}>
          {/* Icon and Type */}
          <View style={styles.modalIconContainer}>
            <View style={[styles.modalIcon, { backgroundColor: typeInfo.color + '20' }]}>
              <Ionicons name={typeInfo.icon as any} size={32} color={typeInfo.color} />
            </View>
            <View style={[styles.modalTypeBadge, { backgroundColor: typeInfo.color + '15' }]}>
              <Text style={[styles.modalTypeBadgeText, { color: typeInfo.color }]}>
                {typeInfo.label}
              </Text>
            </View>
            {(notification.priority === 'high' || notification.priority === 'urgent') && (
              <View style={[styles.modalPriorityBadge, { backgroundColor: priorityInfo.bgColor }]}>
                <Text style={[styles.modalPriorityBadgeText, { color: priorityInfo.color }]}>
                  {priorityInfo.label}
                </Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={styles.modalTitle}>{notification.title}</Text>

          {/* Metadata */}
          <View style={styles.modalMetadata}>
            <Text style={styles.modalDate}>{formatDate(createdAt)}</Text>
            {notification.sender && (
              <Text style={styles.modalSender}>From: {notification.sender.name}</Text>
            )}
          </View>

          {/* Message */}
          <View style={styles.modalMessageContainer}>
            <Text style={styles.modalMessage}>{notification.message}</Text>
          </View>

          {/* Rejection Note Section - shown for rejected reschedule responses */}
          {isRejectedReschedule && (
            <View style={styles.rejectionNoteContainer}>
              <View style={styles.rejectionNoteHeader}>
                <Ionicons name="chatbubble-outline" size={18} color={colors.status.error} />
                <Text style={styles.rejectionNoteTitle}>Tutor's Note</Text>
              </View>
              <Text style={styles.rejectionNoteText}>
                {tutorResponse || 'No specific reason was provided. Please contact your tutor for more details.'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.modalFooter}>
          <Pressable style={styles.modalDismissButton} onPress={onClose}>
            <Text style={styles.modalDismissButtonText}>Dismiss</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
    paddingRight: spacing.md,
  },
  tabsContainer: {
    flexDirection: 'row',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary.main,
  },
  tabText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  tabTextActive: {
    color: colors.primary.main,
  },
  tabBadge: {
    backgroundColor: colors.status.error,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  tabBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  markAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  markAllButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing['3xl'],
  },
  loadingContainer: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.errorBg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.status.error,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    marginTop: spacing['2xl'],
  },
  emptyStateTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  notificationsList: {
    gap: spacing.sm,
  },
  notificationCard: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    ...shadows.sm,
  },
  notificationCardUnread: {
    backgroundColor: colors.primary.subtle,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.main,
  },
  notificationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationContent: {
    flex: 1,
    gap: spacing.xs,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  notificationTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  notificationTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  notificationTitleUnread: {
    fontWeight: typography.weights.semibold,
  },
  notificationTime: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  notificationMessage: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
  },
  notificationFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  typeBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  priorityBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  priorityBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  senderText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary.main,
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    ...shadows.lg,
  },
  fabText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalHeaderTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  modalContent: {
    flex: 1,
    padding: spacing.lg,
  },
  modalIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalTypeBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  modalTypeBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  modalPriorityBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  modalPriorityBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  modalTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  modalMetadata: {
    marginBottom: spacing.lg,
  },
  modalDate: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  modalSender: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  modalMessageContainer: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  modalMessage: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    lineHeight: 24,
  },
  rejectionNoteContainer: {
    backgroundColor: colors.status.errorBg,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.status.error,
  },
  rejectionNoteHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rejectionNoteTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.status.error,
  },
  rejectionNoteText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  modalFooter: {
    padding: spacing.lg,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  modalDismissButton: {
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  modalDismissButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});
