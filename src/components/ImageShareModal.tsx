/**
 * ImageShareModal
 * Modal for sharing session images with parents
 * Supports multi-student selection with filtering and multi-image uploads
 */

import React, { useState, useMemo } from 'react';
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
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { StudentWithParent, CreateSharedResourceInput, ScheduledLessonWithStudent } from '../types/database';
import { useFileUpload, STORAGE_BUCKETS, FILE_SIZE_LIMITS } from '../hooks/useFileUpload';

// Extended file type to support multiple images
export interface SelectedImageFile {
  uri: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface ImageShareModalProps {
  visible: boolean;
  onClose: () => void;
  /** Called for each resource created (should NOT show alerts - modal handles messaging) */
  onUploadComplete: (input: CreateSharedResourceInput) => Promise<void>;
  /** Called once after all uploads complete successfully (for showing success message) */
  onBatchComplete?: (count: number) => void;
  /** Called once after uploads complete with some failures */
  onBatchPartialComplete?: (successCount: number, failCount: number) => void;
  students: StudentWithParent[];
  studentsLoading?: boolean;
  tutorId: string;
  preSelectedStudentId?: string;
  lesson?: ScheduledLessonWithStudent | null;
}

type Step = 'student' | 'image' | 'details';

export function ImageShareModal({
  visible,
  onClose,
  onUploadComplete,
  onBatchComplete,
  onBatchPartialComplete,
  students,
  studentsLoading = false,
  tutorId,
  preSelectedStudentId,
  lesson,
}: ImageShareModalProps) {
  const [step, setStep] = useState<Step>(preSelectedStudentId ? 'image' : 'student');
  // Multi-image support
  const [selectedFiles, setSelectedFiles] = useState<SelectedImageFile[]>([]);
  // Multi-student support
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>(
    preSelectedStudentId ? [preSelectedStudentId] : []
  );
  // Student search/filter
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const { uploadFile } = useFileUpload();

  // Filter students based on search query
  const filteredStudents = useMemo(() => {
    if (!studentSearchQuery.trim()) return students;
    const query = studentSearchQuery.toLowerCase().trim();
    return students.filter(
      (student) =>
        student.name.toLowerCase().includes(query) ||
        `grade ${student.grade_level}`.toLowerCase().includes(query) ||
        `age ${student.age}`.toLowerCase().includes(query)
    );
  }, [students, studentSearchQuery]);

  const handleClose = () => {
    setStep(preSelectedStudentId ? 'image' : 'student');
    setSelectedFiles([]);
    setSelectedStudentIds(preSelectedStudentId ? [preSelectedStudentId] : []);
    setStudentSearchQuery('');
    setTitle('');
    setDescription('');
    setError(null);
    setUploadProgress({ current: 0, total: 0 });
    onClose();
  };

  const handleBack = () => {
    if (step === 'details') setStep('image');
    else if (step === 'image' && !preSelectedStudentId) setStep('student');
  };

  // Toggle student selection (multi-select)
  const handleToggleStudent = (studentId: string) => {
    setSelectedStudentIds((prev) => {
      if (prev.includes(studentId)) {
        return prev.filter((id) => id !== studentId);
      }
      return [...prev, studentId];
    });
  };

  // Select all filtered students
  const handleSelectAllStudents = () => {
    const filteredIds = filteredStudents.map((s) => s.id);
    const allSelected = filteredIds.every((id) => selectedStudentIds.includes(id));
    if (allSelected) {
      // Deselect all filtered
      setSelectedStudentIds((prev) => prev.filter((id) => !filteredIds.includes(id)));
    } else {
      // Select all filtered
      setSelectedStudentIds((prev) => {
        const newIds = filteredIds.filter((id) => !prev.includes(id));
        return [...prev, ...newIds];
      });
    }
  };

  // Continue from student selection to image selection
  const handleContinueToImages = () => {
    if (selectedStudentIds.length === 0) {
      setError('Please select at least one student');
      return;
    }
    setError(null);
    setStep('image');
  };

  // Handle picking multiple images from library
  const handlePickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        setError('Photo library permission is required');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        selectionLimit: 10, // Allow up to 10 images at a time
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const maxSize = FILE_SIZE_LIMITS[STORAGE_BUCKETS.SESSION_MEDIA];
      const newFiles: SelectedImageFile[] = [];

      for (const image of result.assets) {
        const timestamp = Date.now() + Math.random();
        const extension = (image.mimeType || 'image/jpeg').split('/')[1] || 'jpg';
        const fileName = image.fileName || `photo_${timestamp}.${extension}`;
        const fileSize = image.fileSize || 0;

        if (fileSize > maxSize) {
          const maxSizeMB = Math.round(maxSize / (1024 * 1024));
          setError(`Some images are too large. Maximum size is ${maxSizeMB}MB`);
          continue;
        }

        newFiles.push({
          uri: image.uri,
          name: fileName,
          size: fileSize,
          mimeType: image.mimeType || 'image/jpeg',
        });
      }

      if (newFiles.length > 0) {
        setSelectedFiles((prev) => [...prev, ...newFiles]);
        setError(null);
      }
    } catch (err) {
      console.error('Image picker error:', err);
      setError('Failed to select images');
    }
  };

  // Handle taking a photo with camera
  const handleTakePhoto = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        setError('Camera permission is required');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const image = result.assets[0];
      const timestamp = Date.now();
      const extension = (image.mimeType || 'image/jpeg').split('/')[1] || 'jpg';
      const fileName = image.fileName || `photo_${timestamp}.${extension}`;

      setSelectedFiles((prev) => [
        ...prev,
        {
          uri: image.uri,
          name: fileName,
          size: image.fileSize || 0,
          mimeType: image.mimeType || 'image/jpeg',
        },
      ]);
      setError(null);
    } catch (err) {
      console.error('Camera error:', err);
      setError('Failed to take photo');
    }
  };

  // Remove a selected image
  const handleRemoveImage = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Continue from image selection to details
  const handleContinueToDetails = () => {
    if (selectedFiles.length === 0) {
      setError('Please select at least one image');
      return;
    }
    setError(null);
    // Generate default title
    const date = new Date().toLocaleDateString();
    const studentCount = selectedStudentIds.length;
    const imageCount = selectedFiles.length;
    const studentText = studentCount === 1
      ? students.find((s) => s.id === selectedStudentIds[0])?.name || 'Student'
      : `${studentCount} Students`;
    const imageText = imageCount === 1 ? 'Photo' : `${imageCount} Photos`;
    setTitle(`Session ${imageText} - ${studentText} - ${date}`);
    setStep('details');
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0 || selectedStudentIds.length === 0 || !title.trim()) {
      setError('Please complete all required fields');
      return;
    }

    setUploading(true);
    setError(null);

    const totalUploads = selectedFiles.length * selectedStudentIds.length;
    setUploadProgress({ current: 0, total: totalUploads });
    let completed = 0;
    let errors: string[] = [];

    try {
      // For each image, upload to each selected student
      for (const file of selectedFiles) {
        for (const studentId of selectedStudentIds) {
          try {
            // Upload file to storage
            const uploadResult = await uploadFile(
              STORAGE_BUCKETS.SESSION_MEDIA,
              studentId,
              file.uri,
              file.name,
              file.mimeType
            );

            if (!uploadResult) {
              throw new Error('Failed to upload image');
            }

            // Get student's parent ID
            const student = students.find((s) => s.id === studentId);
            if (!student) {
              throw new Error('Student not found');
            }

            // Create shared resource
            const input: CreateSharedResourceInput = {
              student_id: studentId,
              parent_id: student.parent_id,
              tutor_id: tutorId,
              resource_type: 'image',
              title: title.trim(),
              description: description.trim() || null,
              storage_path: uploadResult.path,
              thumbnail_url: uploadResult.publicUrl,
              file_size: uploadResult.size,
              mime_type: uploadResult.mimeType,
              lesson_id: lesson?.id || null,
            };

            await onUploadComplete(input);
            completed++;
            setUploadProgress({ current: completed, total: totalUploads });
          } catch (err) {
            const student = students.find((s) => s.id === studentId);
            errors.push(`Failed for ${student?.name || 'unknown'}: ${file.name}`);
          }
        }
      }

      if (errors.length > 0 && errors.length < totalUploads) {
        // Partial success - call partial complete callback
        const successCount = totalUploads - errors.length;
        onBatchPartialComplete?.(successCount, errors.length);
        setError(`Partially completed. ${errors.length} of ${totalUploads} uploads failed.`);
      } else if (errors.length === totalUploads) {
        throw new Error('All uploads failed');
      } else {
        // All successful - call batch complete callback
        onBatchComplete?.(totalUploads);
        handleClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  const renderStudentSelection = () => {
    const allFilteredSelected = filteredStudents.length > 0 &&
      filteredStudents.every((s) => selectedStudentIds.includes(s.id));

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Select Students</Text>
        <Text style={styles.stepSubtitle}>
          Choose which students to share images with (select multiple)
        </Text>

        {/* Search Input */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.neutral.textMuted} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={studentSearchQuery}
            onChangeText={setStudentSearchQuery}
            placeholder="Search by name, grade, or age..."
            placeholderTextColor={colors.neutral.textMuted}
          />
          {studentSearchQuery.length > 0 && (
            <Pressable onPress={() => setStudentSearchQuery('')} style={styles.clearSearchButton}>
              <Ionicons name="close-circle" size={20} color={colors.neutral.textMuted} />
            </Pressable>
          )}
        </View>

        {/* Selection Summary & Select All */}
        <View style={styles.selectionHeader}>
          <Text style={styles.selectionCount}>
            {selectedStudentIds.length} student{selectedStudentIds.length !== 1 ? 's' : ''} selected
          </Text>
          {filteredStudents.length > 0 && (
            <Pressable onPress={handleSelectAllStudents} style={styles.selectAllButton}>
              <Ionicons
                name={allFilteredSelected ? 'checkbox' : 'square-outline'}
                size={20}
                color={colors.status.info}
              />
              <Text style={styles.selectAllText}>
                {allFilteredSelected ? 'Deselect All' : 'Select All'}
              </Text>
            </Pressable>
          )}
        </View>

        {studentsLoading ? (
          <ActivityIndicator size="large" color={colors.piano.primary} />
        ) : filteredStudents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="person-outline" size={48} color={colors.neutral.textMuted} />
            <Text style={styles.emptyText}>
              {studentSearchQuery ? 'No students match your search' : 'No students found'}
            </Text>
          </View>
        ) : (
          <View style={styles.studentList}>
            {filteredStudents.map((student) => {
              const isSelected = selectedStudentIds.includes(student.id);
              return (
                <Pressable
                  key={student.id}
                  style={[styles.studentCard, isSelected && styles.studentCardSelected]}
                  onPress={() => handleToggleStudent(student.id)}
                >
                  <View style={styles.checkboxContainer}>
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={24}
                      color={isSelected ? colors.status.info : colors.neutral.textMuted}
                    />
                  </View>
                  <View style={[styles.studentAvatar, isSelected && styles.studentAvatarSelected]}>
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
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Continue Button */}
        {selectedStudentIds.length > 0 && (
          <View style={styles.continueButtonContainer}>
            <Pressable style={styles.continueButton} onPress={handleContinueToImages}>
              <Text style={styles.continueButtonText}>
                Continue with {selectedStudentIds.length} Student{selectedStudentIds.length !== 1 ? 's' : ''}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={colors.neutral.white} />
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderImageSelection = () => {
    const studentNames = selectedStudentIds
      .map((id) => students.find((s) => s.id === id)?.name)
      .filter(Boolean)
      .join(', ');

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Select Images</Text>
        <Text style={styles.stepSubtitle}>
          Add photos to share with {selectedStudentIds.length === 1 ? studentNames : `${selectedStudentIds.length} students`}
        </Text>

        {/* Image Picker Options */}
        <View style={styles.imagePickerOptions}>
          <Pressable style={styles.imageOption} onPress={handlePickImages}>
            <View style={styles.smallIconContainer}>
              <Ionicons name="images" size={32} color={colors.piano.primary} />
            </View>
            <Text style={styles.optionLabel}>Photo Library</Text>
            <Text style={styles.optionDescription}>Choose multiple images</Text>
          </Pressable>

          {Platform.OS !== 'web' && (
            <Pressable style={styles.imageOption} onPress={handleTakePhoto}>
              <View style={styles.smallIconContainer}>
                <Ionicons name="camera" size={32} color={colors.piano.primary} />
              </View>
              <Text style={styles.optionLabel}>Take Photo</Text>
              <Text style={styles.optionDescription}>Use camera</Text>
            </Pressable>
          )}
        </View>

        {/* Selected Images Preview */}
        {selectedFiles.length > 0 && (
          <View style={styles.selectedImagesSection}>
            <View style={styles.selectedImagesHeader}>
              <Text style={styles.selectedImagesTitle}>
                {selectedFiles.length} Image{selectedFiles.length !== 1 ? 's' : ''} Selected
              </Text>
              <Pressable onPress={() => setSelectedFiles([])} style={styles.clearAllButton}>
                <Text style={styles.clearAllText}>Clear All</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagePreviewScroll}>
              {selectedFiles.map((file, index) => (
                <View key={`${file.uri}-${index}`} style={styles.imagePreviewItem}>
                  <Image source={{ uri: file.uri }} style={styles.imagePreviewThumb} resizeMode="cover" />
                  <Pressable
                    style={styles.removeImageButton}
                    onPress={() => handleRemoveImage(index)}
                  >
                    <Ionicons name="close-circle" size={24} color={colors.status.error} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Continue Button */}
        {selectedFiles.length > 0 && (
          <View style={styles.continueButtonContainer}>
            <Pressable style={styles.continueButton} onPress={handleContinueToDetails}>
              <Text style={styles.continueButtonText}>
                Continue with {selectedFiles.length} Image{selectedFiles.length !== 1 ? 's' : ''}
              </Text>
              <Ionicons name="arrow-forward" size={20} color={colors.neutral.white} />
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderDetails = () => {
    const selectedStudents = selectedStudentIds
      .map((id) => students.find((s) => s.id === id))
      .filter(Boolean);
    const studentNames = selectedStudents.map((s) => s?.name).join(', ');

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Share Details</Text>
        <Text style={styles.stepSubtitle}>
          Add a title and note for the parents
        </Text>

        {/* Summary Info */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryItem}>
            <Ionicons name="people" size={20} color={colors.status.info} />
            <Text style={styles.summaryText}>
              {selectedStudentIds.length} Student{selectedStudentIds.length !== 1 ? 's' : ''}: {
                selectedStudentIds.length <= 3
                  ? studentNames
                  : `${selectedStudents.slice(0, 2).map((s) => s?.name).join(', ')} +${selectedStudentIds.length - 2} more`
              }
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Ionicons name="images" size={20} color={colors.status.info} />
            <Text style={styles.summaryText}>
              {selectedFiles.length} Image{selectedFiles.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Image Previews */}
        {selectedFiles.length > 0 && (
          <View style={styles.detailsImagePreview}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {selectedFiles.slice(0, 5).map((file, index) => (
                <Image
                  key={`${file.uri}-${index}`}
                  source={{ uri: file.uri }}
                  style={styles.detailsImageThumb}
                  resizeMode="cover"
                />
              ))}
              {selectedFiles.length > 5 && (
                <View style={styles.moreImagesIndicator}>
                  <Text style={styles.moreImagesText}>+{selectedFiles.length - 5}</Text>
                </View>
              )}
            </ScrollView>
            <Pressable
              style={styles.changeImagesButton}
              onPress={() => setStep('image')}
            >
              <Ionicons name="pencil" size={14} color={colors.status.info} />
              <Text style={styles.changeImagesText}>Edit</Text>
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
            placeholder="Enter a title for these images"
            placeholderTextColor={colors.neutral.textMuted}
          />
        </View>

        {/* Description Input */}
        <View style={styles.inputSection}>
          <Text style={styles.inputLabel}>Note for Parents (optional)</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Add a note about what's in these images..."
            placeholderTextColor={colors.neutral.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>

        {/* Upload count info */}
        <View style={styles.uploadInfoContainer}>
          <Ionicons name="information-circle" size={18} color={colors.neutral.textSecondary} />
          <Text style={styles.uploadInfoText}>
            This will create {selectedFiles.length * selectedStudentIds.length} shared resource{selectedFiles.length * selectedStudentIds.length !== 1 ? 's' : ''}
            ({selectedFiles.length} image{selectedFiles.length !== 1 ? 's' : ''} x {selectedStudentIds.length} student{selectedStudentIds.length !== 1 ? 's' : ''})
          </Text>
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
          <Text style={styles.headerTitle}>Share Session Images</Text>
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
            {uploading && uploadProgress.total > 0 && (
              <View style={styles.uploadProgressContainer}>
                <View style={styles.uploadProgressBar}>
                  <View
                    style={[
                      styles.uploadProgressFill,
                      { width: `${(uploadProgress.current / uploadProgress.total) * 100}%` },
                    ]}
                  />
                </View>
                <Text style={styles.uploadProgressText}>
                  Uploading {uploadProgress.current} of {uploadProgress.total}...
                </Text>
              </View>
            )}
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
                  <Text style={styles.uploadButtonText}>
                    Share with {selectedStudentIds.length} Parent{selectedStudentIds.length !== 1 ? 's' : ''}
                  </Text>
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
  // Search styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  searchIcon: {
    marginRight: spacing.xs,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  clearSearchButton: {
    padding: spacing.xs,
  },
  // Selection header styles
  selectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  selectionCount: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  selectAllText: {
    fontSize: typography.sizes.sm,
    color: colors.status.info,
    fontWeight: typography.weights.medium,
  },
  // Multi-select student card styles
  studentCardSelected: {
    borderWidth: 2,
    borderColor: colors.status.info,
    backgroundColor: colors.status.infoBg,
  },
  checkboxContainer: {
    marginRight: spacing.sm,
  },
  studentAvatarSelected: {
    backgroundColor: colors.status.info,
  },
  // Continue button styles
  continueButtonContainer: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.info,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  continueButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  // Image picker styles
  imagePickerOptions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  imageOption: {
    flex: 1,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    borderStyle: 'dashed',
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 150,
  },
  smallIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.piano.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  optionLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  optionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  // Selected images section styles
  selectedImagesSection: {
    marginBottom: spacing.lg,
  },
  selectedImagesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  selectedImagesTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  clearAllButton: {
    padding: spacing.xs,
  },
  clearAllText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    fontWeight: typography.weights.medium,
  },
  imagePreviewScroll: {
    flexDirection: 'row',
  },
  imagePreviewItem: {
    position: 'relative',
    marginRight: spacing.sm,
  },
  imagePreviewThumb: {
    width: 100,
    height: 100,
    borderRadius: borderRadius.md,
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
  },
  // Details page summary styles
  summaryContainer: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    flex: 1,
  },
  // Details image preview styles
  detailsImagePreview: {
    marginBottom: spacing.lg,
  },
  detailsImageThumb: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  moreImagesIndicator: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreImagesText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.textSecondary,
  },
  changeImagesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  changeImagesText: {
    fontSize: typography.sizes.sm,
    color: colors.status.info,
    fontWeight: typography.weights.medium,
  },
  // Upload info styles
  uploadInfoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.neutral.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  uploadInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    flex: 1,
    lineHeight: 20,
  },
  // Upload progress styles
  uploadProgressContainer: {
    marginBottom: spacing.md,
  },
  uploadProgressBar: {
    height: 6,
    backgroundColor: colors.neutral.border,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  uploadProgressFill: {
    height: '100%',
    backgroundColor: colors.status.info,
    borderRadius: 3,
  },
  uploadProgressText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
});

export default ImageShareModal;
