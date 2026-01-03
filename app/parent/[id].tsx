/**
 * Parent Detail Screen
 * Displays detailed information about a specific parent and their children
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useParent, useUpdateParent, useDeleteParent } from '../../src/hooks/useParents';
import { ParentFormModal } from '../../src/components/ParentFormModal';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { Student, UpdateParentInput } from '../../src/types/database';

// Subject display configuration
const SUBJECT_CONFIG: Record<string, { color: string; bgColor: string; label: string }> = {
  piano: { color: colors.piano.primary, bgColor: colors.piano.subtle, label: 'Piano' },
  math: { color: colors.math.primary, bgColor: colors.math.subtle, label: 'Math' },
  reading: { color: '#9C27B0', bgColor: '#F3E5F5', label: 'Reading' },
  speech: { color: '#FF9800', bgColor: '#FFF3E0', label: 'Speech' },
  english: { color: '#2196F3', bgColor: '#E3F2FD', label: 'English' },
};

export default function ParentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: parent, loading, error, refetch } = useParent(id || null);
  const { mutate: updateParent, loading: updating } = useUpdateParent();
  const { mutate: deleteParent, loading: deleting } = useDeleteParent();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleEditParent = () => {
    setEditModalVisible(true);
  };

  const handleSaveParent = async (data: UpdateParentInput): Promise<boolean> => {
    if (!id) return false;
    const result = await updateParent(id, data);
    if (result) {
      await refetch();
      return true;
    }
    return false;
  };

  const handleViewStudent = (studentId: string) => {
    router.push(`/student/${studentId}`);
  };

  const handleCall = () => {
    if (parent?.phone) {
      const phoneUrl = Platform.OS === 'ios'
        ? `telprompt:${parent.phone}`
        : `tel:${parent.phone}`;
      Linking.openURL(phoneUrl).catch(() => {
        Alert.alert('Error', 'Unable to make phone call');
      });
    } else {
      Alert.alert('No Phone', 'No phone number available for this parent');
    }
  };

  const handleEmail = () => {
    if (parent?.email) {
      Linking.openURL(`mailto:${parent.email}`).catch(() => {
        Alert.alert('Error', 'Unable to open email app');
      });
    }
  };

  const handleMessage = () => {
    if (parent?.phone) {
      const smsUrl = `sms:${parent.phone}`;
      Linking.openURL(smsUrl).catch(() => {
        Alert.alert('Error', 'Unable to open messaging app');
      });
    } else {
      Alert.alert('No Phone', 'No phone number available for this parent');
    }
  };

  const handleDeleteParent = () => {
    const studentCount = parent?.students?.length || 0;
    const warningMessage = studentCount > 0
      ? `Are you sure you want to delete ${parent?.name}? This will also delete ${studentCount} student${studentCount !== 1 ? 's' : ''} associated with this parent. This action cannot be undone.`
      : `Are you sure you want to delete ${parent?.name}? This action cannot be undone.`;

    if (Platform.OS === 'web') {
      setShowDeleteConfirm(true);
    } else {
      Alert.alert('Delete Parent', warningMessage, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: confirmDelete,
        },
      ]);
    }
  };

  const confirmDelete = async () => {
    if (!id) return;
    setShowDeleteConfirm(false);
    const success = await deleteParent(id);
    if (success) {
      router.back();
    } else {
      if (Platform.OS === 'web') {
        alert('Failed to delete parent. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to delete parent. Please try again.');
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.piano.primary} />
          <Text style={styles.loadingText}>Loading parent...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !parent) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.status.error} />
          <Text style={styles.errorText}>Failed to load parent</Text>
          <Text style={styles.errorSubtext}>{error?.message || 'Parent not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Get initials for avatar
  const initials = parent.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Get students
  const students = parent.students || [];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.neutral.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Parent Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.parentName}>{parent.name}</Text>
          <Text style={styles.studentCount}>
            {students.length} student{students.length !== 1 ? 's' : ''}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleCall}>
            <View style={[styles.actionIcon, { backgroundColor: colors.status.success }]}>
              <Ionicons name="call" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Call</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleEmail}>
            <View style={[styles.actionIcon, { backgroundColor: '#2196F3' }]}>
              <Ionicons name="mail" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Email</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton} onPress={handleMessage}>
            <View style={[styles.actionIcon, { backgroundColor: colors.piano.primary }]}>
              <Ionicons name="chatbubble" size={20} color="#FFFFFF" />
            </View>
            <Text style={styles.actionText}>Message</Text>
          </TouchableOpacity>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Ionicons name="mail-outline" size={20} color={colors.neutral.textMuted} />
              <Text style={styles.infoText}>{parent.email}</Text>
            </View>
            {parent.phone && (
              <View style={styles.infoRow}>
                <Ionicons name="call-outline" size={20} color={colors.neutral.textMuted} />
                <Text style={styles.infoText}>{parent.phone}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Children/Students Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Children/Students</Text>
          {students.length > 0 ? (
            <View style={styles.studentsList}>
              {students.map((student: Student) => {
                const studentSubjects = student.subjects || [];
                return (
                  <TouchableOpacity
                    key={student.id}
                    style={styles.studentCard}
                    onPress={() => handleViewStudent(student.id)}
                  >
                    <View style={styles.studentInfo}>
                      <View style={styles.studentAvatar}>
                        <Text style={styles.studentAvatarText}>
                          {student.name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .substring(0, 2)
                            .toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.studentDetails}>
                        <Text style={styles.studentName}>{student.name}</Text>
                        <Text style={styles.studentMeta}>
                          Grade {student.grade_level} • Age {student.age}
                        </Text>
                        <View style={styles.studentTags}>
                          {studentSubjects.map((subject) => {
                            const config = SUBJECT_CONFIG[subject] || {
                              color: colors.neutral.textSecondary,
                              bgColor: colors.neutral.background,
                              label: subject.charAt(0).toUpperCase() + subject.slice(1),
                            };
                            return (
                              <View
                                key={subject}
                                style={[styles.miniTag, { backgroundColor: config.bgColor }]}
                              >
                                <Text style={[styles.miniTagText, { color: config.color }]}>
                                  {config.label}
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={32} color="#CCC" />
              <Text style={styles.emptyText}>No students linked</Text>
              <Text style={styles.emptySubtext}>Add students for this parent</Text>
            </View>
          )}
        </View>

        {/* Payment Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Summary</Text>
          <View style={styles.paymentSummary}>
            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Total Paid</Text>
              <Text style={[styles.paymentAmount, { color: colors.status.success }]}>
                $0.00
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.paymentItem}>
              <Text style={styles.paymentLabel}>Outstanding</Text>
              <Text style={[styles.paymentAmount, { color: colors.piano.primary }]}>
                $0.00
              </Text>
            </View>
          </View>
        </View>

        {/* Recent Payments */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Payments</Text>
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No payment history</Text>
            <Text style={styles.emptySubtext}>Payment records will appear here</Text>
          </View>
        </View>

        {/* Notes */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes</Text>
          <View style={styles.notesCard}>
            <Text style={styles.notesPlaceholder}>
              Add notes about this parent...
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.editButton} onPress={handleEditParent}>
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Edit Parent</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteParent}
            disabled={deleting}
          >
            <Ionicons name="trash-outline" size={20} color={colors.status.error} />
            <Text style={styles.deleteButtonText}>
              {deleting ? 'Deleting...' : 'Delete'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete Confirmation Dialog for Web */}
      {showDeleteConfirm && (
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmDialog}>
            <Ionicons name="warning" size={48} color={colors.status.error} style={styles.confirmIcon} />
            <Text style={styles.confirmTitle}>Delete Parent?</Text>
            <Text style={styles.confirmMessage}>
              {students.length > 0
                ? `Are you sure you want to delete ${parent.name}? This will also delete ${students.length} student${students.length !== 1 ? 's' : ''} associated with this parent. This action cannot be undone.`
                : `Are you sure you want to delete ${parent.name}? This action cannot be undone.`}
            </Text>
            <View style={styles.confirmButtons}>
              <TouchableOpacity
                style={styles.confirmButtonCancel}
                onPress={() => setShowDeleteConfirm(false)}
              >
                <Text style={styles.confirmButtonCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmButtonDelete}
                onPress={confirmDelete}
              >
                <Text style={styles.confirmButtonDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Edit Parent Modal */}
      <ParentFormModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveParent}
        parent={parent}
        loading={updating}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  backButton: {
    padding: spacing.sm,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    padding: spacing.base,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.neutral.textMuted,
    fontSize: typography.sizes.sm,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
  },
  errorText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
  },
  errorSubtext: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  retryButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  retryText: {
    color: colors.piano.primary,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  profileSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.math.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  parentName: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  studentCount: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing['2xl'],
    marginBottom: spacing.xl,
  },
  actionButton: {
    alignItems: 'center',
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  actionText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  infoCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  infoText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    flex: 1,
  },
  studentsList: {
    gap: spacing.md,
  },
  studentCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  studentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.piano.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentAvatarText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.piano.primary,
  },
  studentDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  studentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  studentMeta: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  studentTags: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  miniTag: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  miniTagText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  emptyState: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: spacing.sm,
  },
  emptySubtext: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.border,
    marginTop: spacing.xs,
  },
  paymentSummary: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  paymentItem: {
    flex: 1,
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  paymentAmount: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
  },
  divider: {
    width: 1,
    backgroundColor: colors.neutral.border,
    marginHorizontal: spacing.md,
  },
  notesCard: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    minHeight: 100,
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  notesPlaceholder: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  editButton: {
    flex: 1,
    backgroundColor: colors.piano.primary,
    borderRadius: borderRadius.lg,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    shadowColor: colors.piano.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  editButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: '#FFFFFF',
  },
  deleteButton: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.status.error,
  },
  deleteButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.status.error,
  },

  // Confirmation Dialog Styles
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmDialog: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '85%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  confirmIcon: {
    marginBottom: spacing.md,
  },
  confirmTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    width: '100%',
  },
  confirmButtonCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: 'center',
  },
  confirmButtonCancelText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  confirmButtonDelete: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.error,
    alignItems: 'center',
  },
  confirmButtonDeleteText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: '#FFFFFF',
  },
});
