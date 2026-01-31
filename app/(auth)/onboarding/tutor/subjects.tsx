/**
 * Subject Configuration Screen
 * Love2Learn Tutoring App
 *
 * Second step of tutor onboarding - configure subjects and rates
 */

import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../../src/lib/supabase';
import { useAuthContext } from '../../../../src/contexts/AuthContext';
import { Button } from '../../../../src/components/ui/Button';
import { colors, typography, spacing, borderRadius, shadows, getSubjectColor } from '../../../../src/theme';
import type { TutoringSubject, SubjectRates, SubjectRateConfig, Json } from '../../../../src/types/database';

// Default subjects with their colors
const DEFAULT_SUBJECTS: Array<{
  id: TutoringSubject;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
}> = [
  { id: 'piano', name: 'Piano', icon: 'musical-notes', color: colors.piano.primary },
  { id: 'math', name: 'Math', icon: 'calculator', color: colors.math.primary },
  { id: 'reading', name: 'Reading', icon: 'book', color: colors.subjects.reading.primary },
  { id: 'speech', name: 'Speech', icon: 'mic', color: colors.subjects.speech.primary },
  { id: 'english', name: 'English', icon: 'document-text', color: colors.subjects.english.primary },
];

// Common color options for custom subjects
const COLOR_OPTIONS = [
  '#3D9CA8', // Teal
  '#7CB342', // Green
  '#9C27B0', // Purple
  '#FF9800', // Orange
  '#2196F3', // Blue
  '#E91E63', // Pink
  '#00BCD4', // Cyan
  '#795548', // Brown
  '#607D8B', // Blue Gray
  '#FF5722', // Deep Orange
];

interface SubjectConfig {
  id: string;
  name: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  enabled: boolean;
  rate: number;
  baseDuration: number;
}

