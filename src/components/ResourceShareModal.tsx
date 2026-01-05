/**
 * ResourceShareModal
 * Modal for sharing resources (worksheets, PDFs, images, videos) with parents
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import {
  StudentWithParent,
  ResourceType,
  CreateSharedResourceInput,
} from '../types/database';

export interface ResourceShareModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: (input: CreateSharedResourceInput) => Promise<void>;
  students: StudentWithParent[];
  studentsLoading?: boolean;
  resourceType: ResourceType;
  resourceTitle?: string;
  resourceDescription?: string;
  storagePath?: string;
  externalUrl?: string;
  thumbnailUrl?: string;
  fileSize?: number;
  mimeType?: string;
  assignmentId?: string;
  lessonId?: string;
  tutorId: string;
  preSelectedStudentId?: string;
}

export function ResourceShareModal({
  visible,
  onClose,
  onShare,
  students,
  studentsLoading = false,
  resourceType,
  resourceTitle = '',
  resourceDescription = '',
  storagePath,
  externalUrl,
  thumbnailUrl,
  fileSize,
  mimeType,
  assignmentId,
  lessonId,
  tutorId,
  preSelectedStudentId,
}: ResourceShareModalProps) {
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    preSelectedStudentId ? [preSelectedStudentId] : []
  );
  const [title, setTitle] = useState(resourceTitle);
  const [description, setDescription] = useState(resourceDescription);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update title and description when props change
  useEffect(() => {
    setTitle(resourceTitle);
    setDescription(resourceDescription);
    if (preSelectedStudentId) {
      setSelectedStudentIds([preSelectedStudentId]);
    }
  }, [resourceTitle, resourceDescription, preSelectedStudentId]);

  const handleClose = () => {
    setSelectedStudentIds([]);
    setTitle('');
    setDescription('');
    setError(null);
    onClose();
  };

  const toggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) =>
      prev.includes(studentId) ? prev.filter((id) => id !== studentId) : [...prev, studentId]
    );
  };

  const selectAllStudents = () => {
    setSelectedStudentIds(students.map((s) => s.id));
  };

  const clearAllStudents = () => {
    setSelectedStudentIds([]);
  };

  const handleShare = async () => {
    if (selectedStudentIds.length === 0) {
      setError('Please select at least one student');
      return;
    }

    if (!title.trim()) {
      setError('Please enter a title');
      return;
    }

    setSharing(true);
    setError(null);

    try {
      // Share with each selected student
      for (const studentId of selectedStudentIds) {
        const student = students.find((s) => s.id === studentId);
        if (!student) continue;

        const input: CreateSharedResourceInput = {
          student_id: studentId,
          parent_id: student.parent_id,
          tutor_id: tutorId,
          resource_type: resourceType,
          title: title.trim(),
          description: description.trim() || null,
          storage_path: storagePath || null,
          external_url: externalUrl || null,
          thumbnail_url: thumbnailUrl || null,
          file_size: fileSize || null,
          mime_type: mimeType || null,
          assignment_id: assignmentId || null,
          lesson_id: lessonId || null,
        };

        await onShare(input);
      }

      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share resource');
    } finally {
      setSharing(false);
    }
  };

  const getResourceTypeIcon = () => {
    switch (resourceType) {
      case 'worksheet':
        return 'document-text';
      case 'pdf':
        return 'document';
      case 'image':
        return 'image';
      case 'video':
        return 'videocam';
      default:
        return 'share';
    }
  };

  const getResourceTypeLabel = () => {
    switch (resourceType) {
      case 'worksheet':
        return 'Worksheet';
      case 'pdf':
        return 'PDF Document';
      case 'image':
        return 'Session Image';
      case 'video':
        return 'Video';
      default:
        return 'Resource';
    }
  };

  const getResourceTypeColor = () => {
    switch (resourceType) {
      case 'worksheet':
        return colors.piano.primary;
      case 'pdf':
        return colors.math.primary;
      case 'image':
        return colors.status.info;
      case 'video':
        return '#FF0000'; // YouTube red
      default:
        return colors.neutral.text;
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Share with Parents</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content}>
          {/* Resource Preview */}
          <View style={styles.resourcePreview}>
            <View style={[styles.resourceIcon, { backgroundColor: getResourceTypeColor() + '20' }]}>
              <Ionicons name={getResourceTypeIcon() as any} size={32} color={getResourceTypeColor()} />
            </View>
            <View style={styles.resourceInfo}>
              <Text style={styles.resourceTypeLabel}>{getResourceTypeLabel()}</Text>
              {fileSize && (
                <Text style={styles.resourceSize}>
                  {(fileSize / 1024 / 1024).toFixed(2)} MB
                </Text>
              )}
            </View>
          </View>

          {/* Title Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Title *</Text>
            <TextInput
              style={styles.textInput}
              value={title}
              onChangeText={setTitle}
              placeholder="Enter a title for this resource"
              placeholderTextColor={colors.neutral.textMuted}
            />
          </View>

          {/* Description Input */}
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>Description (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Add a note for parents..."
              placeholderTextColor={colors.neutral.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Student Selection */}
          <View style={styles.studentSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Select Students *</Text>
              <View style={styles.selectActions}>
                <Pressable onPress={selectAllStudents} style={styles.selectAction}>
                  <Text style={styles.selectActionText}>Select All</Text>
                </Pressable>
                <Text style={styles.selectDivider}>|</Text>
                <Pressable onPress={clearAllStudents} style={styles.selectAction}>
                  <Text style={styles.selectActionText}>Clear</Text>
                </Pressable>
              </View>
            </View>

            {studentsLoading ? (
              <ActivityIndicator size="large" color={colors.piano.primary} />
            ) : students.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="person-outline" size={48} color={colors.neutral.textMuted} />
                <Text style={styles.emptyText}>No students found</Text>
              </View>
            ) : (
              <View style={styles.studentList}>
                {students.map((student) => {
                  const isSelected = selectedStudentIds.includes(student.id);
                  return (
                    <Pressable
                      key={student.id}
                      style={[styles.studentCard, isSelected && styles.studentCardSelected]}
                      onPress={() => toggleStudent(student.id)}
                    >
                      <View
                        style={[styles.checkbox, isSelected && styles.checkboxChecked]}
                      >
                        {isSelected && (
                          <Ionicons name="checkmark" size={16} color={colors.neutral.white} />
                        )}
                      </View>
                      <View style={styles.studentAvatar}>
                        <Text style={styles.studentInitial}>
                          {student.name.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.studentInfo}>
                        <Text style={styles.studentName}>{student.name}</Text>
                        <Text style={styles.parentName}>
                          Parent: {student.parent?.name || 'Unknown'}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Pressable style={styles.cancelButton} onPress={handleClose}>
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
          <Pressable
            style={[
              styles.shareButton,
              (sharing || selectedStudentIds.length === 0) && styles.shareButtonDisabled,
            ]}
            onPress={handleShare}
            disabled={sharing || selectedStudentIds.length === 0}
          >
            {sharing ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <>
                <Ionicons name="share-outline" size={20} color={colors.neutral.white} />
                <Text style={styles.shareButtonText}>
                  Share with {selectedStudentIds.length || ''} {selectedStudentIds.length === 1 ? 'Parent' : 'Parents'}
                </Text>
              </>
            )}
          </Pressable>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  closeButton: {
    padding: spacing.xs,
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
    flex: 1,
    padding: spacing.base,
  },
  resourcePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  resourceIcon: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  resourceInfo: {
    flex: 1,
  },
  resourceTypeLabel: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  resourceSize: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  inputSection: {
    marginBottom: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  textArea: {
    minHeight: 80,
  },
  studentSection: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  selectActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  selectAction: {
    paddingHorizontal: spacing.xs,
  },
  selectActionText: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  selectDivider: {
    color: colors.neutral.border,
    marginHorizontal: spacing.xs,
  },
  studentList: {
    gap: spacing.sm,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  studentCardSelected: {
    borderColor: colors.piano.primary,
    backgroundColor: colors.piano.subtle,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.piano.primary,
    borderColor: colors.piano.primary,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.piano.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  studentInitial: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  parentName: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.status.errorBg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.status.error,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.base,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  cancelButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
  },
  shareButton: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.piano.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  shareButtonDisabled: {
    opacity: 0.6,
  },
  shareButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

export default ResourceShareModal;
