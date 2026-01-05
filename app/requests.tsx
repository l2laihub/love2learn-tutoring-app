/**
 * Lesson Requests Screen
 * Admin/Tutor view to manage lesson reschedule requests from parents
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../src/contexts/AuthContext';
import {
  useLessonRequests,
  useApproveLessonRequest,
  useRejectLessonRequest,
  getRequestStatusInfo,
} from '../src/hooks/useLessonRequests';
import { useCreateLesson } from '../src/hooks/useLessons';
import { formatTimeDisplay } from '../src/hooks/useTutorAvailability';
import { LessonRequestWithStudent, TutoringSubject } from '../src/types/database';
import { colors, spacing, typography, borderRadius, shadows, getSubjectColor } from '../src/theme';

// Subject display names
const SUBJECT_NAMES: Record<TutoringSubject, string> = {
  piano: 'Piano',
  math: 'Math',
  reading: 'Reading',
  speech: 'Speech',
  english: 'English',
};

const SUBJECT_EMOJI: Record<TutoringSubject, string> = {
  piano: '🎹',
  math: '➗',
  reading: '📖',
  speech: '🗣️',
  english: '📝',
};

type TabType = 'pending' | 'all';

export default function RequestsScreen() {
  const { isTutor } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [selectedRequest, setSelectedRequest] = useState<LessonRequestWithStudent | null>(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Fetch requests based on tab
  const {
    data: requests,
    loading,
    error,
    refetch,
  } = useLessonRequests(
    activeTab === 'pending' ? { status: 'pending' } : {}
  );

  const { approveRequest, loading: approving } = useApproveLessonRequest();
  const { rejectRequest, loading: rejecting } = useRejectLessonRequest();
  const { createLesson } = useCreateLesson();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleApprove = (request: LessonRequestWithStudent) => {
    setSelectedRequest(request);
    setShowApproveModal(true);
  };

  const handleReject = (request: LessonRequestWithStudent) => {
    setSelectedRequest(request);
    setShowRejectModal(true);
  };

  // Redirect if not a tutor
  if (!isTutor) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Not Authorized' }} />
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed" size={64} color={colors.neutral.textMuted} />
          <Text style={styles.emptyStateTitle}>Tutor Access Only</Text>
          <Text style={styles.emptyStateText}>
            This page is only accessible to tutors.
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Count pending requests
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'Lesson Requests',
          headerStyle: { backgroundColor: colors.primary.main },
          headerTintColor: colors.neutral.textInverse,
          headerTitleStyle: { fontWeight: '600' },
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{ padding: spacing.sm, marginLeft: -spacing.sm }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.neutral.textInverse} />
            </Pressable>
          ),
        }}
      />

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <Pressable
          style={[styles.tab, activeTab === 'pending' && styles.tabActive]}
          onPress={() => setActiveTab('pending')}
        >
          <Text style={[styles.tabText, activeTab === 'pending' && styles.tabTextActive]}>
            Pending
          </Text>
          {pendingCount > 0 && (
            <View style={styles.tabBadge}>
              <Text style={styles.tabBadgeText}>{pendingCount}</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'all' && styles.tabActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            All Requests
          </Text>
        </Pressable>
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
        {!loading && requests.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="mail-open-outline" size={64} color={colors.neutral.textMuted} />
            <Text style={styles.emptyStateTitle}>
              {activeTab === 'pending' ? 'No Pending Requests' : 'No Requests Yet'}
            </Text>
            <Text style={styles.emptyStateText}>
              {activeTab === 'pending'
                ? 'All reschedule requests have been processed.'
                : 'Reschedule requests from parents will appear here.'}
            </Text>
          </View>
        )}

        {/* Request Cards */}
        {!loading && requests.length > 0 && (
          <View style={styles.requestsList}>
            {requests.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                onApprove={() => handleApprove(request)}
                onReject={() => handleReject(request)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Approve Modal */}
      <ApproveModal
        visible={showApproveModal}
        request={selectedRequest}
        onClose={() => {
          setShowApproveModal(false);
          setSelectedRequest(null);
        }}
        onApprove={async (response, createScheduledLesson) => {
          if (!selectedRequest) return;

          let lessonId: string | undefined;

          // Optionally create the scheduled lesson
          if (createScheduledLesson) {
            const scheduledAt = new Date(selectedRequest.preferred_date);
            if (selectedRequest.preferred_time) {
              const [hours, minutes] = selectedRequest.preferred_time.split(':').map(Number);
              scheduledAt.setHours(hours, minutes, 0, 0);
            }

            const lesson = await createLesson({
              student_id: selectedRequest.student_id,
              subject: selectedRequest.subject as TutoringSubject,
              scheduled_at: scheduledAt.toISOString(),
              duration_min: selectedRequest.preferred_duration,
              notes: `Rescheduled from request: ${selectedRequest.notes || 'No notes'}`,
            });

            if (lesson) {
              lessonId = lesson.id;
            }
          }

          const result = await approveRequest(
            selectedRequest.id,
            response,
            lessonId
          );

          if (result) {
            setShowApproveModal(false);
            setSelectedRequest(null);
            refetch();
          }
        }}
        loading={approving}
      />

      {/* Reject Modal */}
      <RejectModal
        visible={showRejectModal}
        request={selectedRequest}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedRequest(null);
        }}
        onReject={async (reason) => {
          if (!selectedRequest) return;

          const result = await rejectRequest(selectedRequest.id, reason);

          if (result) {
            setShowRejectModal(false);
            setSelectedRequest(null);
            refetch();
          }
        }}
        loading={rejecting}
      />
    </SafeAreaView>
  );
}

