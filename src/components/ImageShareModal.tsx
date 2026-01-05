/**
 * ImageShareModal
 * Modal for sharing session images with parents
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { StudentWithParent, CreateSharedResourceInput, ScheduledLessonWithStudent } from '../types/database';
import { FileUploader, SelectedFile } from './FileUploader';
import { useFileUpload, STORAGE_BUCKETS } from '../hooks/useFileUpload';

export interface ImageShareModalProps {
  visible: boolean;
  onClose: () => void;
  onUploadComplete: (input: CreateSharedResourceInput) => Promise<void>;
  students: StudentWithParent[];
  studentsLoading?: boolean;
  tutorId: string;
  preSelectedStudentId?: string;
  lesson?: ScheduledLessonWithStudent | null;
}

type Step = 'image' | 'student' | 'details';

export function ImageShareModal({
  visible,
  onClose,
  onUploadComplete,
  students,
  studentsLoading = false,
  tutorId,
  preSelectedStudentId,
  lesson,
}: ImageShareModalProps) {
  const [step, setStep] = useState<Step>(preSelectedStudentId ? 'image' : 'student');
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(preSelectedStudentId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { uploadFile } = useFileUpload();

  const handleClose = () => {
    setStep(preSelectedStudentId ? 'image' : 'student');
    setSelectedFile(null);
    setSelectedStudentId(preSelectedStudentId || '');
    setTitle('');
    setDescription('');
    setError(null);
    onClose();
  };

  const handleBack = () => {
    if (step === 'details') setStep('image');
    else if (step === 'image' && !preSelectedStudentId) setStep('student');
  };

  const handleFileSelected = (file: SelectedFile) => {
    setSelectedFile(file);
    // Generate default title
    const date = new Date().toLocaleDateString();
    const student = students.find((s) => s.id === selectedStudentId);
    setTitle(`Session Photo - ${student?.name || 'Student'} - ${date}`);
    setStep('details');
  };

  const handleFileError = (errorMsg: string) => {
    setError(errorMsg);
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setStep('image');
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedStudentId || !title.trim()) {
      setError('Please complete all required fields');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      // Upload file to storage
      const uploadResult = await uploadFile(
        STORAGE_BUCKETS.SESSION_MEDIA,
        selectedStudentId,
        selectedFile.uri,
        selectedFile.name,
        selectedFile.mimeType
      );

      if (!uploadResult) {
        throw new Error('Failed to upload image');
      }

      // Get student's parent ID
      const student = students.find((s) => s.id === selectedStudentId);
      if (!student) {
        throw new Error('Student not found');
      }

      // Create shared resource
      const input: CreateSharedResourceInput = {
        student_id: selectedStudentId,
        parent_id: student.parent_id,
        tutor_id: tutorId,
        resource_type: 'image',
        title: title.trim(),
        description: description.trim() || null,
        storage_path: uploadResult.path,
        thumbnail_url: uploadResult.publicUrl, // Use same URL for thumbnail
        file_size: uploadResult.size,
        mime_type: uploadResult.mimeType,
        lesson_id: lesson?.id || null,
      };

      await onUploadComplete(input);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const renderStudentSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Student</Text>
      <Text style={styles.stepSubtitle}>
        Choose which student this image is for
      </Text>

      {studentsLoading ? (
        <ActivityIndicator size="large" color={colors.piano.primary} />
      ) : students.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="person-outline" size={48} color={colors.neutral.textMuted} />
          <Text style={styles.emptyText}>No students found</Text>
        </View>
      ) : (
        <View style={styles.studentList}>
          {students.map((student) => (
            <Pressable
              key={student.id}
              style={styles.studentCard}
              onPress={() => handleSelectStudent(student.id)}
            >
              <View style={styles.studentAvatar}>
                <Text style={styles.studentInitial}>
                  {student.name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.studentInfo}>
                <Text style={styles.studentName}>{student.name}</Text>
                <Text style={styles.studentGrade}>
                  Grade {student.grade_level} • Age {student.age}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );

  const renderImageSelection = () => {
    const selectedStudent = students.find((s) => s.id === selectedStudentId);

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Select Image</Text>
        <Text style={styles.stepSubtitle}>
          Take a photo or choose from your gallery{' '}
          {selectedStudent ? `for ${selectedStudent.name}` : ''}
        </Text>

        <FileUploader
          type="image"
          onFileSelected={handleFileSelected}
          onError={handleFileError}
          selectedFile={selectedFile}
          onClear={() => setSelectedFile(null)}
        />
      </View>
    );
  };

  const renderDetails = () => {
    const selectedStudent = students.find((s) => s.id === selectedStudentId);

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Image Details</Text>
        <Text style={styles.stepSubtitle}>
          Add a title and note for {selectedStudent?.name}'s parent
        </Text>

        {/* Image Preview */}
        {selectedFile && (
          <View style={styles.imagePreviewContainer}>
            <Image source={{ uri: selectedFile.uri }} style={styles.imagePreview} resizeMode="cover" />
            <Pressable
              style={styles.changeImageButton}
              onPress={() => {
                setSelectedFile(null);
                setStep('image');
              }}
            >
              <Ionicons name="camera" size={16} color={colors.neutral.white} />
              <Text style={styles.changeImageText}>Change</Text>
            </Pressable>
          </View>
        )}

        {/* Lesson Info */}
        {lesson && (
          <View style={styles.lessonInfo}>
            <Ionicons name="calendar" size={16} color={colors.status.info} />
            <Text style={styles.lessonInfoText}>
              Linked to {lesson.subject} lesson on{' '}
              {new Date(lesson.scheduled_at).toLocaleDateString()}
            </Text>
          </View>
        )}

        {/* Title Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Title *</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter a title for this image"
            placeholderTextColor={colors.neutral.textMuted}
          />
        </View>

        {/* Description Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Note for Parent (optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add a note about what's in this image..."
            placeholderTextColor={colors.neutral.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>
    );
  };

  const canGoBack = step === 'details' || (step === 'image' && !preSelectedStudentId);

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
          {canGoBack ? (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.neutral.text} />
            </Pressable>
          ) : (
            <Pressable onPress={handleClose} style={styles.backButton}>
              <Ionicons name="close" size={24} color={colors.neutral.text} />
            </Pressable>
          )}
          <Text style={styles.headerTitle}>Share Session Image</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress */}
        {!preSelectedStudentId && (
          <View style={styles.progressBar}>
            <View style={[styles.progressDot, step === 'student' && styles.progressDotActive]} />
            <View style={[styles.progressLine, step !== 'student' && styles.progressLineActive]} />
            <View style={[styles.progressDot, step === 'image' && styles.progressDotActive]} />
            <View style={[styles.progressLine, step === 'details' && styles.progressLineActive]} />
            <View style={[styles.progressDot, step === 'details' && styles.progressDotActive]} />
          </View>
        )}

        {/* Content */}
        <ScrollView style={styles.content}>
          {step === 'student' && renderStudentSelection()}
          {step === 'image' && renderImageSelection()}
          {step === 'details' && renderDetails()}

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Upload Button */}
        {step === 'details' && (
          <View style={styles.footer}>
            <Pressable
              style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
              onPress={handleUpload}
              disabled={uploading}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={20} color={colors.neutral.white} />
                  <Text style={styles.uploadButtonText}>Share with Parent</Text>
                </>
              )}
            </Pressable>
          </View>
        )}
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
  backButton: {
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
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.neutral.border,
  },
  progressDotActive: {
    backgroundColor: colors.status.info,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.neutral.border,
    marginHorizontal: spacing.xs,
  },
  progressLineActive: {
    backgroundColor: colors.status.info,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: spacing.base,
  },
  stepTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.lg,
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
    ...shadows.sm,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.status.info,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  studentInitial: {
    fontSize: typography.sizes.lg,
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
  studentGrade: {
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
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: spacing.lg,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: borderRadius.lg,
  },
  changeImageButton: {
    position: 'absolute',
    bottom: spacing.sm,
    right: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  changeImageText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.white,
  },
  lessonInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.infoBg,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  lessonInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.status.info,
    flex: 1,
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.status.errorBg,
    borderRadius: borderRadius.md,
    margin: spacing.base,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.status.error,
  },
  footer: {
    padding: spacing.base,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.info,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  uploadButtonDisabled: {
    opacity: 0.6,
  },
  uploadButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

export default ImageShareModal;
