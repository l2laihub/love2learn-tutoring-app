/**
 * AvailableSessionsModal
 * Modal for parents to browse and sign up for existing group sessions
 * Two-step flow: 1) Browse sessions, 2) Fill enrollment form
 */

import React, { useState, useEffect, useMemo } from 'react';
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
import { colors, spacing, typography, borderRadius, shadows, getSubjectColor } from '../theme';
import {
  Student,
  TutoringSubject,
  AvailableGroupSession,
} from '../types/database';
import {
  useAvailableGroupSessions,
  useCreateEnrollment,
} from '../hooks/useGroupSessions';
import { formatTimeDisplay } from '../hooks/useTutorAvailability';
import { useTutorSettings, getSubjectRateConfig } from '../hooks/useTutorSettings';

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

// Duration options
const DURATION_OPTIONS = [30, 45, 60];

interface AvailableSessionsModalProps {
  visible: boolean;
  onClose: () => void;
  parentId: string;
  students: Student[];
  onEnrollmentCreated?: () => void;
}

export function AvailableSessionsModal({
  visible,
  onClose,
  parentId,
  students,
  onEnrollmentCreated,
}: AvailableSessionsModalProps) {
  // Step flow: sessions -> enroll
  const [step, setStep] = useState<'sessions' | 'enroll'>('sessions');
  const [selectedSession, setSelectedSession] = useState<AvailableGroupSession | null>(null);

  // Enrollment form state
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<TutoringSubject | null>(null);
  const [duration, setDuration] = useState<number>(30);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch available sessions
  const {
    data: availableSessions,
    loading: sessionsLoading,
    refetch: refetchSessions,
  } = useAvailableGroupSessions(parentId);

  const { createEnrollment, loading: submitting, error: submitError } = useCreateEnrollment();

  // Get tutor settings for default durations
  const { data: tutorSettings } = useTutorSettings();

  // Get students not already in the selected session
  const availableStudents = useMemo(() => {
    if (!selectedSession) return students;

    // Get student IDs already in the session
    const existingStudentIds = new Set(
      selectedSession.lessons.map((l) => l.student_id)
    );

    // Filter out students already enrolled
    return students.filter((s) => !existingStudentIds.has(s.id));
  }, [selectedSession, students]);

  // Get available subjects for selected student
  const availableSubjects = useMemo(() => {
    if (!selectedStudentId) return [];
    const student = students.find((s) => s.id === selectedStudentId);
    if (!student) return [];

    // If session has allowed_subjects restriction, filter by that
    const studentSubjects = (student.subjects || []) as TutoringSubject[];
    if (selectedSession?.settings.allowed_subjects) {
      return studentSubjects.filter((s) =>
        selectedSession.settings.allowed_subjects!.includes(s)
      );
    }

    return studentSubjects;
  }, [selectedStudentId, students, selectedSession]);

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setStep('sessions');
      setSelectedSession(null);
      setSelectedStudentId(null);
      setSelectedSubject(null);
      setDuration(30);
      setNotes('');
      setError(null);
      refetchSessions();
    }
  }, [visible, refetchSessions]);

  // Set default duration when subject is selected
  useEffect(() => {
    if (selectedSubject && tutorSettings) {
      const rateConfig = getSubjectRateConfig(tutorSettings, selectedSubject);
      setDuration(rateConfig.base_duration);
    }
  }, [selectedSubject, tutorSettings]);

  const handleSelectSession = (session: AvailableGroupSession) => {
    setSelectedSession(session);
    setStep('enroll');
  };

  const handleBack = () => {
    setStep('sessions');
    setSelectedStudentId(null);
    setSelectedSubject(null);
    setNotes('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedSession || !selectedStudentId || !selectedSubject) {
      setError('Please select a student and subject');
      return;
    }

    setError(null);

    const result = await createEnrollment({
      session_id: selectedSession.session_id,
      student_id: selectedStudentId,
      parent_id: parentId,
      subject: selectedSubject,
      duration_min: duration,
      notes: notes.trim() || null,
    });

    if (result) {
      onEnrollmentCreated?.();
      onClose();
    } else if (submitError) {
      setError(submitError.message);
    } else {
      setError('Failed to submit enrollment. Please try again.');
    }
  };

  // Format session time for display
  const formatSessionTime = (session: AvailableGroupSession) => {
    const date = new Date(session.session.scheduled_at);
    const dateStr = date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
    const startTime = date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    const endTime = new Date(
      date.getTime() + session.session.duration_min * 60 * 1000
    ).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
    return { dateStr, timeStr: `${startTime} - ${endTime}` };
  };

  // Get deadline display
  const formatDeadline = (session: AvailableGroupSession) => {
    const deadline = new Date(session.enrollment_deadline);
    const now = new Date();
    const hoursRemaining = Math.floor(
      (deadline.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    if (hoursRemaining < 24) {
      return `${hoursRemaining}h left to enroll`;
    }
    return `Enroll by ${deadline.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })} ${deadline.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })}`;
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={styles.title}>
            {step === 'sessions' ? 'Available Group Sessions' : 'Join Session'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step === 'sessions' && styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step === 'enroll' && styles.stepDotActive]} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Step 1: Browse Sessions */}
          {step === 'sessions' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Join an existing group session</Text>
              <Text style={styles.sectionSubtitle}>
                Browse sessions with available slots
              </Text>

              {sessionsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary.main} />
                </View>
              ) : availableSessions.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons
                    name="calendar-outline"
                    size={64}
                    color={colors.neutral.textMuted}
                  />
                  <Text style={styles.emptyStateTitle}>No Sessions Available</Text>
                  <Text style={styles.emptyStateText}>
                    There are no group sessions open for enrollment right now. Check back
                    later or request a drop-in session.
                  </Text>
                </View>
              ) : (
                <View style={styles.sessionsList}>
                  {availableSessions.map((session) => {
                    const { dateStr, timeStr } = formatSessionTime(session);
                    const subjects = Array.from(
                      new Set(session.lessons.map((l) => l.subject as TutoringSubject))
                    );
                    const primarySubject = subjects[0] || 'piano';
                    const subjectColor = getSubjectColor(primarySubject);
                    const studentNames = session.lessons.map((l) => l.student?.name || 'Student');

                    return (
                      <Pressable
                        key={session.session_id}
                        style={[
                          styles.sessionCard,
                          { borderLeftColor: subjectColor.primary },
                        ]}
                        onPress={() => handleSelectSession(session)}
                      >
                        <View style={styles.sessionHeader}>
                          <View style={styles.sessionInfo}>
                            <Text style={styles.sessionDate}>{dateStr}</Text>
                            <Text style={styles.sessionTime}>{timeStr}</Text>
                          </View>
                          <View style={styles.slotsInfo}>
                            <View style={styles.slotsBadge}>
                              <Ionicons
                                name="people"
                                size={14}
                                color={colors.primary.main}
                              />
                              <Text style={styles.slotsBadgeText}>
                                {session.available_slots}{' '}
                                {session.available_slots === 1 ? 'slot' : 'slots'} left
                              </Text>
                            </View>
                          </View>
                        </View>

                        <View style={styles.sessionContent}>
                          <View style={styles.sessionStudents}>
                            <Text style={styles.sessionStudentsLabel}>
                              Currently enrolled:
                            </Text>
                            <View style={styles.studentChips}>
                              {studentNames.map((name, idx) => (
                                <View key={idx} style={styles.studentChip}>
                                  <Text style={styles.studentChipText}>{name}</Text>
                                </View>
                              ))}
                            </View>
                          </View>

                          <View style={styles.sessionSubjects}>
                            {subjects.map((subject) => (
                              <View
                                key={subject}
                                style={[
                                  styles.subjectTag,
                                  {
                                    backgroundColor: getSubjectColor(subject).subtle,
                                  },
                                ]}
                              >
                                <Text style={styles.subjectEmoji}>
                                  {SUBJECT_EMOJI[subject]}
                                </Text>
                                <Text
                                  style={[
                                    styles.subjectTagText,
                                    { color: getSubjectColor(subject).primary },
                                  ]}
                                >
                                  {SUBJECT_NAMES[subject]}
                                </Text>
                              </View>
                            ))}
                          </View>

                          <View style={styles.deadlineRow}>
                            <Ionicons
                              name="time-outline"
                              size={14}
                              color={colors.status.warning}
                            />
                            <Text style={styles.deadlineText}>
                              {formatDeadline(session)}
                            </Text>
                          </View>
                        </View>

                        <View style={styles.sessionArrow}>
                          <Ionicons
                            name="chevron-forward"
                            size={20}
                            color={colors.neutral.textMuted}
                          />
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Step 2: Enrollment Form */}
          {step === 'enroll' && selectedSession && (
            <View style={styles.section}>
              <Pressable style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={20} color={colors.primary.main} />
                <Text style={styles.backButtonText}>Back to sessions</Text>
              </Pressable>

              <Text style={styles.sectionTitle}>Enrollment Details</Text>

              {/* Session Summary */}
              <View style={styles.sessionSummary}>
                <View style={styles.summaryRow}>
                  <Ionicons
                    name="calendar"
                    size={18}
                    color={colors.neutral.textSecondary}
                  />
                  <Text style={styles.summaryText}>
                    {formatSessionTime(selectedSession).dateStr} at{' '}
                    {formatSessionTime(selectedSession).timeStr}
                  </Text>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons
                    name="people"
                    size={18}
                    color={colors.neutral.textSecondary}
                  />
                  <Text style={styles.summaryText}>
                    {selectedSession.available_slots} slot
                    {selectedSession.available_slots !== 1 ? 's' : ''} available
                  </Text>
                </View>
              </View>

              {/* Student Selection */}
              <View style={styles.formSection}>
                <Text style={styles.formLabel}>Select student</Text>
                {availableStudents.length === 0 ? (
                  <View style={styles.infoBox}>
                    <Ionicons
                      name="information-circle"
                      size={20}
                      color={colors.status.info}
                    />
                    <Text style={styles.infoText}>
                      All your students are already enrolled in this session.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.studentOptions}>
                    {availableStudents.map((student) => (
                      <Pressable
                        key={student.id}
                        style={[
                          styles.studentOption,
                          selectedStudentId === student.id &&
                            styles.studentOptionSelected,
                        ]}
                        onPress={() => {
                          setSelectedStudentId(student.id);
                          setSelectedSubject(null);
                        }}
                      >
                        <View style={styles.radioOuter}>
                          {selectedStudentId === student.id && (
                            <View style={styles.radioInner} />
                          )}
                        </View>
                        <View style={styles.studentOptionInfo}>
                          <Text style={styles.studentOptionName}>{student.name}</Text>
                          <Text style={styles.studentOptionSubjects}>
                            {(student.subjects as TutoringSubject[] || [])
                              .map((s) => SUBJECT_NAMES[s])
                              .join(', ') || 'No subjects'}
                          </Text>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>

              {/* Subject Selection */}
              {selectedStudentId && (
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Select subject</Text>
                  {availableSubjects.length === 0 ? (
                    <View style={styles.infoBox}>
                      <Ionicons
                        name="alert-circle"
                        size={20}
                        color={colors.status.warning}
                      />
                      <Text style={styles.infoText}>
                        This student has no subjects that match the session requirements.
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.subjectOptions}>
                      {availableSubjects.map((subject) => (
                        <Pressable
                          key={subject}
                          style={[
                            styles.subjectOption,
                            selectedSubject === subject && styles.subjectOptionSelected,
                          ]}
                          onPress={() => setSelectedSubject(subject)}
                        >
                          <Text style={styles.subjectOptionEmoji}>
                            {SUBJECT_EMOJI[subject]}
                          </Text>
                          <Text
                            style={[
                              styles.subjectOptionText,
                              selectedSubject === subject &&
                                styles.subjectOptionTextSelected,
                            ]}
                          >
                            {SUBJECT_NAMES[subject]}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              )}

              {/* Duration Selection */}
              {selectedSubject && (
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Session duration</Text>
                  <View style={styles.durationOptions}>
                    {DURATION_OPTIONS.map((dur) => (
                      <Pressable
                        key={dur}
                        style={[
                          styles.durationOption,
                          duration === dur && styles.durationOptionSelected,
                        ]}
                        onPress={() => setDuration(dur)}
                      >
                        <Text
                          style={[
                            styles.durationText,
                            duration === dur && styles.durationTextSelected,
                          ]}
                        >
                          {dur} min
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {/* Notes */}
              {selectedSubject && (
                <View style={styles.formSection}>
                  <Text style={styles.formLabel}>Notes (optional)</Text>
                  <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    placeholder="Any special requests or notes for the tutor"
                    placeholderTextColor={colors.neutral.textMuted}
                    multiline
                    numberOfLines={3}
                  />
                </View>
              )}

              {/* Info Box */}
              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={colors.status.info}
                />
                <Text style={styles.infoText}>
                  Your enrollment request will be sent to the tutor for approval.
                  Once approved, the lesson will be added to your calendar.
                </Text>
              </View>

              {/* Error */}
              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color={colors.status.error} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        {step === 'enroll' && selectedSession && (
          <View style={styles.footer}>
            <Pressable
              style={[
                styles.submitButton,
                (!selectedStudentId || !selectedSubject || submitting) &&
                  styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedStudentId || !selectedSubject || submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <>
                  <Ionicons name="send" size={20} color={colors.neutral.white} />
                  <Text style={styles.submitButtonText}>Request to Join</Text>
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
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  headerSpacer: {
    width: 40,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
  },
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.neutral.border,
  },
  stepDotActive: {
    backgroundColor: colors.primary.main,
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.neutral.border,
    marginHorizontal: spacing.xs,
  },
  content: {
    flex: 1,
    padding: spacing.base,
  },
  section: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  sectionSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.lg,
  },
  loadingContainer: {
    padding: spacing['2xl'],
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing['2xl'],
  },
  emptyStateTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.xl,
  },
  sessionsList: {
    gap: spacing.md,
  },
  sessionCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    overflow: 'hidden',
    ...shadows.sm,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderLight,
  },
  sessionInfo: {
    flex: 1,
  },
  sessionDate: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  sessionTime: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  slotsInfo: {
    alignItems: 'flex-end',
  },
  slotsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary.subtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  slotsBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
  sessionContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  sessionStudents: {
    gap: spacing.xs,
  },
  sessionStudentsLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  studentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  studentChip: {
    backgroundColor: colors.neutral.background,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  studentChipText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
  },
  sessionSubjects: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  subjectEmoji: {
    fontSize: 14,
  },
  subjectTagText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  deadlineText: {
    fontSize: typography.sizes.xs,
    color: colors.status.warning,
    fontWeight: typography.weights.medium,
  },
  sessionArrow: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    marginTop: -10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  backButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary.main,
    fontWeight: typography.weights.medium,
  },
  sessionSummary: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  summaryText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
  },
  formSection: {
    marginBottom: spacing.lg,
  },
  formLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  studentOptions: {
    gap: spacing.sm,
  },
  studentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadows.sm,
  },
  studentOptionSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.subtle,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary.main,
  },
  studentOptionInfo: {
    flex: 1,
  },
  studentOptionName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  studentOptionSubjects: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  subjectOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  subjectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    ...shadows.sm,
  },
  subjectOptionSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  subjectOptionEmoji: {
    fontSize: 18,
  },
  subjectOptionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  subjectOptionTextSelected: {
    color: colors.neutral.white,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationOption: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    ...shadows.sm,
  },
  durationOptionSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  durationText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  durationTextSelected: {
    color: colors.neutral.white,
  },
  notesInput: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.status.infoBg,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  infoText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.status.info,
    lineHeight: 20,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.status.errorBg,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
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
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

export default AvailableSessionsModal;