// Request Card Component
interface RequestCardProps {
  request: LessonRequestWithStudent;
  onApprove: () => void;
  onReject: () => void;
}

function RequestCard({ request, onApprove, onReject }: RequestCardProps) {
  const statusInfo = getRequestStatusInfo(request.status);
  const subjectColor = getSubjectColor(request.subject as TutoringSubject);
  const preferredDate = new Date(request.preferred_date);
  const createdAt = new Date(request.created_at);

  return (
    <View style={styles.requestCard}>
      {/* Header */}
      <View style={[styles.requestHeader, { backgroundColor: subjectColor.subtle }]}>
        <Text style={styles.requestSubjectIcon}>
          {SUBJECT_EMOJI[request.subject as TutoringSubject] || '📚'}
        </Text>
        <View style={styles.requestHeaderInfo}>
          <Text style={styles.requestStudentName}>{request.student.name}</Text>
          <Text style={styles.requestSubject}>
            {SUBJECT_NAMES[request.subject as TutoringSubject] || request.subject}
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
          <Ionicons
            name={statusInfo.icon as any}
            size={14}
            color={statusInfo.color}
          />
          <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {/* Content */}
      <View style={styles.requestContent}>
        <View style={styles.requestDetail}>
          <Ionicons name="calendar-outline" size={18} color={colors.neutral.textSecondary} />
          <Text style={styles.requestDetailText}>
            {preferredDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </View>

        {request.preferred_time && (
          <View style={styles.requestDetail}>
            <Ionicons name="time-outline" size={18} color={colors.neutral.textSecondary} />
            <Text style={styles.requestDetailText}>
              {formatTimeDisplay(request.preferred_time)}
            </Text>
          </View>
        )}

        <View style={styles.requestDetail}>
          <Ionicons name="hourglass-outline" size={18} color={colors.neutral.textSecondary} />
          <Text style={styles.requestDetailText}>
            {request.preferred_duration} minutes
          </Text>
        </View>

        {request.notes && (
          <View style={styles.requestNotes}>
            <Text style={styles.requestNotesLabel}>Parent's note:</Text>
            <Text style={styles.requestNotesText}>{request.notes}</Text>
          </View>
        )}

        {request.tutor_response && (
          <View style={styles.responseBox}>
            <Text style={styles.responseLabel}>Your response:</Text>
            <Text style={styles.responseText}>{request.tutor_response}</Text>
          </View>
        )}

        <Text style={styles.requestTimestamp}>
          Requested {createdAt.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })} at {createdAt.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>

      {/* Actions - only for pending requests */}
      {request.status === 'pending' && (
        <View style={styles.requestActions}>
          <Pressable style={styles.rejectButton} onPress={onReject}>
            <Ionicons name="close-circle-outline" size={20} color={colors.status.error} />
            <Text style={styles.rejectButtonText}>Decline</Text>
          </Pressable>
          <Pressable style={styles.approveButton} onPress={onApprove}>
            <Ionicons name="checkmark-circle" size={20} color={colors.neutral.white} />
            <Text style={styles.approveButtonText}>Approve</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// Approve Modal Component
interface ApproveModalProps {
  visible: boolean;
  request: LessonRequestWithStudent | null;
  onClose: () => void;
  onApprove: (response: string, createLesson: boolean) => Promise<void>;
  loading: boolean;
}

function ApproveModal({ visible, request, onClose, onApprove, loading }: ApproveModalProps) {
  const [response, setResponse] = useState('');
  const [createLesson, setCreateLesson] = useState(true);

  React.useEffect(() => {
    if (visible) {
      setResponse('');
      setCreateLesson(true);
    }
  }, [visible]);

  if (!request) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.dialog}>
          <Ionicons name="checkmark-circle" size={48} color={colors.status.success} />
          <Text style={modalStyles.title}>Approve Request</Text>
          <Text style={modalStyles.subtitle}>
            Approve {request.student.name}'s reschedule request for{' '}
            {new Date(request.preferred_date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
            {request.preferred_time && ` at ${formatTimeDisplay(request.preferred_time)}`}
          </Text>

          {/* Create Lesson Toggle */}
          <Pressable
            style={[
              modalStyles.toggleOption,
              createLesson && modalStyles.toggleOptionActive,
            ]}
            onPress={() => setCreateLesson(!createLesson)}
          >
            <Ionicons
              name={createLesson ? 'checkbox' : 'square-outline'}
              size={24}
              color={createLesson ? colors.primary.main : colors.neutral.border}
            />
            <Text style={modalStyles.toggleText}>
              Create scheduled lesson automatically
            </Text>
          </Pressable>

          <TextInput
            style={modalStyles.input}
            value={response}
            onChangeText={setResponse}
            placeholder="Add a message (optional)"
            placeholderTextColor={colors.neutral.textMuted}
            multiline
          />

          <View style={modalStyles.actions}>
            <Pressable
              style={modalStyles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={modalStyles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[modalStyles.submitButton, modalStyles.approveSubmit]}
              onPress={() => onApprove(response.trim(), createLesson)}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <Text style={modalStyles.submitButtonText}>Approve</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Reject Modal Component
interface RejectModalProps {
  visible: boolean;
  request: LessonRequestWithStudent | null;
  onClose: () => void;
  onReject: (reason: string) => Promise<void>;
  loading: boolean;
}

function RejectModal({ visible, request, onClose, onReject, loading }: RejectModalProps) {
  const [reason, setReason] = useState('');

  React.useEffect(() => {
    if (visible) {
      setReason('');
    }
  }, [visible]);

  if (!request) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.dialog}>
          <Ionicons name="close-circle" size={48} color={colors.status.error} />
          <Text style={modalStyles.title}>Decline Request</Text>
          <Text style={modalStyles.subtitle}>
            Let {request.student.name}'s parent know why this time doesn't work.
          </Text>

          <TextInput
            style={modalStyles.input}
            value={reason}
            onChangeText={setReason}
            placeholder="Reason for declining (optional but recommended)"
            placeholderTextColor={colors.neutral.textMuted}
            multiline
          />

          <View style={modalStyles.actions}>
            <Pressable
              style={modalStyles.cancelButton}
              onPress={onClose}
              disabled={loading}
            >
              <Text style={modalStyles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[modalStyles.submitButton, modalStyles.rejectSubmit]}
              onPress={() => onReject(reason.trim())}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <Text style={modalStyles.submitButtonText}>Decline</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing.xxl,
  },
  loadingContainer: {
    padding: spacing.xxl,
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
    padding: spacing.xxl,
    marginTop: spacing.xxl,
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
  backButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  requestsList: {
    gap: spacing.md,
  },
  requestCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  requestSubjectIcon: {
    fontSize: 32,
  },
  requestHeaderInfo: {
    flex: 1,
  },
  requestStudentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  requestSubject: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  requestContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  requestDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  requestDetailText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
  },
  requestNotes: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
  },
  requestNotesLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginBottom: spacing.xs,
  },
  requestNotesText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
    fontStyle: 'italic',
  },
  responseBox: {
    marginTop: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.primary.subtle,
    borderRadius: borderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary.main,
  },
  responseLabel: {
    fontSize: typography.sizes.xs,
    color: colors.primary.dark,
    marginBottom: spacing.xs,
  },
  responseText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
  },
  requestTimestamp: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: spacing.sm,
  },
  requestActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  rejectButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.status.error,
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.success,
  },
  approveButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.neutral.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  dialog: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    ...shadows.lg,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  toggleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '100%',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: spacing.md,
  },
  toggleOptionActive: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.subtle,
  },
  toggleText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
  },
  input: {
    width: '100%',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: spacing.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  cancelButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  submitButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveSubmit: {
    backgroundColor: colors.status.success,
  },
  rejectSubmit: {
    backgroundColor: colors.status.error,
  },
  submitButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});
