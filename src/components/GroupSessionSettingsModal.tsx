/**
 * GroupSessionSettingsModal
 * Modal for tutors to configure session enrollment settings
 * Enable/disable enrollment, set max students, deadline, etc.
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
  Switch,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import {
  GroupSessionSettings,
  TutoringSubject,
} from '../types/database';
import {
  useGroupSessionSettings,
  useUpsertGroupSessionSettings,
} from '../hooks/useGroupSessions';

// Subject display names
const SUBJECT_NAMES: Record<TutoringSubject, string> = {
  piano: 'Piano',
  math: 'Math',
  reading: 'Reading',
  speech: 'Speech',
  english: 'English',
};

const ALL_SUBJECTS: TutoringSubject[] = ['piano', 'math', 'reading', 'speech', 'english'];

interface GroupSessionSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  sessionId: string;
  sessionDate?: Date;
  onSaved?: (settings: GroupSessionSettings) => void;
}

export function GroupSessionSettingsModal({
  visible,
  onClose,
  sessionId,
  sessionDate,
  onSaved,
}: GroupSessionSettingsModalProps) {
  // Form state
  const [isOpen, setIsOpen] = useState(true);
  const [maxStudents, setMaxStudents] = useState('4');
  const [deadlineHours, setDeadlineHours] = useState('24');
  const [notes, setNotes] = useState('');
  const [allowedSubjects, setAllowedSubjects] = useState<TutoringSubject[]>([]);
  const [restrictSubjects, setRestrictSubjects] = useState(false);

  // Fetch existing settings
  const { data: existingSettings, loading: fetchLoading } = useGroupSessionSettings(
    visible ? sessionId : null
  );

  // Save hook
  const { upsert, loading: saving, error } = useUpsertGroupSessionSettings();

  // Initialize form with existing settings
  useEffect(() => {
    if (existingSettings) {
      setIsOpen(existingSettings.is_open_for_enrollment);
      setMaxStudents(existingSettings.max_students.toString());
      setDeadlineHours(existingSettings.enrollment_deadline_hours.toString());
      setNotes(existingSettings.notes || '');
      if (existingSettings.allowed_subjects) {
        setRestrictSubjects(true);
        setAllowedSubjects(existingSettings.allowed_subjects as TutoringSubject[]);
      } else {
        setRestrictSubjects(false);
        setAllowedSubjects([]);
      }
    } else if (visible) {
      // Reset to defaults for new settings
      setIsOpen(true);
      setMaxStudents('4');
      setDeadlineHours('24');
      setNotes('');
      setRestrictSubjects(false);
      setAllowedSubjects([]);
    }
  }, [existingSettings, visible]);

  const toggleSubject = (subject: TutoringSubject) => {
    setAllowedSubjects((prev) =>
      prev.includes(subject)
        ? prev.filter((s) => s !== subject)
        : [...prev, subject]
    );
  };

  const handleSave = async () => {
    const maxStudentsNum = parseInt(maxStudents, 10) || 4;
    const deadlineNum = parseInt(deadlineHours, 10) || 24;

    const result = await upsert({
      session_id: sessionId,
      is_open_for_enrollment: isOpen,
      max_students: Math.max(1, Math.min(10, maxStudentsNum)),
      enrollment_deadline_hours: Math.max(1, Math.min(168, deadlineNum)),
      allowed_subjects: restrictSubjects && allowedSubjects.length > 0 ? allowedSubjects : null,
      notes: notes.trim() || null,
    });

    if (result) {
      onSaved?.(result);
      onClose();
    }
  };

  const formattedDate = sessionDate
    ? sessionDate.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  const formattedTime = sessionDate
    ? sessionDate.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : null;

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
          <Text style={styles.title}>Enrollment Settings</Text>
          <View style={styles.headerSpacer} />
        </View>

        {fetchLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
          </View>
        ) : (
          <>
            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
              {/* Session Info */}
              {formattedDate && (
                <View style={styles.sessionInfo}>
                  <Ionicons
                    name="calendar"
                    size={20}
                    color={colors.neutral.textSecondary}
                  />
                  <View>
                    <Text style={styles.sessionDate}>{formattedDate}</Text>
                    {formattedTime && (
                      <Text style={styles.sessionTime}>at {formattedTime}</Text>
                    )}
                  </View>
                </View>
              )}

              {/* Open for Enrollment Toggle */}
              <View style={styles.section}>
                <View style={styles.toggleRow}>
                  <View style={styles.toggleInfo}>
                    <Ionicons
                      name="people"
                      size={24}
                      color={isOpen ? colors.status.success : colors.neutral.textMuted}
                    />
                    <View style={styles.toggleTextContainer}>
                      <Text style={styles.toggleLabel}>Open for Enrollment</Text>
                      <Text style={styles.toggleDescription}>
                        Allow parents to request joining this session
                      </Text>
                    </View>
                  </View>
                  <Switch
                    value={isOpen}
                    onValueChange={setIsOpen}
                    trackColor={{
                      false: colors.neutral.border,
                      true: colors.status.successBg,
                    }}
                    thumbColor={isOpen ? colors.status.success : colors.neutral.textMuted}
                  />
                </View>
              </View>

              {/* Settings (only show if open) */}
              {isOpen && (
                <>
                  {/* Max Students */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Maximum Students</Text>
                    <Text style={styles.sectionDescription}>
                      Total number of students allowed in this session
                    </Text>
                    <View style={styles.inputRow}>
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() =>
                          setMaxStudents((prev) =>
                            Math.max(1, parseInt(prev, 10) - 1).toString()
                          )
                        }
                      >
                        <Ionicons name="remove" size={20} color={colors.primary.main} />
                      </Pressable>
                      <TextInput
                        style={styles.numberInput}
                        value={maxStudents}
                        onChangeText={(text) => setMaxStudents(text.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        maxLength={2}
                      />
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() =>
                          setMaxStudents((prev) =>
                            Math.min(10, parseInt(prev, 10) + 1).toString()
                          )
                        }
                      >
                        <Ionicons name="add" size={20} color={colors.primary.main} />
                      </Pressable>
                    </View>
                  </View>

                  {/* Enrollment Deadline */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Enrollment Deadline</Text>
                    <Text style={styles.sectionDescription}>
                      Hours before session when enrollment closes
                    </Text>
                    <View style={styles.inputRow}>
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() =>
                          setDeadlineHours((prev) =>
                            Math.max(1, parseInt(prev, 10) - 1).toString()
                          )
                        }
                      >
                        <Ionicons name="remove" size={20} color={colors.primary.main} />
                      </Pressable>
                      <TextInput
                        style={styles.numberInput}
                        value={deadlineHours}
                        onChangeText={(text) => setDeadlineHours(text.replace(/[^0-9]/g, ''))}
                        keyboardType="numeric"
                        maxLength={3}
                      />
                      <Pressable
                        style={styles.stepperButton}
                        onPress={() =>
                          setDeadlineHours((prev) =>
                            Math.min(168, parseInt(prev, 10) + 1).toString()
                          )
                        }
                      >
                        <Ionicons name="add" size={20} color={colors.primary.main} />
                      </Pressable>
                      <Text style={styles.inputSuffix}>hours</Text>
                    </View>
                  </View>

                  {/* Subject Restriction */}
                  <View style={styles.section}>
                    <View style={styles.toggleRow}>
                      <View style={styles.toggleInfo}>
                        <Ionicons
                          name="book"
                          size={24}
                          color={
                            restrictSubjects
                              ? colors.primary.main
                              : colors.neutral.textMuted
                          }
                        />
                        <View style={styles.toggleTextContainer}>
                          <Text style={styles.toggleLabel}>Restrict Subjects</Text>
                          <Text style={styles.toggleDescription}>
                            Only allow specific subjects for enrollment
                          </Text>
                        </View>
                      </View>
                      <Switch
                        value={restrictSubjects}
                        onValueChange={setRestrictSubjects}
                        trackColor={{
                          false: colors.neutral.border,
                          true: colors.primary.subtle,
                        }}
                        thumbColor={
                          restrictSubjects ? colors.primary.main : colors.neutral.textMuted
                        }
                      />
                    </View>

                    {restrictSubjects && (
                      <View style={styles.subjectOptions}>
                        {ALL_SUBJECTS.map((subject) => (
                          <Pressable
                            key={subject}
                            style={[
                              styles.subjectOption,
                              allowedSubjects.includes(subject) &&
                                styles.subjectOptionSelected,
                            ]}
                            onPress={() => toggleSubject(subject)}
                          >
                            <Ionicons
                              name={
                                allowedSubjects.includes(subject)
                                  ? 'checkbox'
                                  : 'square-outline'
                              }
                              size={20}
                              color={
                                allowedSubjects.includes(subject)
                                  ? colors.primary.main
                                  : colors.neutral.border
                              }
                            />
                            <Text
                              style={[
                                styles.subjectOptionText,
                                allowedSubjects.includes(subject) &&
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

                  {/* Notes */}
                  <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Notes for Parents</Text>
                    <Text style={styles.sectionDescription}>
                      Optional message shown to parents when enrolling
                    </Text>
                    <TextInput
                      style={styles.notesInput}
                      value={notes}
                      onChangeText={setNotes}
                      placeholder="e.g., This is a Math fundamentals group session"
                      placeholderTextColor={colors.neutral.textMuted}
                      multiline
                      numberOfLines={3}
                    />
                  </View>
                </>
              )}

              {/* Error */}
              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={18} color={colors.status.error} />
                  <Text style={styles.errorText}>{error.message}</Text>
                </View>
              )}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Pressable
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color={colors.neutral.white} />
                ) : (
                  <>
                    <Ionicons name="checkmark" size={20} color={colors.neutral.white} />
                    <Text style={styles.saveButtonText}>Save Settings</Text>
                  </>
                )}
              </Pressable>
            </View>
          </>
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
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: spacing.base,
  },
  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sessionDate: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  sessionTime: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  section: {
    marginBottom: spacing.lg,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  sectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  toggleTextContainer: {
    flex: 1,
  },
  toggleLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  toggleDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary.main,
  },
  numberInput: {
    width: 60,
    height: 40,
    textAlign: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  inputSuffix: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    marginLeft: spacing.sm,
  },
  subjectOptions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  subjectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
  },
  subjectOptionSelected: {
    backgroundColor: colors.primary.subtle,
  },
  subjectOptionText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  subjectOptionTextSelected: {
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
  notesInput: {
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
  },
  errorBox: {
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
    padding: spacing.base,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

export default GroupSessionSettingsModal;