export default function SubjectsScreen() {
  const { parent } = useAuthContext();

  // Initialize subjects with defaults
  const [subjects, setSubjects] = useState<SubjectConfig[]>(
    DEFAULT_SUBJECTS.map(s => ({
      ...s,
      enabled: false,
      rate: 35,
      baseDuration: 30,
    }))
  );
  const [combinedRate, setCombinedRate] = useState('25');
  const [showAddSubject, setShowAddSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newSubjectColor, setNewSubjectColor] = useState(COLOR_OPTIONS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enabledSubjects = subjects.filter(s => s.enabled);

  const toggleSubject = (id: string) => {
    setSubjects(prev =>
      prev.map(s => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const updateSubjectRate = (id: string, rate: string) => {
    const numRate = parseFloat(rate) || 0;
    setSubjects(prev =>
      prev.map(s => (s.id === id ? { ...s, rate: numRate } : s))
    );
  };

  const addCustomSubject = () => {
    if (!newSubjectName.trim()) {
      Alert.alert('Error', 'Please enter a subject name');
      return;
    }

    const id = newSubjectName.toLowerCase().replace(/\s+/g, '_');

    // Check for duplicates
    if (subjects.some(s => s.id === id)) {
      Alert.alert('Error', 'This subject already exists');
      return;
    }

    setSubjects(prev => [
      ...prev,
      {
        id,
        name: newSubjectName.trim(),
        icon: 'school',
        color: newSubjectColor,
        enabled: true,
        rate: 35,
        baseDuration: 30,
      },
    ]);

    setNewSubjectName('');
    setNewSubjectColor(COLOR_OPTIONS[0]);
    setShowAddSubject(false);
  };

  const removeCustomSubject = (id: string) => {
    // Don't allow removing default subjects
    if (DEFAULT_SUBJECTS.some(s => s.id === id)) {
      return;
    }

    Alert.alert(
      'Remove Subject',
      'Are you sure you want to remove this subject?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setSubjects(prev => prev.filter(s => s.id !== id));
          },
        },
      ]
    );
  };

  const handleContinue = async () => {
    setError(null);

    if (enabledSubjects.length === 0) {
      setError('Please select at least one subject');
      return;
    }

    // Validate rates
    const invalidRates = enabledSubjects.filter(s => s.rate <= 0);
    if (invalidRates.length > 0) {
      setError('Please set a valid rate for all enabled subjects');
      return;
    }

    setIsLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Authentication error. Please try again.');
        return;
      }

      // Build subject rates object
      const subjectRates: SubjectRates = {};
      enabledSubjects.forEach(s => {
        const config: SubjectRateConfig = {
          rate: s.rate,
          base_duration: s.baseDuration,
        };
        (subjectRates as Record<string, SubjectRateConfig>)[s.id] = config;
      });

      // Check if tutor_settings exists
      const { data: existingSettings } = await supabase
        .from('tutor_settings')
        .select('id')
        .eq('tutor_id', user.id)
        .single();

      if (existingSettings) {
        // Update existing settings
        const { error: updateError } = await supabase
          .from('tutor_settings')
          .update({
            subject_rates: subjectRates as unknown as Json,
            combined_session_rate: parseFloat(combinedRate) || 25,
            default_rate: enabledSubjects[0]?.rate || 35,
            default_base_duration: 30,
            updated_at: new Date().toISOString(),
          })
          .eq('tutor_id', user.id);

        if (updateError) {
          console.error('Error updating tutor settings:', updateError);
          setError('Failed to save subject configuration. Please try again.');
          return;
        }
      } else {
        // Create new settings
        const { error: insertError } = await supabase
          .from('tutor_settings')
          .insert({
            tutor_id: user.id,
            subject_rates: subjectRates as unknown as Json,
            combined_session_rate: parseFloat(combinedRate) || 25,
            default_rate: enabledSubjects[0]?.rate || 35,
            default_base_duration: 30,
            reminder_settings: {
              enabled: true,
              due_day_of_month: 7,
              friendly_reminder_days_before: 3,
              past_due_intervals: [3, 7, 14],
              send_email: true,
              send_notification: true,
            } as unknown as Json,
          });

        if (insertError) {
          console.error('Error creating tutor settings:', insertError);
          setError('Failed to save subject configuration. Please try again.');
          return;
        }
      }

      // Navigate to next step
      router.push('/(auth)/onboarding/tutor/subscription');
    } catch (err) {
      console.error('Error saving subjects:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: '50%' }]} />
          </View>
          <Text style={styles.progressText}>Step 2 of 4</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleBack}>
            <Ionicons name="arrow-back" size={24} color={colors.neutral.text} />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <View style={styles.headerIcon}>
              <Ionicons name="school" size={32} color={colors.primary.main} />
            </View>
            <Text style={styles.title}>Configure Subjects</Text>
            <Text style={styles.subtitle}>
              Select the subjects you teach and set your rates
            </Text>
          </View>
        </View>

        {/* Subject Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subjects</Text>
          <Text style={styles.sectionDescription}>
            Tap to enable subjects you offer. Long-press custom subjects to remove.
          </Text>

          <View style={styles.subjectsGrid}>
            {subjects.map((subject) => (
              <TouchableOpacity
                key={subject.id}
                style={[
                  styles.subjectChip,
                  subject.enabled && { backgroundColor: subject.color + '20' },
                ]}
                onPress={() => toggleSubject(subject.id)}
                onLongPress={() => removeCustomSubject(subject.id)}
              >
                <View style={[
                  styles.subjectIcon,
                  { backgroundColor: subject.enabled ? subject.color : colors.neutral.border }
                ]}>
                  <Ionicons
                    name={subject.icon}
                    size={20}
                    color={subject.enabled ? colors.neutral.white : colors.neutral.textMuted}
                  />
                </View>
                <Text style={[
                  styles.subjectName,
                  subject.enabled && { color: subject.color }
                ]}>
                  {subject.name}
                </Text>
                {subject.enabled && (
                  <Ionicons name="checkmark-circle" size={20} color={subject.color} />
                )}
              </TouchableOpacity>
            ))}

            {/* Add Custom Subject Button */}
            <TouchableOpacity
              style={styles.addSubjectButton}
              onPress={() => setShowAddSubject(true)}
            >
              <View style={styles.addSubjectIcon}>
                <Ionicons name="add" size={24} color={colors.primary.main} />
              </View>
              <Text style={styles.addSubjectText}>Add Subject</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Rate Configuration */}
        {enabledSubjects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Hourly Rates</Text>
            <Text style={styles.sectionDescription}>
              Set your rate for a 30-minute lesson in each subject
            </Text>

            <View style={styles.ratesContainer}>
              {enabledSubjects.map((subject) => (
                <View key={subject.id} style={styles.rateRow}>
                  <View style={styles.rateSubject}>
                    <View style={[styles.rateDot, { backgroundColor: subject.color }]} />
                    <Text style={styles.rateLabel}>{subject.name}</Text>
                  </View>
                  <View style={styles.rateInput}>
                    <Text style={styles.rateCurrency}>$</Text>
                    <TextInput
                      style={styles.rateTextInput}
                      value={subject.rate.toString()}
                      onChangeText={(text) => updateSubjectRate(subject.id, text)}
                      keyboardType="numeric"
                      placeholder="35"
                      placeholderTextColor={colors.neutral.textMuted}
                    />
                    <Text style={styles.rateUnit}>/30 min</Text>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Combined Session Rate */}
        {enabledSubjects.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Combined Session Rate</Text>
            <Text style={styles.sectionDescription}>
              Rate per student when teaching siblings together
            </Text>

            <View style={styles.combinedRateContainer}>
              <Text style={styles.rateCurrency}>$</Text>
              <TextInput
                style={styles.combinedRateInput}
                value={combinedRate}
                onChangeText={setCombinedRate}
                keyboardType="numeric"
                placeholder="25"
                placeholderTextColor={colors.neutral.textMuted}
              />
              <Text style={styles.rateUnit}>/student</Text>
            </View>
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color={colors.status.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Spacer */}
        <View style={styles.spacer} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <Button
          title={isLoading ? 'Saving...' : 'Continue'}
          onPress={handleContinue}
          disabled={isLoading || enabledSubjects.length === 0}
          loading={isLoading}
          icon="arrow-forward"
          iconPosition="right"
          style={styles.continueButton}
        />
      </View>

      {/* Add Subject Modal */}
      <Modal
        visible={showAddSubject}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddSubject(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Custom Subject</Text>
              <TouchableOpacity onPress={() => setShowAddSubject(false)}>
                <Ionicons name="close" size={24} color={colors.neutral.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Subject Name</Text>
              <TextInput
                style={styles.modalInput}
                value={newSubjectName}
                onChangeText={setNewSubjectName}
                placeholder="e.g., Science, Art, French"
                placeholderTextColor={colors.neutral.textMuted}
                autoCapitalize="words"
              />

              <Text style={[styles.inputLabel, { marginTop: spacing.lg }]}>
                Subject Color
              </Text>
              <View style={styles.colorGrid}>
                {COLOR_OPTIONS.map((color) => (
                  <TouchableOpacity
                    key={color}
                    style={[
                      styles.colorOption,
                      { backgroundColor: color },
                      newSubjectColor === color && styles.colorOptionSelected,
                    ]}
                    onPress={() => setNewSubjectColor(color)}
                  >
                    {newSubjectColor === color && (
                      <Ionicons name="checkmark" size={20} color={colors.neutral.white} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.modalFooter}>
              <Button
                title="Cancel"
                onPress={() => setShowAddSubject(false)}
                variant="outline"
                style={{ flex: 1, marginRight: spacing.sm }}
              />
              <Button
                title="Add Subject"
                onPress={addCustomSubject}
                style={{ flex: 1, marginLeft: spacing.sm }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  progressContainer: {
    marginBottom: spacing.xl,
  },
  progressBar: {
    height: 4,
    backgroundColor: colors.neutral.borderLight,
    borderRadius: borderRadius.full,
    marginBottom: spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.full,
  },
  progressText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    textAlign: 'center',
  },
  header: {
    marginBottom: spacing.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
    marginBottom: spacing.sm,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.base,
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.neutral.borderLight,
  },
  subjectIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subjectName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  addSubjectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.subtle,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.primary.light,
    borderStyle: 'dashed',
  },
  addSubjectIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.main + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSubjectText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
  ratesContainer: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderLight,
  },
  rateSubject: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  rateDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  rateLabel: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  rateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  rateCurrency: {
    fontSize: typography.sizes.md,
    color: colors.neutral.textSecondary,
    marginRight: spacing.xs,
  },
  rateTextInput: {
    width: 60,
    height: 44,
    fontSize: typography.sizes.md,
    color: colors.neutral.text,
    textAlign: 'center',
  },
  rateUnit: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginLeft: spacing.xs,
  },
  combinedRateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.base,
    alignSelf: 'flex-start',
  },
  combinedRateInput: {
    width: 80,
    height: 44,
    fontSize: typography.sizes.lg,
    color: colors.neutral.text,
    textAlign: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginHorizontal: spacing.sm,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.errorBg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.base,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    marginLeft: spacing.sm,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  continueButton: {
    width: '100%',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingBottom: Platform.OS === 'ios' ? spacing['2xl'] : spacing.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderLight,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  modalBody: {
    padding: spacing.lg,
  },
  inputLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  modalInput: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    borderWidth: 1,
    borderColor: colors.neutral.borderLight,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: colors.neutral.white,
    ...shadows.md,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.borderLight,
  },
});
