/**
 * StudentRateSettingsModal
 * Lets a tutor set per-subject custom rates for a single student. A set rate
 * overrides the tutor-wide rate for that student (solo or combined). Clearing a
 * subject (toggle off / empty) falls back to the tutor-wide rate.
 *
 * Every subject the student can actually be billed for is offered: the subjects
 * on their profile, the subjects of their real lessons (which can differ), any
 * subject that already has a saved rate, and — behind "Show all subjects" —
 * every remaining subject the tutor teaches. Listing only profile subjects used
 * to leave students with no way to set a rate at all.
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Modal, Pressable, ScrollView, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius } from '../theme';
import { SubjectRates, StudentWithParent } from '../types/database';
import {
  SubjectRateFormState, emptyFormState, formStateFromConfig, buildSubjectRateConfig,
} from '../lib/subjectRateForm';
import { useTutorSettings, formatRateDisplay, getSubjectRateConfig } from '../hooks/useTutorSettings';
import { extractCustomSubjects } from '../hooks/useTutorProfile';
import { SubjectRateEditor } from './SubjectRateEditor';

// Display metadata + default base duration per subject (mirrors RateSettingsModal).
const SUBJECT_META: Record<string, { label: string; emoji: string; defaultDuration: number }> = {
  piano: { label: 'Piano', emoji: '🎹', defaultDuration: 30 },
  math: { label: 'Math', emoji: '➗', defaultDuration: 60 },
  reading: { label: 'Reading', emoji: '📖', defaultDuration: 60 },
  speech: { label: 'Speech', emoji: '🗣️', defaultDuration: 60 },
  english: { label: 'English', emoji: '📝', defaultDuration: 60 },
};

const DEFAULT_SUBJECT_KEYS = Object.keys(SUBJECT_META);

function metaFor(subject: string, customNames: Record<string, string> = {}) {
  const known = SUBJECT_META[subject];
  if (known) return known;
  return {
    label: customNames[subject] ?? subject.charAt(0).toUpperCase() + subject.slice(1),
    emoji: '📚',
    defaultDuration: 60,
  };
}

/** De-duplicated, order-preserving concat. */
function unique(...lists: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  lists.flat().forEach((value) => {
    if (value && !seen.has(value)) {
      seen.add(value);
      out.push(value);
    }
  });
  return out;
}

interface StudentRateSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  student: StudentWithParent;
  /** Subjects of this student's actual lessons — they can differ from the profile. */
  lessonSubjects?: string[];
  /** Persist the new rates; return true on success. */
  onSave: (subjectRates: SubjectRates) => Promise<boolean>;
  saving?: boolean;
}

