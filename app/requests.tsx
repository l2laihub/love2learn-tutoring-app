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
import { useCreateLesson, useCreateGroupedLesson } from '../src/hooks/useLessons';
import { formatTimeDisplay } from '../src/hooks/useTutorAvailability';
import { LessonRequestWithStudent, TutoringSubject, LessonRequest } from '../src/types/database';
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

// Helper to parse YYYY-MM-DD date string as local time (avoids UTC timezone issues)
function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

// Grouped request type for combined sessions
interface GroupedRequest {
  id: string; // First request ID or group_id
  requests: LessonRequestWithStudent[];
  isCombinedSession: boolean;
  student_names: string[];
  subjects: TutoringSubject[];
  preferred_date: string;
  preferred_time: string | null;
  preferred_duration: number;
  notes: string | null;
  status: LessonRequest['status'];
  tutor_response: string | null;
  created_at: string;
}

// Helper function to group requests by request_group_id
function groupRequests(requests: LessonRequestWithStudent[]): GroupedRequest[] {
  const groupMap = new Map<string, LessonRequestWithStudent[]>();
  const standaloneRequests: LessonRequestWithStudent[] = [];

  // Separate grouped and standalone requests
  for (const request of requests) {
    if (request.request_group_id) {
      const existing = groupMap.get(request.request_group_id) || [];
      groupMap.set(request.request_group_id, [...existing, request]);
    } else {
      standaloneRequests.push(request);
    }
  }

  const result: GroupedRequest[] = [];

  // Convert grouped requests
  for (const [groupId, groupedRequests] of groupMap) {
    const first = groupedRequests[0];
    result.push({
      id: groupId,
      requests: groupedRequests,
      isCombinedSession: groupedRequests.length > 1,
      student_names: groupedRequests.map(r => r.student.name),
      subjects: groupedRequests.map(r => r.subject as TutoringSubject),
      preferred_date: first.preferred_date,
      preferred_time: first.preferred_time,
      preferred_duration: first.preferred_duration,
      notes: first.notes,
      status: first.status,
      tutor_response: first.tutor_response,
      created_at: first.created_at,
    });
  }

  // Convert standalone requests
  for (const request of standaloneRequests) {
    result.push({
      id: request.id,
      requests: [request],
      isCombinedSession: false,
      student_names: [request.student.name],
      subjects: [request.subject as TutoringSubject],
      preferred_date: request.preferred_date,
      preferred_time: request.preferred_time,
      preferred_duration: request.preferred_duration,
      notes: request.notes,
      status: request.status,
      tutor_response: request.tutor_response,
      created_at: request.created_at,
    });
  }

  // Sort by created_at descending
  return result.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export default function RequestsScreen() {
  const { isTutor } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('pending');
  const [selectedGroupedRequest, setSelectedGroupedRequest] = useState<GroupedRequest | null>(null);
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
  const { mutate: createLesson } = useCreateLesson();
  const { mutate: createGroupedLesson } = useCreateGroupedLesson();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Group the requests
  const groupedRequests = React.useMemo(() => groupRequests(requests), [requests]);

  const handleApprove = (groupedRequest: GroupedRequest) => {
    setSelectedGroupedRequest(groupedRequest);
    setShowApproveModal(true);
  };

  const handleReject = (groupedRequest: GroupedRequest) => {
    setSelectedGroupedRequest(groupedRequest);
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

  // Count pending grouped requests
  const pendingCount = groupedRequests.filter((r) => r.status === 'pending').length;

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
        {!loading && groupedRequests.length === 0 && (
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
        {!loading && groupedRequests.length > 0 && (
          <View style={styles.requestsList}>
            {groupedRequests.map((groupedRequest) => (
              <GroupedRequestCard
                key={groupedRequest.id}
                groupedRequest={groupedRequest}
                onApprove={() => handleApprove(groupedRequest)}
                onReject={() => handleReject(groupedRequest)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      {/* Approve Modal */}
      <ApproveGroupedModal
        visible={showApproveModal}
        groupedRequest={selectedGroupedRequest}
        onClose={() => {
          setShowApproveModal(false);
          setSelectedGroupedRequest(null);
        }}
        onApprove={async (response, createScheduledLesson) => {
          if (!selectedGroupedRequest) return;

          let allSucceeded = true;
          const isCombinedSession = selectedGroupedRequest.isCombinedSession;

          // Build the scheduled time - parse date as local time to avoid timezone issues
          const scheduledAt = parseLocalDate(selectedGroupedRequest.preferred_date);
          if (selectedGroupedRequest.preferred_time) {
            const [hours, minutes] = selectedGroupedRequest.preferred_time.split(':').map(Number);
            scheduledAt.setHours(hours, minutes, 0, 0);
          }

          // Map to store request_id -> lesson_id for approval
          const requestLessonMap = new Map<string, string>();

          // Optionally create the scheduled lesson(s)
          if (createScheduledLesson) {
            if (isCombinedSession && selectedGroupedRequest.requests.length > 1) {
              // For combined sessions, create a grouped lesson session
              const sessionInput = {
                scheduled_at: scheduledAt.toISOString(),
                duration_min: selectedGroupedRequest.preferred_duration,
                notes: `Rescheduled combined session: ${selectedGroupedRequest.notes || 'No notes'}`,
              };

              // Calculate individual lesson duration (total / number of students)
              const individualDuration = Math.floor(
                selectedGroupedRequest.preferred_duration / selectedGroupedRequest.requests.length
              );

              const lessonInputs = selectedGroupedRequest.requests.map(request => ({
                student_id: request.student_id,
                subject: request.subject as TutoringSubject,
                scheduled_at: scheduledAt.toISOString(),
                duration_min: individualDuration,
                notes: `Rescheduled from request: ${request.notes || 'No notes'}`,
              }));

              const result = await createGroupedLesson(sessionInput, lessonInputs);

              if (result && result.lessons) {
                // Map each request to its corresponding lesson
                for (let i = 0; i < selectedGroupedRequest.requests.length; i++) {
                  const request = selectedGroupedRequest.requests[i];
                  const lesson = result.lessons.find(l => l.student_id === request.student_id);
                  if (lesson) {
                    requestLessonMap.set(request.id, lesson.id);
                  }
                }
              } else {
                allSucceeded = false;
              }
            } else {
              // Single lesson - original behavior
              const request = selectedGroupedRequest.requests[0];
              const lesson = await createLesson({
                student_id: request.student_id,
                subject: request.subject as TutoringSubject,
                scheduled_at: scheduledAt.toISOString(),
                duration_min: selectedGroupedRequest.preferred_duration,
                notes: `Rescheduled from request: ${request.notes || 'No notes'}`,
              });

              if (lesson) {
                requestLessonMap.set(request.id, lesson.id);
              }
            }
          }

          // Approve all requests in the group
          for (const request of selectedGroupedRequest.requests) {
            const lessonId = requestLessonMap.get(request.id);
            const result = await approveRequest(request.id, response, lessonId);

            if (!result) {
              allSucceeded = false;
            }
          }

          if (allSucceeded) {
            setShowApproveModal(false);
            setSelectedGroupedRequest(null);
            refetch();
          }
        }}
        loading={approving}
      />

      {/* Reject Modal */}
      <RejectGroupedModal
        visible={showRejectModal}
        groupedRequest={selectedGroupedRequest}
        onClose={() => {
          setShowRejectModal(false);
          setSelectedGroupedRequest(null);
        }}
        onReject={async (reason) => {
          if (!selectedGroupedRequest) return;

          // Reject all requests in the group
          let allSucceeded = true;
          for (const request of selectedGroupedRequest.requests) {
            const result = await rejectRequest(request.id, reason);
            if (!result) {
              allSucceeded = false;
            }
          }

          if (allSucceeded) {
            setShowRejectModal(false);
            setSelectedGroupedRequest(null);
            refetch();
          }
        }}
        loading={rejecting}
      />
    </SafeAreaView>
  );
}

// Grouped Request Card Component
interface GroupedRequestCardProps {
  groupedRequest: GroupedRequest;
  onApprove: () => void;
  onReject: () => void;
}

function GroupedRequestCard({ groupedRequest, onApprove, onReject }: GroupedRequestCardProps) {
  const statusInfo = getRequestStatusInfo(groupedRequest.status);
  const primarySubject = groupedRequest.subjects[0];
  const subjectColor = getSubjectColor(primarySubject);
  // Parse date as local time to avoid timezone issues
  const preferredDate = parseLocalDate(groupedRequest.preferred_date);
  const createdAt = new Date(groupedRequest.created_at);

  // Display info for combined sessions
  const studentNamesDisplay = groupedRequest.student_names.join(' & ');
  const subjectsDisplay = groupedRequest.subjects.map(s => SUBJECT_NAMES[s]).join(', ');
  const subjectEmojis = groupedRequest.subjects.map(s => SUBJECT_EMOJI[s]).join(' ');

  return (
    <View style={styles.requestCard}>
      {/* Header */}
      <View style={[styles.requestHeader, { backgroundColor: subjectColor.subtle }]}>
        <Text style={styles.requestSubjectIcon}>{subjectEmojis}</Text>
        <View style={styles.requestHeaderInfo}>
          <Text style={styles.requestStudentName}>{studentNamesDisplay}</Text>
          <Text style={styles.requestSubject}>{subjectsDisplay}</Text>
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

      {/* Combined Session Badge */}
      {groupedRequest.isCombinedSession && (
        <View style={styles.combinedSessionBadge}>
          <Ionicons name="people" size={14} color={colors.primary.main} />
          <Text style={styles.combinedSessionBadgeText}>Combined Session</Text>
        </View>
      )}

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

        {groupedRequest.preferred_time && (
          <View style={styles.requestDetail}>
            <Ionicons name="time-outline" size={18} color={colors.neutral.textSecondary} />
            <Text style={styles.requestDetailText}>
              {formatTimeDisplay(groupedRequest.preferred_time)}
            </Text>
          </View>
        )}

        <View style={styles.requestDetail}>
          <Ionicons name="hourglass-outline" size={18} color={colors.neutral.textSecondary} />
          <Text style={styles.requestDetailText}>
            {groupedRequest.preferred_duration} minutes
          </Text>
        </View>

        {groupedRequest.notes && (
          <View style={styles.requestNotes}>
            <Text style={styles.requestNotesLabel}>Parent's note:</Text>
            <Text style={styles.requestNotesText}>{groupedRequest.notes}</Text>
          </View>
        )}

        {groupedRequest.tutor_response && (
          <View style={styles.responseBox}>
            <Text style={styles.responseLabel}>Your response:</Text>
            <Text style={styles.responseText}>{groupedRequest.tutor_response}</Text>
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
      {groupedRequest.status === 'pending' && (
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

// Approve Grouped Modal Component
interface ApproveGroupedModalProps {
  visible: boolean;
  groupedRequest: GroupedRequest | null;
  onClose: () => void;
  onApprove: (response: string, createLesson: boolean) => Promise<void>;
  loading: boolean;
}

function ApproveGroupedModal({ visible, groupedRequest, onClose, onApprove, loading }: ApproveGroupedModalProps) {
  const [response, setResponse] = useState('');
  const [createLesson, setCreateLesson] = useState(true);

  React.useEffect(() => {
    if (visible) {
      setResponse('');
      setCreateLesson(true);
    }
  }, [visible]);

  if (!groupedRequest) return null;

  const studentNamesDisplay = groupedRequest.student_names.join(' & ');

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.dialog}>
          <Ionicons name="checkmark-circle" size={48} color={colors.status.success} />
          <Text style={modalStyles.title}>Approve Request</Text>
          <Text style={modalStyles.subtitle}>
            Approve {studentNamesDisplay}'s reschedule request for{' '}
            {parseLocalDate(groupedRequest.preferred_date).toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
            {groupedRequest.preferred_time && ` at ${formatTimeDisplay(groupedRequest.preferred_time)}`}
          </Text>

          {groupedRequest.isCombinedSession && (
            <View style={modalStyles.combinedBadge}>
              <Ionicons name="people" size={16} color={colors.primary.main} />
              <Text style={modalStyles.combinedBadgeText}>Combined Session</Text>
            </View>
          )}

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
              Create scheduled lesson{groupedRequest.isCombinedSession ? 's' : ''} automatically
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

// Reject Grouped Modal Component
interface RejectGroupedModalProps {
  visible: boolean;
  groupedRequest: GroupedRequest | null;
  onClose: () => void;
  onReject: (reason: string) => Promise<void>;
  loading: boolean;
}

function RejectGroupedModal({ visible, groupedRequest, onClose, onReject, loading }: RejectGroupedModalProps) {
  const [reason, setReason] = useState('');

  React.useEffect(() => {
    if (visible) {
      setReason('');
    }
  }, [visible]);

  if (!groupedRequest) return null;

  const studentNamesDisplay = groupedRequest.student_names.join(' & ');

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={modalStyles.overlay}>
        <View style={modalStyles.dialog}>
          <Ionicons name="close-circle" size={48} color={colors.status.error} />
          <Text style={modalStyles.title}>Decline Request</Text>
          <Text style={modalStyles.subtitle}>
            Let {studentNamesDisplay}'s parent know why this time doesn't work.
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
  combinedSessionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary.subtle,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  combinedSessionBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
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
  combinedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary.subtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    marginBottom: spacing.md,
  },
  combinedBadgeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
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
