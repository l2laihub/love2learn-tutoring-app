/**
 * Tutor Availability Screen
 * Allows tutors to manage their available time slots for lesson scheduling
 * Parents can view these slots when requesting to reschedule lessons
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../src/contexts/AuthContext';
import {
  useTutorAvailability,
  useCreateAvailability,
  useUpdateAvailability,
  useDeleteAvailability,
  DAY_NAMES,
  formatTimeDisplay,
} from '../src/hooks/useTutorAvailability';
import { TutorAvailability, CreateTutorAvailabilityInput } from '../src/types/database';
import { colors, spacing, typography, borderRadius, shadows } from '../src/theme';

// Time slot options for picker
const TIME_OPTIONS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00',
];

interface AvailabilityFormData {
  day_of_week: number;
  start_time: string;
  end_time: string;
  notes: string;
}

export default function AvailabilityScreen() {
  const { parent, isTutor } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TutorAvailability | null>(null);

  // Fetch tutor's availability
  const {
    data: availability,
    loading,
    error,
    refetch,
  } = useTutorAvailability({ tutorId: parent?.id });

  const { createAvailability, loading: creating } = useCreateAvailability();
  const { updateAvailability, loading: updating } = useUpdateAvailability();
  const { deleteAvailability, loading: deleting } = useDeleteAvailability();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Group availability by day of week
  const groupedAvailability = useMemo(() => {
    const grouped = new Map<number, TutorAvailability[]>();
    for (let i = 0; i < 7; i++) {
      grouped.set(i, []);
    }

    availability
      .filter((slot) => slot.is_recurring && slot.day_of_week !== null)
      .forEach((slot) => {
        const daySlots = grouped.get(slot.day_of_week!) || [];
        daySlots.push(slot);
        // Sort by start time
        daySlots.sort((a, b) => a.start_time.localeCompare(b.start_time));
        grouped.set(slot.day_of_week!, daySlots);
      });

    return grouped;
  }, [availability]);

  const handleAddSlot = () => {
    setEditingSlot(null);
    setShowAddModal(true);
  };

  const handleEditSlot = (slot: TutorAvailability) => {
    setEditingSlot(slot);
    setShowAddModal(true);
  };

  const handleDeleteSlot = async (slot: TutorAvailability) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm('Delete this availability slot?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Delete Slot',
            'Are you sure you want to delete this availability slot?',
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Delete', onPress: () => resolve(true), style: 'destructive' },
            ]
          );
        });

    if (confirmDelete) {
      const success = await deleteAvailability(slot.id);
      if (success) {
        refetch();
      }
    }
  };

  const handleSaveSlot = async (data: AvailabilityFormData) => {
    if (!parent?.id) return;

    if (editingSlot) {
      // Update existing slot
      const result = await updateAvailability(editingSlot.id, {
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        end_time: data.end_time,
        notes: data.notes || null,
      });
      if (result) {
        setShowAddModal(false);
        refetch();
      }
    } else {
      // Create new slot
      const input: CreateTutorAvailabilityInput = {
        tutor_id: parent.id,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        end_time: data.end_time,
        is_recurring: true,
        notes: data.notes || null,
      };
      const result = await createAvailability(input);
      if (result) {
        setShowAddModal(false);
        refetch();
      }
    }
  };

  // Redirect if not a tutor
  if (!isTutor) {
    return (
      <SafeAreaView style={styles.container}>
        <Stack.Screen options={{ title: 'Not Authorized' }} />
        <View style={styles.emptyState}>
          <Ionicons name="lock-closed" size={64} color={colors.neutral.textMuted} />
          <Text style={styles.emptyStateTitle}>Tutor Access Only</Text>
          <Text style={styles.emptyStateText}>
            This page is only accessible to tutors.
          </Text>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <Stack.Screen
        options={{
          title: 'My Availability',
          headerStyle: { backgroundColor: colors.primary.main },
          headerTintColor: colors.neutral.textInverse,
          headerTitleStyle: { fontWeight: '600' },
          headerLeft: () => (
            <Pressable
              onPress={() => router.back()}
              style={{ padding: spacing.sm, marginLeft: -spacing.sm }}
            >
              <Ionicons name="arrow-back" size={24} color={colors.neutral.textInverse} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header Card */}
        <View style={styles.headerCard}>
          <View style={styles.headerIcon}>
            <Ionicons name="calendar" size={32} color={colors.primary.main} />
          </View>
          <Text style={styles.headerTitle}>Weekly Availability</Text>
          <Text style={styles.headerDescription}>
            Set your available time slots for each day of the week.
            Parents will see these when requesting to reschedule lessons.
          </Text>
        </View>

        {/* Loading State */}
        {loading && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
          </View>
        )}

        {/* Error State */}
        {error && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={24} color={colors.status.error} />
            <Text style={styles.errorText}>{error.message}</Text>
          </View>
        )}

        {/* Availability by Day */}
        {!loading && (
          <View style={styles.daysContainer}>
            {DAY_NAMES.map((dayName, dayIndex) => {
              const slots = groupedAvailability.get(dayIndex) || [];
              const hasSlots = slots.length > 0;

              return (
                <View key={dayIndex} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayName}>{dayName}</Text>
                    {hasSlots && (
                      <View style={styles.slotCount}>
                        <Text style={styles.slotCountText}>
                          {slots.length} slot{slots.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                    )}
                  </View>

                  {hasSlots ? (
                    <View style={styles.slotsContainer}>
                      {slots.map((slot) => (
                        <View key={slot.id} style={styles.slotItem}>
                          <View style={styles.slotTime}>
                            <Ionicons
                              name="time-outline"
                              size={16}
                              color={colors.primary.main}
                            />
                            <Text style={styles.slotTimeText}>
                              {formatTimeDisplay(slot.start_time)} -{' '}
                              {formatTimeDisplay(slot.end_time)}
                            </Text>
                          </View>
                          {slot.notes && (
                            <Text style={styles.slotNotes}>{slot.notes}</Text>
                          )}
                          <View style={styles.slotActions}>
                            <Pressable
                              style={styles.slotActionButton}
                              onPress={() => handleEditSlot(slot)}
                            >
                              <Ionicons
                                name="pencil"
                                size={16}
                                color={colors.primary.main}
                              />
                            </Pressable>
                            <Pressable
                              style={styles.slotActionButton}
                              onPress={() => handleDeleteSlot(slot)}
                            >
                              <Ionicons
                                name="trash-outline"
                                size={16}
                                color={colors.status.error}
                              />
                            </Pressable>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.noSlotsText}>No availability set</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Add Button */}
      <View style={styles.footer}>
        <Pressable style={styles.addButton} onPress={handleAddSlot}>
          <Ionicons name="add-circle" size={24} color={colors.neutral.white} />
          <Text style={styles.addButtonText}>Add Availability Slot</Text>
        </Pressable>
      </View>

      {/* Add/Edit Modal */}
      <AvailabilityFormModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleSaveSlot}
        initialData={editingSlot}
        loading={creating || updating}
      />
    </SafeAreaView>
  );
}

// Form Modal Component
interface AvailabilityFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: AvailabilityFormData) => Promise<void>;
  initialData: TutorAvailability | null;
  loading: boolean;
}

function AvailabilityFormModal({
  visible,
  onClose,
  onSubmit,
  initialData,
  loading,
}: AvailabilityFormModalProps) {
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible) {
      if (initialData) {
        setDayOfWeek(initialData.day_of_week ?? 1);
        setStartTime(initialData.start_time.slice(0, 5));
        setEndTime(initialData.end_time.slice(0, 5));
        setNotes(initialData.notes || '');
      } else {
        setDayOfWeek(1);
        setStartTime('09:00');
        setEndTime('17:00');
        setNotes('');
      }
      setError(null);
    }
  }, [visible, initialData]);

  const handleSubmit = async () => {
    // Validate
    if (startTime >= endTime) {
      setError('End time must be after start time');
      return;
    }

    setError(null);
    await onSubmit({
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      notes,
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={modalStyles.container}>
        {/* Header */}
        <View style={modalStyles.header}>
          <Pressable onPress={onClose} style={modalStyles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={modalStyles.title}>
            {initialData ? 'Edit Availability' : 'Add Availability'}
          </Text>
          <View style={modalStyles.headerSpacer} />
        </View>

        <ScrollView style={modalStyles.content}>
          {/* Day Selection */}
          <View style={modalStyles.section}>
            <Text style={modalStyles.sectionLabel}>Day of Week</Text>
            <View style={modalStyles.dayGrid}>
              {DAY_NAMES.map((day, index) => (
                <Pressable
                  key={index}
                  style={[
                    modalStyles.dayButton,
                    dayOfWeek === index && modalStyles.dayButtonSelected,
                  ]}
                  onPress={() => setDayOfWeek(index)}
                >
                  <Text
                    style={[
                      modalStyles.dayButtonText,
                      dayOfWeek === index && modalStyles.dayButtonTextSelected,
                    ]}
                  >
                    {day.slice(0, 3)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Time Selection */}
          <View style={modalStyles.section}>
            <Text style={modalStyles.sectionLabel}>Time Range</Text>
            <View style={modalStyles.timeRow}>
              {/* Start Time */}
              <View style={modalStyles.timeColumn}>
                <Text style={modalStyles.timeLabel}>Start</Text>
                <Pressable
                  style={modalStyles.timeButton}
                  onPress={() => setShowStartPicker(!showStartPicker)}
                >
                  <Ionicons name="time-outline" size={20} color={colors.primary.main} />
                  <Text style={modalStyles.timeButtonText}>
                    {formatTimeDisplay(startTime)}
                  </Text>
                  <Ionicons
                    name={showStartPicker ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.neutral.textMuted}
                  />
                </Pressable>
                {showStartPicker && (
                  <ScrollView style={modalStyles.timePicker} nestedScrollEnabled>
                    {TIME_OPTIONS.map((time) => (
                      <Pressable
                        key={time}
                        style={[
                          modalStyles.timeOption,
                          startTime === time && modalStyles.timeOptionSelected,
                        ]}
                        onPress={() => {
                          setStartTime(time);
                          setShowStartPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            modalStyles.timeOptionText,
                            startTime === time && modalStyles.timeOptionTextSelected,
                          ]}
                        >
                          {formatTimeDisplay(time)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>

              <Text style={modalStyles.timeSeparator}>to</Text>

              {/* End Time */}
              <View style={modalStyles.timeColumn}>
                <Text style={modalStyles.timeLabel}>End</Text>
                <Pressable
                  style={modalStyles.timeButton}
                  onPress={() => setShowEndPicker(!showEndPicker)}
                >
                  <Ionicons name="time-outline" size={20} color={colors.primary.main} />
                  <Text style={modalStyles.timeButtonText}>
                    {formatTimeDisplay(endTime)}
                  </Text>
                  <Ionicons
                    name={showEndPicker ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.neutral.textMuted}
                  />
                </Pressable>
                {showEndPicker && (
                  <ScrollView style={modalStyles.timePicker} nestedScrollEnabled>
                    {TIME_OPTIONS.map((time) => (
                      <Pressable
                        key={time}
                        style={[
                          modalStyles.timeOption,
                          endTime === time && modalStyles.timeOptionSelected,
                        ]}
                        onPress={() => {
                          setEndTime(time);
                          setShowEndPicker(false);
                        }}
                      >
                        <Text
                          style={[
                            modalStyles.timeOptionText,
                            endTime === time && modalStyles.timeOptionTextSelected,
                          ]}
                        >
                          {formatTimeDisplay(time)}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          </View>

          {/* Notes */}
          <View style={modalStyles.section}>
            <Text style={modalStyles.sectionLabel}>Notes (optional)</Text>
            <TextInput
              style={modalStyles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="E.g., Preferred for piano lessons"
              placeholderTextColor={colors.neutral.textMuted}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Error */}
          {error && (
            <View style={modalStyles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.status.error} />
              <Text style={modalStyles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={modalStyles.footer}>
          <Pressable
            style={[modalStyles.submitButton, loading && modalStyles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <>
                <Ionicons
                  name={initialData ? 'checkmark-circle' : 'add-circle'}
                  size={20}
                  color={colors.neutral.white}
                />
                <Text style={modalStyles.submitButtonText}>
                  {initialData ? 'Save Changes' : 'Add Slot'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
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
    padding: spacing.base,
    paddingBottom: spacing.xxl,
  },
  headerCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  headerDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    padding: spacing.xxl,
    alignItems: 'center',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.status.errorBg,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.status.error,
  },
  daysContainer: {
    gap: spacing.md,
  },
  dayCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dayName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  slotCount: {
    backgroundColor: colors.primary.subtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  slotCountText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
  slotsContainer: {
    gap: spacing.sm,
  },
  slotItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
  },
  slotTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
  },
  slotTimeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  slotNotes: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginRight: spacing.sm,
    flex: 1,
  },
  slotActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  slotActionButton: {
    padding: spacing.xs,
  },
  noSlotsText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
  },
  footer: {
    padding: spacing.base,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  addButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
  },
  emptyStateTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyStateText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  backButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
  },
  backButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

const modalStyles = StyleSheet.create({
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
  content: {
    flex: 1,
    padding: spacing.base,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  dayGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dayButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    minWidth: 60,
    alignItems: 'center',
  },
  dayButtonSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  dayButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  dayButtonTextSelected: {
    color: colors.neutral.white,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  timeColumn: {
    flex: 1,
  },
  timeLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginBottom: spacing.xs,
  },
  timeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  timeButtonText: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  timeSeparator: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    marginTop: spacing.xl,
  },
  timePicker: {
    maxHeight: 200,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    marginTop: spacing.xs,
  },
  timeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderLight,
  },
  timeOptionSelected: {
    backgroundColor: colors.primary.subtle,
  },
  timeOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.text,
  },
  timeOptionTextSelected: {
    color: colors.primary.main,
    fontWeight: typography.weights.semibold,
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
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.status.errorBg,
    borderRadius: borderRadius.md,
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

export { AvailabilityFormModal };
