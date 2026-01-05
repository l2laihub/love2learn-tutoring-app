/**
 * UploadWorksheetModal
 * Modal for uploading PDF worksheets to assign to students
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { StudentWithParent, CreateSharedResourceInput } from '../types/database';
import { FileUploader, SelectedFile } from './FileUploader';
import { useFileUpload, STORAGE_BUCKETS } from '../hooks/useFileUpload';

export interface UploadWorksheetModalProps {
  visible: boolean;
  onClose: () => void;
  onUploadComplete: (input: CreateSharedResourceInput) => Promise<void>;
  students: StudentWithParent[];
  studentsLoading?: boolean;
  tutorId: string;
}

type Step = 'file' | 'student' | 'details';

export function UploadWorksheetModal({
  visible,
  onClose,
  onUploadComplete,
  students,
  studentsLoading = false,
  tutorId,
}: UploadWorksheetModalProps) {
  const [step, setStep] = useState<Step>('file');
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { uploadFile } = useFileUpload();

  const handleClose = () => {
    setStep('file');
    setSelectedFile(null);
    setSelectedStudentId('');
    setTitle('');
    setDescription('');
    setDueDate('');
    setError(null);
    onClose();
  };

  const handleBack = () => {
    if (step === 'details') setStep('student');
    else if (step === 'student') setStep('file');
  };

  const handleFileSelected = (file: SelectedFile) => {
    setSelectedFile(file);
    // Auto-populate title from filename
    const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
    setTitle(nameWithoutExt);
    setStep('student');
  };

  const handleFileError = (errorMsg: string) => {
    setError(errorMsg);
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setStep('details');
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
        STORAGE_BUCKETS.WORKSHEETS,
        selectedStudentId,
        selectedFile.uri,
        selectedFile.name,
        selectedFile.mimeType
      );

      if (!uploadResult) {
        throw new Error('Failed to upload file');
      }

      // Get student's parent ID
      const student = students.find((s) => s.id === selectedStudentId);
      if (!student) {
        throw new Error('Student not found');
      }

      console.log('[UploadWorksheetModal] Creating shared resource:', {
        studentName: student.name,
        studentId: selectedStudentId,
        parentId: student.parent_id,
        tutorId,
      });

      // Create shared resource
      const input: CreateSharedResourceInput = {
        student_id: selectedStudentId,
        parent_id: student.parent_id,
        tutor_id: tutorId,
        resource_type: 'pdf',
        title: title.trim(),
        description: description.trim() || null,
        storage_path: uploadResult.path,
        file_size: uploadResult.size,
        mime_type: uploadResult.mimeType,
      };

      await onUploadComplete(input);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload worksheet');
    } finally {
      setUploading(false);
    }
  };

  const renderFileSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Upload PDF Worksheet</Text>
      <Text style={styles.stepSubtitle}>
        Select a PDF file to upload and assign to a student
      </Text>

      <FileUploader
        type="pdf"
        onFileSelected={handleFileSelected}
        onError={handleFileError}
        selectedFile={selectedFile}
        onClear={() => setSelectedFile(null)}
      />
    </View>
  );

  const renderStudentSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Student</Text>
      <Text style={styles.stepSubtitle}>
        Choose the student to assign this worksheet to
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

  const renderDetails = () => {
    const selectedStudent = students.find((s) => s.id === selectedStudentId);

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Worksheet Details</Text>
        <Text style={styles.stepSubtitle}>
          Add details for {selectedStudent?.name}'s worksheet
        </Text>

        {/* File Preview */}
        {selectedFile && (
          <View style={styles.filePreview}>
            <View style={styles.fileIcon}>
              <Ionicons name="document" size={24} color={colors.math.primary} />
            </View>
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {selectedFile.name}
              </Text>
              <Text style={styles.fileSize}>
                {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
              </Text>
            </View>
          </View>
        )}

        {/* Title Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Title *</Text>
          <TextInput
            style={styles.textInput}
            value={title}
            onChangeText={setTitle}
            placeholder="Enter worksheet title"
            placeholderTextColor={colors.neutral.textMuted}
          />
        </View>

        {/* Description Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Instructions (optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add instructions or notes for the parent..."
            placeholderTextColor={colors.neutral.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>
    );
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
          {step !== 'file' ? (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.neutral.text} />
            </Pressable>
          ) : (
            <Pressable onPress={handleClose} style={styles.backButton}>
              <Ionicons name="close" size={24} color={colors.neutral.text} />
            </Pressable>
          )}
          <Text style={styles.headerTitle}>Upload Worksheet</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress */}
        <View style={styles.progressBar}>
          <View style={[styles.progressDot, step === 'file' && styles.progressDotActive]} />
          <View style={[styles.progressLine, step !== 'file' && styles.progressLineActive]} />
          <View style={[styles.progressDot, step === 'student' && styles.progressDotActive]} />
          <View style={[styles.progressLine, step === 'details' && styles.progressLineActive]} />
          <View style={[styles.progressDot, step === 'details' && styles.progressDotActive]} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content}>
          {step === 'file' && renderFileSelection()}
          {step === 'student' && renderStudentSelection()}
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
                  <Ionicons name="cloud-upload" size={20} color={colors.neutral.white} />
                  <Text style={styles.uploadButtonText}>Upload & Share</Text>
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
    backgroundColor: colors.math.primary,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.neutral.border,
    marginHorizontal: spacing.xs,
  },
  progressLineActive: {
    backgroundColor: colors.math.primary,
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
    backgroundColor: colors.math.primary,
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
  filePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.math.subtle,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  fileIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  fileSize: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
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
    backgroundColor: colors.math.primary,
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

export default UploadWorksheetModal;
