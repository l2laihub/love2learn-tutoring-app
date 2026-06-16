/**
 * StudentRateSettingsModal
 * Lets a tutor set per-subject custom rates for a single student. Only the
 * student's enrolled subjects are shown. A set rate overrides the tutor-wide
 * rate for that student (solo or combined). Clearing a subject (toggle off /
 * empty) falls back to the tutor-wide rate.
 */
import React, { useState, useEffect } from 'react';
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
import { SubjectRateEditor } from './SubjectRateEditor';

// Display metadata + default base duration per subject (mirrors RateSettingsModal).
const SUBJECT_META: Record<string, { label: string; emoji: string; defaultDuration: number }> = {
  piano: { label: 'Piano', emoji: '🎹', defaultDuration: 30 },
  math: { label: 'Math', emoji: '➗', defaultDuration: 60 },
  reading: { label: 'Reading', emoji: '📖', defaultDuration: 60 },
  speech: { label: 'Speech', emoji: '🗣️', defaultDuration: 60 },
  english: { label: 'English', emoji: '📝', defaultDuration: 60 },
};

function metaFor(subject: string) {
  return SUBJECT_META[subject] ?? {
    label: subject.charAt(0).toUpperCase() + subject.slice(1),
    emoji: '📚',
    defaultDuration: 60,
  };
}

interface StudentRateSettingsModalProps {
  visible: boolean;
  onClose: () => void;
  student: StudentWithParent;
  /** Persist the new rates; return true on success. */
  onSave: (subjectRates: SubjectRates) => Promise<boolean>;
  saving?: boolean;
}

export function StudentRateSettingsModal({
  visible, onClose, student, onSave, saving,
}: StudentRateSettingsModalProps) {
  const { data: settings } = useTutorSettings();
  const enrolledSubjects = student.subjects || [];
  const [forms, setForms] = useState<Record<string, SubjectRateFormState>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize form state from the student's saved rates whenever the modal opens.
  useEffect(() => {
    if (!visible) return;
    const saved = (student.subject_rates as SubjectRates | undefined) || {};
    const next: Record<string, SubjectRateFormState> = {};
    enrolledSubjects.forEach((subject) => {
      next[subject] = formStateFromConfig(
        saved[subject as keyof SubjectRates],
        metaFor(subject).defaultDuration,
      );
    });
    setForms(next);
    setHasChanges(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, student.id]);

  const update = (subject: string, patch: Partial<SubjectRateFormState>) => {
    setForms((prev) => ({
      ...prev,
      [subject]: { ...(prev[subject] ?? emptyFormState(metaFor(subject).defaultDuration)), ...patch },
    }));
    setHasChanges(true);
  };

  const handleToggleEnabled = (subject: string) => {
    const current = forms[subject] ?? emptyFormState(metaFor(subject).defaultDuration);
    update(subject, { enabled: !current.enabled });
  };

  const handleSave = async () => {
    const result: SubjectRates = {};
    for (const subject of enrolledSubjects) {
      const cfg = buildSubjectRateConfig(forms[subject]);
      if (cfg) result[subject as keyof SubjectRates] = cfg;
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
            Set a special rate for {student.name}. A custom rate overrides the
            usual rate for this student. Leave a subject off to use your normal rate.
          </Text>

          {enrolledSubjects.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="pricetags-outline" size={32} color="#CCC" />
              <Text style={styles.emptyText}>No subjects enrolled</Text>
              <Text style={styles.emptySubtext}>Add a subject to this student to set custom rates.</Text>
            </View>
          ) : (
            enrolledSubjects.map((subject) => {
              const meta = metaFor(subject);
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
  emptyState: { backgroundColor: colors.neutral.surface, borderRadius: borderRadius.lg, padding: spacing.xl, alignItems: 'center' },
  emptyText: { fontSize: typography.sizes.sm, color: colors.neutral.textMuted, marginTop: spacing.sm },
  emptySubtext: { fontSize: typography.sizes.xs, color: colors.neutral.border, marginTop: spacing.xs, textAlign: 'center' },
});
