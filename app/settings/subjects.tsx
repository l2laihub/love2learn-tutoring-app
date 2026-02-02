/**
 * Subjects & Rates Settings Screen
 * Manage subjects, custom subjects, and pricing
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';
import {
  useTutorSettings,
  useUpdateTutorSettings,
  formatRateDisplay,
} from '../../src/hooks/useTutorSettings';
import {
  DEFAULT_SUBJECTS,
  SUBJECT_COLOR_PALETTE,
  useCustomSubjects,
  extractCustomSubjects,
  CustomSubject,
} from '../../src/hooks/useTutorProfile';
import { useResponsive } from '../../src/hooks/useResponsive';
import { SubjectRates, SubjectRateConfig, TutoringSubject } from '../../src/types/database';

// Custom subject modal
interface SubjectModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: { name: string; color: string; rate: number; baseDuration: number }) => Promise<boolean>;
  editingSubject?: CustomSubject | null;
  loading: boolean;
}

function SubjectModal({ visible, onClose, onSave, editingSubject, loading }: SubjectModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>(SUBJECT_COLOR_PALETTE[0]);
  const [rate, setRate] = useState('45');
  const [baseDuration, setBaseDuration] = useState(60);

  useEffect(() => {
    if (editingSubject) {
      setName(editingSubject.name);
      setColor(editingSubject.color);
      setRate(editingSubject.rate?.toString() || '45');
      setBaseDuration(editingSubject.baseDuration || 60);
    } else {
      setName('');
      setColor(SUBJECT_COLOR_PALETTE[0]);
      setRate('45');
      setBaseDuration(60);
    }
  }, [editingSubject, visible]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Subject name is required');
      return;
    }

    const parsedRate = parseFloat(rate);
    if (isNaN(parsedRate) || parsedRate <= 0) {
      Alert.alert('Error', 'Please enter a valid rate');
      return;
    }

    const success = await onSave({
      name: name.trim(),
      color,
      rate: parsedRate,
      baseDuration,
    });

    if (success) {
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={modalStyles.container}>
        <View style={modalStyles.header}>
          <Pressable style={modalStyles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={modalStyles.title}>
            {editingSubject ? 'Edit Subject' : 'Add Custom Subject'}
          </Text>
          <View style={modalStyles.placeholder} />
        </View>

        <KeyboardAvoidingView
          style={modalStyles.content}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Subject Name */}
            <View style={modalStyles.inputGroup}>
              <Text style={modalStyles.label}>Subject Name</Text>
              <TextInput
                style={modalStyles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g., Art, Science, Writing"
                placeholderTextColor={colors.neutral.textMuted}
              />
            </View>

            {/* Color Picker */}
            <View style={modalStyles.inputGroup}>
              <Text style={modalStyles.label}>Subject Color</Text>
              <View style={modalStyles.colorGrid}>
                {SUBJECT_COLOR_PALETTE.map((c) => (
                  <Pressable
                    key={c}
                    style={[
                      modalStyles.colorOption,
                      { backgroundColor: c },
                      color === c && modalStyles.colorOptionSelected,
                    ]}
                    onPress={() => setColor(c)}
                  >
                    {color === c && (
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    )}
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Rate */}
            <View style={modalStyles.inputGroup}>
              <Text style={modalStyles.label}>Hourly Rate</Text>
              <View style={modalStyles.rateRow}>
                <View style={modalStyles.rateInputContainer}>
                  <Text style={modalStyles.currencySymbol}>$</Text>
                  <TextInput
                    style={modalStyles.rateInput}
                    value={rate}
                    onChangeText={setRate}
                    keyboardType="decimal-pad"
                    placeholder="45"
                    placeholderTextColor={colors.neutral.textMuted}
                  />
                </View>
                <Text style={modalStyles.perText}>per</Text>
                <View style={modalStyles.durationPicker}>
                  <Pressable
                    style={[
                      modalStyles.durationOption,
                      baseDuration === 30 && modalStyles.durationOptionSelected,
                    ]}
                    onPress={() => setBaseDuration(30)}
                  >
                    <Text
                      style={[
                        modalStyles.durationOptionText,
                        baseDuration === 30 && modalStyles.durationOptionTextSelected,
                      ]}
                    >
                      30min
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[
                      modalStyles.durationOption,
                      baseDuration === 60 && modalStyles.durationOptionSelected,
                    ]}
                    onPress={() => setBaseDuration(60)}
                  >
                    <Text
                      style={[
                        modalStyles.durationOptionText,
                        baseDuration === 60 && modalStyles.durationOptionTextSelected,
                      ]}
                    >
                      60min
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>

            {/* Preview */}
            <View style={modalStyles.previewSection}>
              <Text style={modalStyles.previewLabel}>Preview</Text>
              <View style={modalStyles.previewCard}>
                <View style={[modalStyles.previewColorBar, { backgroundColor: color }]} />
                <View style={modalStyles.previewContent}>
                  <Text style={modalStyles.previewName}>{name || 'Subject Name'}</Text>
                  <Text style={modalStyles.previewRate}>
                    {formatRateDisplay(parseFloat(rate) || 45, baseDuration)}
                  </Text>
                </View>
              </View>
            </View>
          </ScrollView>

          {/* Save Button */}
          <Pressable
            style={[modalStyles.saveButton, loading && modalStyles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <Text style={modalStyles.saveButtonText}>
                {editingSubject ? 'Save Changes' : 'Add Subject'}
              </Text>
            )}
          </Pressable>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export default function SubjectsSettingsScreen() {
  const { data: settings, loading, error, refetch } = useTutorSettings();
  const updateSettings = useUpdateTutorSettings();
  const customSubjects = useCustomSubjects();
  const { isDesktop } = useResponsive();

  // Form state
  const [defaultRate, setDefaultRate] = useState('45');
  const [defaultDuration, setDefaultDuration] = useState(60);
  const [combinedRate, setCombinedRate] = useState('40');
  const [subjectRates, setSubjectRates] = useState<SubjectRates>({});
  const [customSubjectsList, setCustomSubjectsList] = useState<CustomSubject[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Modal state
  const [showSubjectModal, setShowSubjectModal] = useState(false);
  const [editingSubject, setEditingSubject] = useState<CustomSubject | null>(null);

  // Initialize form from settings
  useEffect(() => {
    if (settings) {
      setDefaultRate(settings.default_rate.toString());
      setDefaultDuration(settings.default_base_duration);
      setCombinedRate(settings.combined_session_rate.toString());
      setSubjectRates(settings.subject_rates || {});
      setCustomSubjectsList(
        extractCustomSubjects(settings.subject_rates as Record<string, unknown> || {})
      );
      setHasChanges(false);
    }
  }, [settings]);

  // Handle subject rate toggle
  const handleSubjectToggle = (subject: TutoringSubject, enabled: boolean) => {
    if (enabled) {
      // Enable with default rate
      const subjectInfo = DEFAULT_SUBJECTS.find(s => s.key === subject);
      setSubjectRates(prev => ({
        ...prev,
        [subject]: {
          rate: parseFloat(defaultRate) || 45,
          base_duration: subjectInfo?.defaultDuration || 60,
        },
      }));
    } else {
      // Remove from rates
      setSubjectRates(prev => {
        const newRates = { ...prev };
        delete newRates[subject];
        return newRates;
      });
    }
    setHasChanges(true);
  };

  // Handle subject rate change
  const handleSubjectRateChange = (subject: TutoringSubject, rate: string) => {
    const parsedRate = parseFloat(rate);
    if (!isNaN(parsedRate)) {
      setSubjectRates(prev => ({
        ...prev,
        [subject]: {
          ...prev[subject],
          rate: parsedRate,
        } as SubjectRateConfig,
      }));
      setHasChanges(true);
    }
  };

  // Handle add custom subject
  const handleAddCustomSubject = () => {
    setEditingSubject(null);
    setShowSubjectModal(true);
  };

  // Handle edit custom subject
  const handleEditCustomSubject = (subject: CustomSubject) => {
    setEditingSubject(subject);
    setShowSubjectModal(true);
  };

  // Handle delete custom subject
  const handleDeleteCustomSubject = (subject: CustomSubject) => {
    Alert.alert(
      'Delete Subject',
      `Are you sure you want to delete "${subject.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await customSubjects.deleteCustomSubject(subject.id);
            if (success) {
              await refetch();
            }
          },
        },
      ]
    );
  };

  // Handle save custom subject
  const handleSaveCustomSubject = async (data: {
    name: string;
    color: string;
    rate: number;
    baseDuration: number;
  }): Promise<boolean> => {
    let success: boolean;

    if (editingSubject) {
      success = await customSubjects.updateCustomSubject(editingSubject.id, {
        name: data.name,
        color: data.color,
        rate: data.rate,
        baseDuration: data.baseDuration,
      });
    } else {
      success = await customSubjects.createCustomSubject({
        name: data.name,
        color: data.color,
        rate: data.rate,
        baseDuration: data.baseDuration,
      });
    }

    if (success) {
      await refetch();
    }

    return success;
  };

  // Handle save all settings
  const handleSave = async () => {
    const parsedDefault = parseFloat(defaultRate);
    const parsedCombined = parseFloat(combinedRate);

    if (isNaN(parsedDefault) || parsedDefault <= 0) {
      Alert.alert('Error', 'Please enter a valid default rate');
      return;
    }

    if (isNaN(parsedCombined) || parsedCombined <= 0) {
      Alert.alert('Error', 'Please enter a valid combined session rate');
      return;
    }

    setSaving(true);

    try {
      const result = await updateSettings.mutate({
        default_rate: parsedDefault,
        default_base_duration: defaultDuration,
        combined_session_rate: parsedCombined,
        subject_rates: subjectRates,
      });

      if (result) {
        setHasChanges(false);
        await refetch();
        Alert.alert('Success', 'Rate settings saved successfully');
      } else {
        Alert.alert('Error', updateSettings.error?.message || 'Failed to save settings');
      }
    } catch (err) {
      Alert.alert('Error', 'An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary.main} />
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.status.error} />
          <Text style={styles.errorTitle}>Failed to Load Settings</Text>
          <Text style={styles.errorText}>{error?.message}</Text>
          <Pressable style={styles.retryButton} onPress={refetch}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          isDesktop && styles.scrollContentDesktop,
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Default Rates Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Rates</Text>
          <Text style={styles.sectionDescription}>
            These rates apply when no subject-specific rate is set.
          </Text>

          <View style={styles.rateCard}>
            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>Default Hourly Rate</Text>
              <View style={styles.rateInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.rateInput}
                  value={defaultRate}
                  onChangeText={(value) => {
                    setDefaultRate(value);
                    setHasChanges(true);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="45"
                  placeholderTextColor={colors.neutral.textMuted}
                />
                <Text style={styles.rateUnit}>/hr</Text>
              </View>
            </View>

            <View style={styles.rateDivider} />

            <View style={styles.rateRow}>
              <Text style={styles.rateLabel}>Combined Session Rate</Text>
              <View style={styles.rateInputContainer}>
                <Text style={styles.currencySymbol}>$</Text>
                <TextInput
                  style={styles.rateInput}
                  value={combinedRate}
                  onChangeText={(value) => {
                    setCombinedRate(value);
                    setHasChanges(true);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="40"
                  placeholderTextColor={colors.neutral.textMuted}
                />
                <Text style={styles.rateUnit}>/student</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Default Subjects Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Default Subjects</Text>
          <Text style={styles.sectionDescription}>
            Enable subjects and set custom rates for each.
          </Text>

          <View style={styles.subjectsCard}>
            {DEFAULT_SUBJECTS.map((subject, index) => {
              const isEnabled = !!subjectRates[subject.key];
              const rateConfig = subjectRates[subject.key];

              return (
                <View key={subject.key}>
                  <View style={styles.subjectRow}>
                    <View style={styles.subjectInfo}>
                      <View style={[styles.subjectColorDot, { backgroundColor: subject.color }]} />
                      <Text style={styles.subjectEmoji}>{subject.emoji}</Text>
                      <Text style={styles.subjectName}>{subject.label}</Text>
                    </View>

                    <View style={styles.subjectActions}>
                      {isEnabled && (
                        <View style={styles.subjectRateInput}>
                          <Text style={styles.smallCurrency}>$</Text>
                          <TextInput
                            style={styles.smallInput}
                            value={rateConfig?.rate?.toString() || ''}
                            onChangeText={(value) => handleSubjectRateChange(subject.key, value)}
                            keyboardType="decimal-pad"
                            placeholder="--"
                            placeholderTextColor={colors.neutral.textMuted}
                          />
                        </View>
                      )}
                      <Switch
                        value={isEnabled}
                        onValueChange={(value) => handleSubjectToggle(subject.key, value)}
                        trackColor={{
                          false: colors.neutral.border,
                          true: colors.primary.light,
                        }}
                        thumbColor={isEnabled ? colors.primary.main : colors.neutral.white}
                      />
                    </View>
                  </View>
                  {index < DEFAULT_SUBJECTS.length - 1 && <View style={styles.subjectDivider} />}
                </View>
              );
            })}
          </View>
        </View>

        {/* Custom Subjects Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Custom Subjects</Text>
              <Text style={styles.sectionDescription}>
                Add your own subjects with custom colors and rates.
              </Text>
            </View>
          </View>

          {customSubjectsList.length > 0 ? (
            <View style={styles.subjectsCard}>
              {customSubjectsList.map((subject, index) => (
                <View key={subject.id}>
                  <View style={styles.subjectRow}>
                    <View style={styles.subjectInfo}>
                      <View style={[styles.subjectColorDot, { backgroundColor: subject.color }]} />
                      <View style={styles.customSubjectInfo}>
                        <Text style={styles.subjectName}>{subject.name}</Text>
                        <Text style={styles.customSubjectRate}>
                          {formatRateDisplay(subject.rate || 45, subject.baseDuration || 60)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.customSubjectActions}>
                      <Pressable
                        style={styles.iconButton}
                        onPress={() => handleEditCustomSubject(subject)}
                      >
                        <Ionicons name="create-outline" size={20} color={colors.primary.main} />
                      </Pressable>
                      <Pressable
                        style={styles.iconButton}
                        onPress={() => handleDeleteCustomSubject(subject)}
                      >
                        <Ionicons name="trash-outline" size={20} color={colors.status.error} />
                      </Pressable>
                    </View>
                  </View>
                  {index < customSubjectsList.length - 1 && <View style={styles.subjectDivider} />}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCustomSubjects}>
              <Ionicons name="school-outline" size={40} color={colors.neutral.textMuted} />
              <Text style={styles.emptyText}>No custom subjects yet</Text>
            </View>
          )}

          <Pressable style={styles.addButton} onPress={handleAddCustomSubject}>
            <Ionicons name="add-circle" size={24} color={colors.primary.main} />
            <Text style={styles.addButtonText}>Add Custom Subject</Text>
          </Pressable>
        </View>

        {/* Save Button */}
        {hasChanges && (
          <Pressable
            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </Pressable>
        )}
      </ScrollView>

      {/* Custom Subject Modal */}
      <SubjectModal
        visible={showSubjectModal}
        onClose={() => setShowSubjectModal(false)}
        onSave={handleSaveCustomSubject}
        editingSubject={editingSubject}
        loading={customSubjects.loading}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  scrollContentDesktop: {
    maxWidth: 600,
    alignSelf: 'center',
    width: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  errorTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary.main,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  retryButtonText: {
    color: colors.neutral.white,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  sectionTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  sectionDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.md,
  },
  rateCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rateLabel: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    flex: 1,
  },
  rateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.sm,
  },
  currencySymbol: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  rateInput: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    minWidth: 50,
    textAlign: 'center',
  },
  rateUnit: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginLeft: spacing.xs,
  },
  rateDivider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginVertical: spacing.sm,
  },
  subjectsCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
    overflow: 'hidden',
  },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
  },
  subjectInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  subjectColorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  subjectEmoji: {
    fontSize: typography.sizes.lg,
    marginRight: spacing.sm,
  },
  subjectName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  subjectActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  subjectRateInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  smallCurrency: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  smallInput: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    minWidth: 40,
    textAlign: 'center',
    paddingVertical: spacing.xs,
  },
  subjectDivider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginHorizontal: spacing.md,
  },
  customSubjectInfo: {
    flex: 1,
  },
  customSubjectRate: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  customSubjectActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  iconButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.background,
  },
  emptyCustomSubjects: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    gap: spacing.sm,
    borderWidth: 1.5,
    borderColor: colors.primary.main,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
  saveButton: {
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    marginTop: spacing.md,
  },
  saveButtonDisabled: {
    backgroundColor: colors.neutral.border,
  },
  saveButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

// Modal styles
const modalStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
    backgroundColor: colors.neutral.white,
  },
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  inputGroup: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  input: {
    backgroundColor: colors.neutral.white,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: colors.neutral.white,
    ...shadows.md,
  },
  rateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  rateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
    flex: 1,
  },
  currencySymbol: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginRight: spacing.xs,
  },
  rateInput: {
    flex: 1,
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    paddingVertical: spacing.md,
  },
  perText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
  durationPicker: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  durationOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.white,
  },
  durationOptionSelected: {
    borderColor: colors.primary.main,
    backgroundColor: colors.primary.subtle,
  },
  durationOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  durationOptionTextSelected: {
    color: colors.primary.main,
  },
  previewSection: {
    marginTop: spacing.md,
  },
  previewLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewCard: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  previewColorBar: {
    width: 6,
  },
  previewContent: {
    flex: 1,
    padding: spacing.md,
  },
  previewName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  previewRate: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  saveButton: {
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
  },
  saveButtonDisabled: {
    backgroundColor: colors.neutral.border,
  },
  saveButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});
