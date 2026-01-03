/**
 * Student Detail Screen
 * Displays detailed information about a specific student
 */

import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Linking, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStudent, useUpdateStudent, useDeleteStudent } from '../../src/hooks/useStudents';
import { useParents } from '../../src/hooks/useParents';
import { StudentFormModal } from '../../src/components/StudentFormModal';
import { colors, spacing, typography, borderRadius } from '../../src/theme';
import { UpdateStudentInput } from '../../src/types/database';

export default function StudentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: student, loading, error, refetch } = useStudent(id || null);
  const { data: parents } = useParents();
  const { mutate: updateStudent, loading: updating } = useUpdateStudent();
  const { mutate: deleteStudent, loading: deleting } = useDeleteStudent();
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleEditStudent = () => {
    setEditModalVisible(true);
  };

  const handleSaveStudent = async (data: UpdateStudentInput): Promise<boolean> => {
    if (!id) return false;
    const result = await updateStudent(id, data);
    if (result) {
      await refetch();
      return true;
    }
    return false;
  };

  const handleViewParent = () => {
    if (student?.parent?.id) {
      router.push(`/parent/${student.parent.id}`);
    }
  };

  const handleCallParent = () => {
    if (student?.parent?.phone) {
      const phoneUrl = Platform.OS === 'ios'
        ? `telprompt:${student.parent.phone}`
        : `tel:${student.parent.phone}`;
      Linking.openURL(phoneUrl).catch(() => {
        Alert.alert('Error', 'Unable to make phone call');
      });
    }
  };

  const handleEmailParent = () => {
    if (student?.parent?.email) {
      Linking.openURL(`mailto:${student.parent.email}`).catch(() => {
        Alert.alert('Error', 'Unable to open email app');
      });
    }
  };

  const handleDeleteStudent = () => {
    if (Platform.OS === 'web') {
      setShowDeleteConfirm(true);
    } else {
      Alert.alert(
        'Delete Student',
        `Are you sure you want to delete ${student?.name}? This action cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: confirmDelete,
          },
        ]
      );
    }
  };

  const confirmDelete = async () => {
    if (!id) return;
    setShowDeleteConfirm(false);
    const success = await deleteStudent(id);
    if (success) {
      router.back();
    } else {
      if (Platform.OS === 'web') {
        alert('Failed to delete student. Please try again.');
      } else {
        Alert.alert('Error', 'Failed to delete student. Please try again.');
      }
    }
  };

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.piano.primary} />
          <Text style={styles.loadingText}>Loading student...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Error state
  if (error || !student) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.status.error} />
          <Text style={styles.errorText}>Failed to load student</Text>
          <Text style={styles.errorSubtext}>{error?.message || 'Student not found'}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Get initials for avatar
  const initials = student.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase();

  // Get subjects with their display info
  const subjectsList = student.subjects || [];
  const SUBJECT_CONFIG: Record<string, { icon: string; color: string; label: string }> = {
    piano: { icon: 'musical-notes', color: colors.piano.primary, label: 'Piano' },
    math: { icon: 'calculator', color: colors.math.primary, label: 'Math' },
    reading: { icon: 'book', color: '#9C27B0', label: 'Reading' },
    speech: { icon: 'mic', color: '#FF9800', label: 'Speech' },
    english: { icon: 'language', color: '#2196F3', label: 'English' },
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Header with Back Button */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.neutral.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Student Details</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Section */}
        <View style={styles.profileSection}>
          <View style={styles.avatarContainer}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.studentName}>{student.name}</Text>
          <Text style={styles.gradeText}>Grade {student.grade_level} • Age {student.age}</Text>

          <View style={styles.tagContainer}>
            {subjectsList.map((subject) => {
              const config = SUBJECT_CONFIG[subject] || {
                icon: 'school',
                color: colors.neutral.textSecondary,
                label: subject.charAt(0).toUpperCase() + subject.slice(1),
              };
              return (
                <View
                  key={subject}
                  style={[styles.tag, { backgroundColor: config.color }]}
                >
                  <Ionicons name={config.icon as any} size={14} color="#FFFFFF" />
                  <Text style={styles.tagText}>{config.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Parent/Guardian Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parent/Guardian</Text>
          {student.parent ? (
            <TouchableOpacity style={styles.parentCard} onPress={handleViewParent}>
              <View style={styles.parentInfo}>
                <View style={styles.parentAvatar}>
                  <Text style={styles.parentAvatarText}>
                    {student.parent.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .substring(0, 2)
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={styles.parentDetails}>
                  <Text style={styles.parentName}>{student.parent.name}</Text>
                  <Text style={styles.parentEmail}>{student.parent.email}</Text>
                  {student.parent.phone && (
                    <Text style={styles.parentPhone}>{student.parent.phone}</Text>
                  )}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
            </TouchableOpacity>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="person-outline" size={32} color="#CCC" />
              <Text style={styles.emptyText}>No parent linked</Text>
            </View>
          )}

          {/* Quick Contact Actions */}
          {student.parent && (
            <View style={styles.contactActions}>
              {student.parent.phone && (
                <TouchableOpacity style={styles.contactButton} onPress={handleCallParent}>
                  <View style={[styles.contactIcon, { backgroundColor: colors.status.success }]}>
                    <Ionicons name="call" size={18} color="#FFFFFF" />
                  </View>
                  <Text style={styles.contactText}>Call</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.contactButton} onPress={handleEmailParent}>
                <View style={[styles.contactIcon, { backgroundColor: '#2196F3' }]}>
                  <Ionicons name="mail" size={18} color="#FFFFFF" />
                </View>
                <Text style={styles.contactText}>Email</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Lesson Schedule Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Lesson Schedule</Text>
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No lessons scheduled</Text>
            <Text style={styles.emptySubtext}>Lessons will appear here once scheduled</Text>
          </View>
        </View>

        {/* Recent Progress Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Progress</Text>
          <View style={styles.emptyState}>
            <Ionicons name="trending-up-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No progress data yet</Text>
            <Text style={styles.emptySubtext}>Progress tracking coming soon</Text>
          </View>
        </View>

        {/* Worksheets Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Worksheets</Text>
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={32} color="#CCC" />
            <Text style={styles.emptyText}>No worksheets assigned</Text>
            <Text style={styles.emptySubtext}>Assigned worksheets will appear here</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.editButton} onPress={handleEditStudent}>
            <Ionicons name="create-outline" size={20} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Edit Student</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={handleDeleteStudent}
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
            <Text style={styles.confirmTitle}>Delete Student?</Text>
            <Text style={styles.confirmMessage}>
              Are you sure you want to delete {student.name}? This action cannot be undone.
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

      {/* Edit Student Modal */}
      <StudentFormModal
        visible={editModalVisible}
        onClose={() => setEditModalVisible(false)}
        onSave={handleSaveStudent}
        student={student}
        parents={parents}
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
    marginBottom: spacing.xl,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.piano.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: typography.weights.bold,
    color: '#FFFFFF',
  },
  studentName: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  gradeText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  tagContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  tagText: {
    color: '#FFFFFF',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
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
  parentCard: {
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
  parentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  parentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.math.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  parentAvatarText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.math.primary,
  },
  parentDetails: {
    marginLeft: spacing.md,
    flex: 1,
  },
  parentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  parentEmail: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  parentPhone: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  contactActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.md,
  },
  contactButton: {
    alignItems: 'center',
  },
  contactIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  contactText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
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
    maxWidth: 320,
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