export function StudentRateSettingsModal({
  visible, onClose, student, lessonSubjects = [], onSave, saving,
}: StudentRateSettingsModalProps) {
  const { data: settings } = useTutorSettings();
  const [forms, setForms] = useState<Record<string, SubjectRateFormState>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [showAllSubjects, setShowAllSubjects] = useState(false);

  const savedRates = (student.subject_rates as SubjectRates | undefined) || {};

  // Custom subjects live in tutor_settings.subject_rates under `custom_*` keys.
  const customSubjects = useMemo(
    () => extractCustomSubjects((settings?.subject_rates as Record<string, unknown>) || {}),
    [settings?.subject_rates],
  );
  const customNames = useMemo(() => {
    const names: Record<string, string> = {};
    customSubjects.forEach((s) => { names[s.id] = s.name; });
    return names;
  }, [customSubjects]);

  // Subjects tied to this student — always shown.
  const studentSubjects = useMemo(
    () => unique(student.subjects || [], lessonSubjects, Object.keys(savedRates)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [student.id, student.subjects, lessonSubjects, student.subject_rates],
  );

  // Everything else the tutor teaches — shown on demand so a rate is always reachable.
  const otherSubjects = useMemo(
    () => unique(DEFAULT_SUBJECT_KEYS, customSubjects.map((s) => s.id))
      .filter((subject) => !studentSubjects.includes(subject)),
    [customSubjects, studentSubjects],
  );

  const visibleSubjects = showAllSubjects
    ? unique(studentSubjects, otherSubjects)
    : studentSubjects;

  // Initialize form state from the student's saved rates whenever the modal opens.
  useEffect(() => {
    if (!visible) return;
    const saved = (student.subject_rates as SubjectRates | undefined) || {};
    const next: Record<string, SubjectRateFormState> = {};
    unique(studentSubjects, otherSubjects).forEach((subject) => {
      next[subject] = formStateFromConfig(
        saved[subject as keyof SubjectRates],
        metaFor(subject, customNames).defaultDuration,
      );
    });
    setForms(next);
    setHasChanges(false);
    // A student with nothing on their profile would otherwise see an empty sheet.
    setShowAllSubjects(studentSubjects.length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, student.id]);

  const update = (subject: string, patch: Partial<SubjectRateFormState>) => {
    setForms((prev) => ({
      ...prev,
      [subject]: {
        ...(prev[subject] ?? emptyFormState(metaFor(subject, customNames).defaultDuration)),
        ...patch,
      },
    }));
    setHasChanges(true);
  };

  const handleToggleEnabled = (subject: string) => {
    const current = forms[subject] ?? emptyFormState(metaFor(subject, customNames).defaultDuration);
    update(subject, { enabled: !current.enabled });
  };

  const handleSave = async () => {
    // Start from the saved rates so a subject that isn't rendered right now
    // (e.g. one added by another device) keeps its rate.
    const result: SubjectRates = { ...savedRates };
    for (const subject of unique(studentSubjects, otherSubjects)) {
      const cfg = buildSubjectRateConfig(forms[subject]);
      if (cfg) result[subject as keyof SubjectRates] = cfg;
      else delete result[subject as keyof SubjectRates];
    }
    const ok = await onSave(result);
    if (ok) {
      setHasChanges(false);
      onClose();
    } else {
      Alert.alert('Error', 'Failed to save custom rates. Please try again.');
    }
  };

  const handleClose = () => {
    if (hasChanges) {
      Alert.alert('Unsaved Changes', 'Discard your changes?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onClose },
      ]);
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable style={styles.closeButton} onPress={handleClose}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={styles.title}>Custom Rates</Text>
          <Pressable
            style={[styles.saveButton, !hasChanges && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <Text style={[styles.saveButtonText, !hasChanges && styles.saveButtonTextDisabled]}>Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Set a special rate for {student.name}. A custom rate overrides your
            usual rate — and your group rate — for this student, in solo and
            group sessions alike. Leave a subject off to use your normal rate.
          </Text>

          {visibleSubjects.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="pricetags-outline" size={32} color="#CCC" />
              <Text style={styles.emptyText}>No subjects to price yet</Text>
              <Text style={styles.emptySubtext}>Add a subject in Settings → Subjects &amp; Rates first.</Text>
            </View>
          ) : (
            visibleSubjects.map((subject) => {
              const meta = metaFor(subject, customNames);
              const formState = forms[subject] ?? emptyFormState(meta.defaultDuration);
              const tutorCfg = getSubjectRateConfig(settings, subject);
              const tutorRateLabel = formatRateDisplay(tutorCfg.rate, tutorCfg.base_duration);
              return (
                <View key={subject} style={styles.subjectBlock}>
                  <Pressable style={styles.enableToggle} onPress={() => handleToggleEnabled(subject)}>
                    <Ionicons
                      name={formState.enabled ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={formState.enabled ? colors.piano.primary : colors.neutral.textMuted}
                    />
                    <Text style={styles.enableToggleText}>
                      {meta.emoji} {meta.label} — use custom rate
                    </Text>
                  </Pressable>
                  <Text style={styles.defaultHint}>Your usual rate: {tutorRateLabel}</Text>

                  {formState.enabled && (
                    <SubjectRateEditor
                      label={meta.label}
                      emoji={meta.emoji}
                      formState={formState}
                      ratePlaceholder={String(tutorCfg.rate)}
                      onRateChange={(value) =>
                        update(subject, { rate: value, enabled: true })
                      }
                      onDurationChange={(duration) => update(subject, { duration })}
                      onToggleTiers={() => update(subject, { useTiers: !formState.useTiers })}
                      onTierPriceChange={(duration, value) =>
                        update(subject, {
                          tierPrices: { ...formState.tierPrices, [duration]: value },
                          enabled: true,
                        })
                      }
                    />
                  )}
                </View>
              );
            })
          )}

          {otherSubjects.length > 0 && (
            <Pressable
              style={styles.showAllToggle}
              onPress={() => setShowAllSubjects((prev) => !prev)}
            >
              <Ionicons
                name={showAllSubjects ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={colors.piano.primary}
              />
              <Text style={styles.showAllToggleText}>
                {showAllSubjects
                  ? 'Show only this student’s subjects'
                  : `Show all subjects (${otherSubjects.length} more)`}
              </Text>
            </Pressable>
          )}
          <View style={{ height: spacing['2xl'] }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.neutral.border, backgroundColor: colors.neutral.white,
  },
  closeButton: { padding: spacing.xs },
  title: { fontSize: typography.sizes.lg, fontWeight: typography.weights.semibold, color: colors.neutral.text },
  saveButton: {
    backgroundColor: colors.piano.primary, paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.md, minWidth: 70, alignItems: 'center',
  },
  saveButtonDisabled: { backgroundColor: colors.neutral.border },
  saveButtonText: { color: colors.neutral.white, fontWeight: typography.weights.semibold, fontSize: typography.sizes.base },
  saveButtonTextDisabled: { color: colors.neutral.textMuted },
  content: { flex: 1, padding: spacing.base },
  intro: { fontSize: typography.sizes.sm, color: colors.neutral.textSecondary, marginBottom: spacing.lg },
  subjectBlock: { marginBottom: spacing.lg },
  enableToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  enableToggleText: { fontSize: typography.sizes.base, fontWeight: typography.weights.medium, color: colors.neutral.text },
  defaultHint: { fontSize: typography.sizes.xs, color: colors.neutral.textMuted, marginLeft: 28, marginTop: 2, marginBottom: spacing.sm },
  showAllToggle: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.xs,
    alignSelf: 'flex-start', paddingVertical: spacing.sm,
  },
  showAllToggleText: { fontSize: typography.sizes.sm, fontWeight: typography.weights.medium, color: colors.piano.primary },
  emptyState: { backgroundColor: colors.neutral.surface, borderRadius: borderRadius.lg, padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: typography.sizes.sm, color: colors.neutral.textMuted, marginTop: spacing.sm },
  emptySubtext: { fontSize: typography.sizes.xs, color: colors.neutral.border, marginTop: spacing.xs, textAlign: 'center' },
});
