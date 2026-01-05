/**
 * YouTubeShareModal
 * Modal for sharing YouTube video links with parents
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
import { StudentWithParent, CreateSharedResourceInput, ScheduledLessonWithStudent } from '../types/database';
import { isValidYouTubeUrl, getYouTubeVideoInfo } from '../utils/youtube';
import { YouTubeEmbed } from './YouTubeEmbed';

export interface YouTubeShareModalProps {
  visible: boolean;
  onClose: () => void;
  onShare: (input: CreateSharedResourceInput) => Promise<void>;
  students: StudentWithParent[];
  studentsLoading?: boolean;
  tutorId: string;
  preSelectedStudentId?: string;
  lesson?: ScheduledLessonWithStudent | null;
}

type Step = 'url' | 'student' | 'details';

export function YouTubeShareModal({
  visible,
  onClose,
  onShare,
  students,
  studentsLoading = false,
  tutorId,
  preSelectedStudentId,
  lesson,
}: YouTubeShareModalProps) {
  const [step, setStep] = useState<Step>(preSelectedStudentId ? 'url' : 'student');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string>(preSelectedStudentId || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  // Reset when modal opens
  useEffect(() => {
    if (visible) {
      setStep(preSelectedStudentId ? 'url' : 'student');
      setSelectedStudentId(preSelectedStudentId || '');
    }
  }, [visible, preSelectedStudentId]);

  const handleClose = () => {
    setStep(preSelectedStudentId ? 'url' : 'student');
    setYoutubeUrl('');
    setSelectedStudentId(preSelectedStudentId || '');
    setTitle('');
    setDescription('');
    setError(null);
    setUrlError(null);
    onClose();
  };

  const handleBack = () => {
    if (step === 'details') setStep('url');
    else if (step === 'url' && !preSelectedStudentId) setStep('student');
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setStep('url');
  };

  const handleUrlChange = (text: string) => {
    setYoutubeUrl(text);
    setUrlError(null);
  };

  const handleValidateUrl = () => {
    if (!youtubeUrl.trim()) {
      setUrlError('Please enter a YouTube URL');
      return;
    }

    if (!isValidYouTubeUrl(youtubeUrl)) {
      setUrlError('Invalid YouTube URL. Please enter a valid link.');
      return;
    }

    // Get video info for thumbnail
    const videoInfo = getYouTubeVideoInfo(youtubeUrl);
    if (!videoInfo) {
      setUrlError('Could not parse YouTube URL');
      return;
    }

    // Generate default title
    const student = students.find((s) => s.id === selectedStudentId);
    const date = new Date().toLocaleDateString();
    setTitle(`Session Recording - ${student?.name || 'Student'} - ${date}`);

    setStep('details');
  };

  const handleShare = async () => {
    if (!selectedStudentId || !youtubeUrl.trim() || !title.trim()) {
      setError('Please complete all required fields');
      return;
    }

    const videoInfo = getYouTubeVideoInfo(youtubeUrl);
    if (!videoInfo) {
      setError('Invalid YouTube URL');
      return;
    }

    setSharing(true);
    setError(null);

    try {
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
        resource_type: 'video',
        title: title.trim(),
        description: description.trim() || null,
        external_url: videoInfo.url, // Store canonical URL
        thumbnail_url: videoInfo.thumbnailUrlHQ,
        lesson_id: lesson?.id || null,
      };

      console.log('[YouTubeShareModal] Sharing video:', input);
      await onShare(input);
      console.log('[YouTubeShareModal] Video shared successfully');
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to share video');
    } finally {
      setSharing(false);
    }
  };

  const renderStudentSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Select Student</Text>
      <Text style={styles.stepSubtitle}>
        Choose which student this video is for
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

  const renderUrlInput = () => {
    const selectedStudent = students.find((s) => s.id === selectedStudentId);
    const videoInfo = youtubeUrl ? getYouTubeVideoInfo(youtubeUrl) : null;
    const isValid = videoInfo !== null;

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>YouTube Video</Text>
        <Text style={styles.stepSubtitle}>
          Paste a YouTube URL to share{' '}
          {selectedStudent ? `with ${selectedStudent.name}'s parent` : ''}
        </Text>

        {/* URL Input */}
        <View style={styles.urlInputContainer}>
          <View style={styles.urlInputWrapper}>
            <Ionicons name="logo-youtube" size={24} color="#FF0000" style={styles.urlIcon} />
            <TextInput
              style={styles.urlInput}
              value={youtubeUrl}
              onChangeText={handleUrlChange}
              placeholder="Paste YouTube URL here..."
              placeholderTextColor={colors.neutral.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            {youtubeUrl.length > 0 && (
              <Pressable onPress={() => setYoutubeUrl('')} style={styles.clearUrlButton}>
                <Ionicons name="close-circle" size={20} color={colors.neutral.textMuted} />
              </Pressable>
            )}
          </View>

          {urlError && (
            <View style={styles.urlErrorContainer}>
              <Ionicons name="alert-circle" size={14} color={colors.status.error} />
              <Text style={styles.urlErrorText}>{urlError}</Text>
            </View>
          )}

          {isValid && (
            <View style={styles.urlValidContainer}>
              <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
              <Text style={styles.urlValidText}>Valid YouTube URL</Text>
            </View>
          )}
        </View>

        {/* Preview */}
        {isValid && (
          <View style={styles.previewSection}>
            <Text style={styles.previewLabel}>Preview</Text>
            <YouTubeEmbed url={youtubeUrl} showTitle={false} />
          </View>
        )}

        {/* Example URLs */}
        <View style={styles.exampleSection}>
          <Text style={styles.exampleTitle}>Supported formats:</Text>
          <Text style={styles.exampleText}>• youtube.com/watch?v=...</Text>
          <Text style={styles.exampleText}>• youtu.be/...</Text>
          <Text style={styles.exampleText}>• youtube.com/shorts/...</Text>
        </View>
      </View>
    );
  };

  const renderDetails = () => {
    const selectedStudent = students.find((s) => s.id === selectedStudentId);

    return (
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>Video Details</Text>
        <Text style={styles.stepSubtitle}>
          Add a title and note for {selectedStudent?.name}'s parent
        </Text>

        {/* Video Preview */}
        <View style={styles.videoPreviewContainer}>
          <YouTubeEmbed url={youtubeUrl} showTitle={false} />
        </View>

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
            placeholder="Enter a title for this video"
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
            placeholder="Add a note about what's in this video..."
            placeholderTextColor={colors.neutral.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
        </View>
      </View>
    );
  };

  const canGoBack = step === 'details' || (step === 'url' && !preSelectedStudentId);
  const videoInfo = youtubeUrl ? getYouTubeVideoInfo(youtubeUrl) : null;

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
          <Text style={styles.headerTitle}>Share YouTube Video</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress */}
        {!preSelectedStudentId && (
          <View style={styles.progressBar}>
            <View style={[styles.progressDot, step === 'student' && styles.progressDotActive]} />
            <View style={[styles.progressLine, step !== 'student' && styles.progressLineActive]} />
            <View style={[styles.progressDot, step === 'url' && styles.progressDotActive]} />
            <View style={[styles.progressLine, step === 'details' && styles.progressLineActive]} />
            <View style={[styles.progressDot, step === 'details' && styles.progressDotActive]} />
          </View>
        )}

        {/* Content */}
        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {step === 'student' && renderStudentSelection()}
          {step === 'url' && renderUrlInput()}
          {step === 'details' && renderDetails()}

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Action Buttons */}
        {step === 'url' && (
          <View style={styles.footer}>
            <Pressable
              style={[
                styles.nextButton,
                !videoInfo && styles.nextButtonDisabled,
              ]}
              onPress={handleValidateUrl}
              disabled={!videoInfo}
            >
              <Text style={styles.nextButtonText}>Continue</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.neutral.white} />
            </Pressable>
          </View>
        )}

        {step === 'details' && (
          <View style={styles.footer}>
            <Pressable
              style={[styles.shareButton, sharing && styles.shareButtonDisabled]}
              onPress={handleShare}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <>
                  <Ionicons name="share-outline" size={20} color={colors.neutral.white} />
                  <Text style={styles.shareButtonText}>Share with Parent</Text>
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
    backgroundColor: '#FF0000',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.neutral.border,
    marginHorizontal: spacing.xs,
  },
  progressLineActive: {
    backgroundColor: '#FF0000',
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
    backgroundColor: '#FF0000',
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
  urlInputContainer: {
    marginBottom: spacing.lg,
  },
  urlInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.sm,
  },
  urlIcon: {
    marginRight: spacing.sm,
  },
  urlInput: {
    flex: 1,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  clearUrlButton: {
    padding: spacing.xs,
  },
  urlErrorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  urlErrorText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
  },
  urlValidContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  urlValidText: {
    fontSize: typography.sizes.sm,
    color: colors.status.success,
  },
  previewSection: {
    marginBottom: spacing.lg,
  },
  previewLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  exampleSection: {
    backgroundColor: colors.neutral.surfaceHover,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  exampleTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  exampleText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginBottom: 2,
  },
  videoPreviewContainer: {
    marginBottom: spacing.lg,
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
  nextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#FF0000',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  nextButtonDisabled: {
    opacity: 0.5,
  },
  nextButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#FF0000',
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

export default YouTubeShareModal;
