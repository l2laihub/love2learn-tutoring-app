/**
 * Tutor Availability Screen
 * Allows tutors to manage their available time slots and breaks for lesson scheduling
 * Parents can view available slots (breaks shown as unavailable) when requesting to reschedule
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
import {
  useTutorBreaks,
  useCreateBreak,
  useUpdateBreak,
  useDeleteBreak,
  isBreakWithinAvailability,
} from '../src/hooks/useTutorBreaks';
import {
  TutorAvailability,
  TutorBreak,
  CreateTutorAvailabilityInput,
  CreateTutorBreakInput,
} from '../src/types/database';
import { colors, spacing, typography, borderRadius, shadows } from '../src/theme';

// Time slot options for picker (30-minute intervals for availability)
const TIME_OPTIONS = [
  '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
  '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00',
];

// More granular time options for breaks (15-minute intervals)
const BREAK_TIME_OPTIONS = [
  '08:00', '08:15', '08:30', '08:45',
  '09:00', '09:15', '09:30', '09:45',
  '10:00', '10:15', '10:30', '10:45',
  '11:00', '11:15', '11:30', '11:45',
  '12:00', '12:15', '12:30', '12:45',
  '13:00', '13:15', '13:30', '13:45',
  '14:00', '14:15', '14:30', '14:45',
  '15:00', '15:15', '15:30', '15:45',
  '16:00', '16:15', '16:30', '16:45',
  '17:00', '17:15', '17:30', '17:45',
  '18:00', '18:15', '18:30', '18:45',
  '19:00', '19:15', '19:30', '19:45',
  '20:00', '20:15', '20:30', '20:45',
  '21:00',
];

interface AvailabilityFormData {
  day_of_week: number;
  start_time: string;
  end_time: string;
  notes: string;
}

interface BreakFormData {
  day_of_week: number;
  start_time: string;
  end_time: string;
  notes: string;
}

// Slot type for unified display
type SlotType = 'availability' | 'break';

interface DisplaySlot {
  id: string;
  type: SlotType;
  start_time: string;
  end_time: string;
  notes: string | null;
  day_of_week: number;
}

export default function AvailabilityScreen() {
  const { parent, isTutor } = useAuthContext();
  const [refreshing, setRefreshing] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBreakModal, setShowBreakModal] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TutorAvailability | null>(null);
  const [editingBreak, setEditingBreak] = useState<TutorBreak | null>(null);

  // Fetch tutor's availability
  const {
    data: availability,
    loading,
    error,
    refetch,
  } = useTutorAvailability({ tutorId: parent?.id });

  // Fetch tutor's breaks
  const {
    data: breaks,
    loading: breaksLoading,
    error: breaksError,
    refetch: refetchBreaks,
  } = useTutorBreaks({ tutorId: parent?.id });

  const { createAvailability, loading: creating } = useCreateAvailability();
  const { updateAvailability, loading: updating } = useUpdateAvailability();
  const { deleteAvailability, loading: deleting } = useDeleteAvailability();

  const { createBreak, loading: creatingBreak } = useCreateBreak();
  const { updateBreak, loading: updatingBreak } = useUpdateBreak();
  const { deleteBreak, loading: deletingBreak } = useDeleteBreak();

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetch(), refetchBreaks()]);
    setRefreshing(false);
  }, [refetch, refetchBreaks]);

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

  // Group breaks by day of week
  const groupedBreaks = useMemo(() => {
    const grouped = new Map<number, TutorBreak[]>();
    for (let i = 0; i < 7; i++) {
      grouped.set(i, []);
    }

    breaks
      .filter((slot) => slot.is_recurring && slot.day_of_week !== null)
      .forEach((slot) => {
        const daySlots = grouped.get(slot.day_of_week!) || [];
        daySlots.push(slot);
        // Sort by start time
        daySlots.sort((a, b) => a.start_time.localeCompare(b.start_time));
        grouped.set(slot.day_of_week!, daySlots);
      });

    return grouped;
  }, [breaks]);

  // Combined display slots per day (availability + breaks, sorted by time)
  const groupedDisplaySlots = useMemo(() => {
    const grouped = new Map<number, DisplaySlot[]>();
    for (let i = 0; i < 7; i++) {
      const availSlots = groupedAvailability.get(i) || [];
      const breakSlots = groupedBreaks.get(i) || [];

      const displaySlots: DisplaySlot[] = [
        ...availSlots.map((s) => ({
          id: s.id,
          type: 'availability' as SlotType,
          start_time: s.start_time,
          end_time: s.end_time,
          notes: s.notes,
          day_of_week: s.day_of_week!,
        })),
        ...breakSlots.map((s) => ({
          id: s.id,
          type: 'break' as SlotType,
          start_time: s.start_time,
          end_time: s.end_time,
          notes: s.notes,
          day_of_week: s.day_of_week!,
        })),
      ];

      // Sort by start time
      displaySlots.sort((a, b) => a.start_time.localeCompare(b.start_time));
      grouped.set(i, displaySlots);
    }
    return grouped;
  }, [groupedAvailability, groupedBreaks]);

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

  // Break handlers
  const handleAddBreak = () => {
    setEditingBreak(null);
    setShowBreakModal(true);
  };

  const handleEditBreak = (breakSlot: TutorBreak) => {
    setEditingBreak(breakSlot);
    setShowBreakModal(true);
  };

  const handleDeleteBreak = async (breakSlot: TutorBreak) => {
    const confirmDelete = Platform.OS === 'web'
      ? window.confirm('Delete this break?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Delete Break',
            'Are you sure you want to delete this break?',
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Delete', onPress: () => resolve(true), style: 'destructive' },
            ]
          );
        });

    if (confirmDelete) {
      const success = await deleteBreak(breakSlot.id);
      if (success) {
        refetchBreaks();
      }
    }
  };

  const handleSaveBreak = async (data: BreakFormData) => {
    if (!parent?.id) return;

    // Validate break is within availability
    const dayAvailability = groupedAvailability.get(data.day_of_week) || [];
    if (!isBreakWithinAvailability(data.start_time, data.end_time, dayAvailability)) {
      Alert.alert(
        'Invalid Break Time',
        'Break must be within your availability window for this day. Please set availability first.'
      );
      return;
    }

    if (editingBreak) {
      // Update existing break
      const result = await updateBreak(editingBreak.id, {
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        end_time: data.end_time,
        notes: data.notes || null,
      });
      if (result) {
        setShowBreakModal(false);
        refetchBreaks();
      }
    } else {
      // Create new break
      const input: CreateTutorBreakInput = {
        tutor_id: parent.id,
        day_of_week: data.day_of_week,
        start_time: data.start_time,
        end_time: data.end_time,
        is_recurring: true,
        notes: data.notes || null,
      };
      const result = await createBreak(input);
      if (result) {
        setShowBreakModal(false);
        refetchBreaks();
      }
    }
  };

  // Handle edit/delete for display slots
  const handleEditDisplaySlot = (slot: DisplaySlot) => {
    if (slot.type === 'availability') {
      const avail = availability.find((a) => a.id === slot.id);
      if (avail) handleEditSlot(avail);
    } else {
      const breakSlot = breaks.find((b) => b.id === slot.id);
      if (breakSlot) handleEditBreak(breakSlot);
    }
  };

  const handleDeleteDisplaySlot = async (slot: DisplaySlot) => {
    if (slot.type === 'availability') {
      const avail = availability.find((a) => a.id === slot.id);
      if (avail) await handleDeleteSlot(avail);
    } else {
      const breakSlot = breaks.find((b) => b.id === slot.id);
      if (breakSlot) await handleDeleteBreak(breakSlot);
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
            Set your available time slots and breaks for each day.
            Parents will see availability (breaks shown as unavailable).
          </Text>
        </View>

        {/* Legend */}
        <View style={styles.legendContainer}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary.main }]} />
            <Text style={styles.legendText}>Available</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.status.warning }]} />
            <Text style={styles.legendText}>Break</Text>
          </View>
        </View>

        {/* Loading State */}
        {(loading || breaksLoading) && !refreshing && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary.main} />
          </View>
        )}

        {/* Error State */}
        {(error || breaksError) && (
          <View style={styles.errorCard}>
            <Ionicons name="alert-circle" size={24} color={colors.status.error} />
            <Text style={styles.errorText}>{error?.message || breaksError?.message}</Text>
          </View>
        )}

        {/* Availability and Breaks by Day */}
        {!loading && !breaksLoading && (
          <View style={styles.daysContainer}>
            {DAY_NAMES.map((dayName, dayIndex) => {
              const displaySlots = groupedDisplaySlots.get(dayIndex) || [];
              const availSlots = groupedAvailability.get(dayIndex) || [];
              const breakSlots = groupedBreaks.get(dayIndex) || [];
              const hasSlots = displaySlots.length > 0;

              return (
                <View key={dayIndex} style={styles.dayCard}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayName}>{dayName}</Text>
                    <View style={styles.slotCountRow}>
                      {availSlots.length > 0 && (
                        <View style={styles.slotCount}>
                          <Text style={styles.slotCountText}>
                            {availSlots.length} avail
                          </Text>
                        </View>
                      )}
                      {breakSlots.length > 0 && (
                        <View style={[styles.slotCount, styles.breakCount]}>
                          <Text style={[styles.slotCountText, styles.breakCountText]}>
                            {breakSlots.length} break{breakSlots.length !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {hasSlots ? (
                    <View style={styles.slotsContainer}>
                      {displaySlots.map((slot) => {
                        const isBreak = slot.type === 'break';
                        return (
                          <View
                            key={slot.id}
                            style={[
                              styles.slotItem,
                              isBreak && styles.breakSlotItem,
                            ]}
                          >
                            <View style={styles.slotTime}>
                              <Ionicons
                                name={isBreak ? 'cafe-outline' : 'time-outline'}
                                size={16}
                                color={isBreak ? colors.status.warning : colors.primary.main}
                              />
                              <Text
                                style={[
                                  styles.slotTimeText,
                                  isBreak && styles.breakTimeText,
                                ]}
                              >
                                {formatTimeDisplay(slot.start_time)} -{' '}
                                {formatTimeDisplay(slot.end_time)}
                              </Text>
                              {isBreak && (
                                <View style={styles.breakBadge}>
                                  <Text style={styles.breakBadgeText}>Break</Text>
                                </View>
                              )}
                            </View>
                            {slot.notes && (
                              <Text style={styles.slotNotes}>{slot.notes}</Text>
                            )}
                            <View style={styles.slotActions}>
                              <Pressable
                                style={styles.slotActionButton}
                                onPress={() => handleEditDisplaySlot(slot)}
                              >
                                <Ionicons
                                  name="pencil"
                                  size={16}
                                  color={isBreak ? colors.status.warning : colors.primary.main}
                                />
                              </Pressable>
                              <Pressable
                                style={styles.slotActionButton}
                                onPress={() => handleDeleteDisplaySlot(slot)}
                              >
                                <Ionicons
                                  name="trash-outline"
                                  size={16}
                                  color={colors.status.error}
                                />
                              </Pressable>
                            </View>
                          </View>
                        );
                      })}
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

      {/* Footer with two buttons */}
      <View style={styles.footer}>
        <View style={styles.footerButtons}>
          <Pressable style={styles.addButton} onPress={handleAddSlot}>
            <Ionicons name="add-circle" size={20} color={colors.neutral.white} />
            <Text style={styles.addButtonText}>Add Availability</Text>
          </Pressable>
          <Pressable style={[styles.addButton, styles.addBreakButton]} onPress={handleAddBreak}>
            <Ionicons name="cafe" size={20} color={colors.neutral.white} />
            <Text style={styles.addButtonText}>Add Break</Text>
          </Pressable>
        </View>
      </View>

      {/* Add/Edit Availability Modal */}
      <AvailabilityFormModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleSaveSlot}
        initialData={editingSlot}
        loading={creating || updating}
      />

      {/* Add/Edit Break Modal */}
      <BreakFormModal
        visible={showBreakModal}
        onClose={() => setShowBreakModal(false)}
        onSubmit={handleSaveBreak}
        initialData={editingBreak}
        loading={creatingBreak || updatingBreak}
        availabilitySlots={groupedAvailability}
        existingBreaks={groupedBreaks}
        onDeleteBreak={handleDeleteBreak}
        onEditBreak={handleEditBreak}
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
    paddingBottom: spacing['2xl'],
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
    padding: spacing['2xl'],
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
  legendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  slotCountRow: {
    flexDirection: 'row',
    gap: spacing.xs,
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
  breakCount: {
    backgroundColor: '#FEF3C7', // warning subtle
  },
  breakCountText: {
    color: colors.status.warning,
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
  breakSlotItem: {
    backgroundColor: '#FEF3C7', // warning subtle
    borderLeftWidth: 3,
    borderLeftColor: colors.status.warning,
  },
  slotTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    flexWrap: 'wrap',
  },
  slotTimeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  breakTimeText: {
    color: '#92400E', // darker warning
  },
  breakBadge: {
    backgroundColor: colors.status.warning,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
  },
  breakBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
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
  footerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  addButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  addBreakButton: {
    backgroundColor: colors.status.warning,
  },
  addButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
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

// Break Form Modal Component
interface BreakFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: BreakFormData) => Promise<void>;
  initialData: TutorBreak | null;
  loading: boolean;
  availabilitySlots: Map<number, TutorAvailability[]>;
  existingBreaks: Map<number, TutorBreak[]>;
  onDeleteBreak: (breakSlot: TutorBreak) => Promise<void>;
  onEditBreak: (breakSlot: TutorBreak) => void;
}

/**
 * Parse time input string and return formatted HH:MM or null if invalid
 * Supports formats: "9:30", "09:30", "9:30 AM", "9:30am", "930", etc.
 */
function parseTimeInput(input: string): string | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;

  // Try to match various time formats
  // Format: HH:MM (24-hour)
  let match = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  // Format: HH:MM AM/PM
  match = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/);
  if (match) {
    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const period = match[3];
    if (hours >= 1 && hours <= 12 && minutes >= 0 && minutes <= 59) {
      if (period === 'pm' && hours !== 12) hours += 12;
      if (period === 'am' && hours === 12) hours = 0;
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  // Format: HHMM (no colon)
  match = trimmed.match(/^(\d{1,2})(\d{2})$/);
  if (match) {
    const hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
  }

  return null;
}

function BreakFormModal({
  visible,
  onClose,
  onSubmit,
  initialData,
  loading,
  availabilitySlots,
  existingBreaks,
  onDeleteBreak,
  onEditBreak,
}: BreakFormModalProps) {
  const [dayOfWeek, setDayOfWeek] = useState(1); // Monday
  const [startTimeInput, setStartTimeInput] = useState('12:00 PM');
  const [endTimeInput, setEndTimeInput] = useState('1:00 PM');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [startTimeError, setStartTimeError] = useState<string | null>(null);
  const [endTimeError, setEndTimeError] = useState<string | null>(null);

  // Get availability for selected day
  const dayAvailability = availabilitySlots.get(dayOfWeek) || [];
  const hasAvailability = dayAvailability.length > 0;

  // Get existing breaks for selected day
  const dayBreaks = existingBreaks.get(dayOfWeek) || [];

  // Helper to get default break times within availability window
  const getDefaultBreakTimes = (availSlots: TutorAvailability[]): { start: string; end: string } => {
    if (availSlots.length === 0) {
      return { start: '12:00 PM', end: '1:00 PM' };
    }
    // Use the first availability slot to set default break in the middle
    const firstSlot = availSlots[0];
    const startParts = firstSlot.start_time.split(':').map(Number);
    const endParts = firstSlot.end_time.split(':').map(Number);

    const startMinutes = startParts[0] * 60 + startParts[1];
    const endMinutes = endParts[0] * 60 + endParts[1];
    const midPoint = Math.floor((startMinutes + endMinutes) / 2);

    // Default to 1 hour break in the middle
    const breakStart = midPoint - 30;
    const breakEnd = midPoint + 30;

    const formatMin = (mins: number) => {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 || 12;
      return `${displayH}:${m.toString().padStart(2, '0')} ${period}`;
    };

    return { start: formatMin(breakStart), end: formatMin(breakEnd) };
  };

  // Handle day change - reset times to be within new day's availability
  const handleDayChange = (newDay: number) => {
    const newDayAvail = availabilitySlots.get(newDay) || [];
    if (newDayAvail.length > 0) {
      const { start, end } = getDefaultBreakTimes(newDayAvail);
      setStartTimeInput(start);
      setEndTimeInput(end);
    }
    setDayOfWeek(newDay);
    setError(null);
    setStartTimeError(null);
    setEndTimeError(null);
  };

  // Helper to format 24h time to display format
  const formatToDisplayTime = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  // Reset form when modal opens
  React.useEffect(() => {
    if (visible) {
      if (initialData) {
        setDayOfWeek(initialData.day_of_week ?? 1);
        setStartTimeInput(formatToDisplayTime(initialData.start_time.slice(0, 5)));
        setEndTimeInput(formatToDisplayTime(initialData.end_time.slice(0, 5)));
        setNotes(initialData.notes || '');
      } else {
        // Find first day with availability
        let firstAvailableDay = 1;
        let firstDayAvailSlots: TutorAvailability[] = [];
        for (let i = 0; i < 7; i++) {
          const slots = availabilitySlots.get(i) || [];
          if (slots.length > 0) {
            firstAvailableDay = i;
            firstDayAvailSlots = slots;
            break;
          }
        }
        setDayOfWeek(firstAvailableDay);
        // Set default times within availability window
        const { start, end } = getDefaultBreakTimes(firstDayAvailSlots);
        setStartTimeInput(start);
        setEndTimeInput(end);
        setNotes('');
      }
      setError(null);
      setStartTimeError(null);
      setEndTimeError(null);
    }
  }, [visible, initialData, availabilitySlots]);

  // Validate and handle start time change
  const handleStartTimeBlur = () => {
    const parsed = parseTimeInput(startTimeInput);
    if (parsed) {
      setStartTimeInput(formatToDisplayTime(parsed));
      setStartTimeError(null);
    } else if (startTimeInput.trim()) {
      setStartTimeError('Invalid format. Use HH:MM or HH:MM AM/PM');
    }
  };

  // Validate and handle end time change
  const handleEndTimeBlur = () => {
    const parsed = parseTimeInput(endTimeInput);
    if (parsed) {
      setEndTimeInput(formatToDisplayTime(parsed));
      setEndTimeError(null);
    } else if (endTimeInput.trim()) {
      setEndTimeError('Invalid format. Use HH:MM or HH:MM AM/PM');
    }
  };

  const handleSubmit = async () => {
    // Parse times
    const startTime = parseTimeInput(startTimeInput);
    const endTime = parseTimeInput(endTimeInput);

    // Validate times are valid
    if (!startTime) {
      setStartTimeError('Please enter a valid start time');
      return;
    }
    if (!endTime) {
      setEndTimeError('Please enter a valid end time');
      return;
    }

    // Validate time range
    if (startTime >= endTime) {
      setError('End time must be after start time');
      return;
    }

    // Validate break is within availability
    if (!isBreakWithinAvailability(startTime, endTime, dayAvailability)) {
      setError('Break must be within your availability window for this day');
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
      <View style={breakModalStyles.container}>
        {/* Header */}
        <View style={breakModalStyles.header}>
          <Pressable onPress={onClose} style={breakModalStyles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </Pressable>
          <Text style={breakModalStyles.title}>
            {initialData ? 'Edit Break' : 'Add Break'}
          </Text>
          <View style={breakModalStyles.headerSpacer} />
        </View>

        <ScrollView style={breakModalStyles.content}>
          {/* Info Banner */}
          <View style={breakModalStyles.infoBanner}>
            <Ionicons name="information-circle" size={20} color={colors.status.warning} />
            <Text style={breakModalStyles.infoText}>
              Breaks must be within your availability hours. Parents will see these times as unavailable.
            </Text>
          </View>

          {/* Day Selection */}
          <View style={breakModalStyles.section}>
            <Text style={breakModalStyles.sectionLabel}>Day of Week</Text>
            <View style={breakModalStyles.dayGrid}>
              {DAY_NAMES.map((day, index) => {
                const dayHasAvail = (availabilitySlots.get(index) || []).length > 0;
                const dayBreakCount = (existingBreaks.get(index) || []).length;
                return (
                  <Pressable
                    key={index}
                    style={[
                      breakModalStyles.dayButton,
                      dayOfWeek === index && breakModalStyles.dayButtonSelected,
                      !dayHasAvail && breakModalStyles.dayButtonDisabled,
                    ]}
                    onPress={() => dayHasAvail && handleDayChange(index)}
                  >
                    <Text
                      style={[
                        breakModalStyles.dayButtonText,
                        dayOfWeek === index && breakModalStyles.dayButtonTextSelected,
                        !dayHasAvail && breakModalStyles.dayButtonTextDisabled,
                      ]}
                    >
                      {day.slice(0, 3)}
                    </Text>
                    {dayBreakCount > 0 && (
                      <View style={[
                        breakModalStyles.dayBreakBadge,
                        dayOfWeek === index && breakModalStyles.dayBreakBadgeSelected,
                      ]}>
                        <Text style={[
                          breakModalStyles.dayBreakBadgeText,
                          dayOfWeek === index && breakModalStyles.dayBreakBadgeTextSelected,
                        ]}>
                          {dayBreakCount}
                        </Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
            {!hasAvailability && (
              <Text style={breakModalStyles.warningText}>
                No availability set for this day. Add availability first.
              </Text>
            )}
            {hasAvailability && (
              <Text style={breakModalStyles.availabilityHint}>
                Available: {dayAvailability.map((a) =>
                  `${formatTimeDisplay(a.start_time)} - ${formatTimeDisplay(a.end_time)}`
                ).join(', ')}
              </Text>
            )}
          </View>

          {/* Existing Breaks for Selected Day */}
          {dayBreaks.length > 0 && !initialData && (
            <View style={breakModalStyles.section}>
              <Text style={breakModalStyles.sectionLabel}>
                Existing Breaks for {DAY_NAMES[dayOfWeek]}
              </Text>
              <View style={breakModalStyles.existingBreaksList}>
                {dayBreaks.map((breakSlot) => (
                  <View key={breakSlot.id} style={breakModalStyles.existingBreakItem}>
                    <View style={breakModalStyles.existingBreakInfo}>
                      <Ionicons name="cafe" size={16} color={colors.status.warning} />
                      <Text style={breakModalStyles.existingBreakTime}>
                        {formatTimeDisplay(breakSlot.start_time)} - {formatTimeDisplay(breakSlot.end_time)}
                      </Text>
                      {breakSlot.notes && (
                        <Text style={breakModalStyles.existingBreakNotes}>
                          ({breakSlot.notes})
                        </Text>
                      )}
                    </View>
                    <View style={breakModalStyles.existingBreakActions}>
                      <Pressable
                        style={breakModalStyles.existingBreakActionBtn}
                        onPress={() => {
                          onEditBreak(breakSlot);
                        }}
                      >
                        <Ionicons name="pencil" size={16} color={colors.status.warning} />
                      </Pressable>
                      <Pressable
                        style={breakModalStyles.existingBreakActionBtn}
                        onPress={() => onDeleteBreak(breakSlot)}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.status.error} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Time Selection */}
          <View style={breakModalStyles.section}>
            <Text style={breakModalStyles.sectionLabel}>Break Time</Text>
            <Text style={breakModalStyles.timeHint}>
              Enter any time (e.g., 12:15 PM, 9:30am, 14:45)
            </Text>
            <View style={breakModalStyles.timeRow}>
              {/* Start Time */}
              <View style={breakModalStyles.timeColumn}>
                <Text style={breakModalStyles.timeLabel}>Start</Text>
                <View style={[
                  breakModalStyles.timeInputContainer,
                  startTimeError && breakModalStyles.timeInputError,
                ]}>
                  <Ionicons name="cafe-outline" size={20} color={colors.status.warning} />
                  <TextInput
                    style={breakModalStyles.timeInput}
                    value={startTimeInput}
                    onChangeText={setStartTimeInput}
                    onBlur={handleStartTimeBlur}
                    placeholder="12:00 PM"
                    placeholderTextColor={colors.neutral.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
                {startTimeError && (
                  <Text style={breakModalStyles.timeErrorText}>{startTimeError}</Text>
                )}
              </View>

              <Text style={breakModalStyles.timeSeparator}>to</Text>

              {/* End Time */}
              <View style={breakModalStyles.timeColumn}>
                <Text style={breakModalStyles.timeLabel}>End</Text>
                <View style={[
                  breakModalStyles.timeInputContainer,
                  endTimeError && breakModalStyles.timeInputError,
                ]}>
                  <Ionicons name="cafe-outline" size={20} color={colors.status.warning} />
                  <TextInput
                    style={breakModalStyles.timeInput}
                    value={endTimeInput}
                    onChangeText={setEndTimeInput}
                    onBlur={handleEndTimeBlur}
                    placeholder="1:00 PM"
                    placeholderTextColor={colors.neutral.textMuted}
                    autoCapitalize="characters"
                  />
                </View>
                {endTimeError && (
                  <Text style={breakModalStyles.timeErrorText}>{endTimeError}</Text>
                )}
              </View>
            </View>
          </View>

          {/* Notes */}
          <View style={breakModalStyles.section}>
            <Text style={breakModalStyles.sectionLabel}>Notes (optional)</Text>
            <TextInput
              style={breakModalStyles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="E.g., Lunch break, Personal time"
              placeholderTextColor={colors.neutral.textMuted}
              multiline
              numberOfLines={2}
            />
          </View>

          {/* Error */}
          {error && (
            <View style={breakModalStyles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.status.error} />
              <Text style={breakModalStyles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Footer */}
        <View style={breakModalStyles.footer}>
          <Pressable
            style={[
              breakModalStyles.submitButton,
              (loading || !hasAvailability) && breakModalStyles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={loading || !hasAvailability}
          >
            {loading ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <>
                <Ionicons
                  name={initialData ? 'checkmark-circle' : 'cafe'}
                  size={20}
                  color={colors.neutral.white}
                />
                <Text style={breakModalStyles.submitButtonText}>
                  {initialData ? 'Save Changes' : 'Add Break'}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const breakModalStyles = StyleSheet.create({
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
    backgroundColor: '#FEF3C7', // warning subtle
    borderBottomWidth: 1,
    borderBottomColor: colors.status.warning,
  },
  closeButton: {
    padding: spacing.xs,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: '#92400E', // darker warning
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: spacing.base,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: '#FEF3C7',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.lg,
  },
  infoText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: '#92400E',
    lineHeight: 20,
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
    backgroundColor: colors.status.warning,
    borderColor: colors.status.warning,
  },
  dayButtonDisabled: {
    backgroundColor: colors.neutral.background,
    borderColor: colors.neutral.borderLight,
    opacity: 0.5,
  },
  dayButtonText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  dayButtonTextSelected: {
    color: colors.neutral.white,
  },
  dayButtonTextDisabled: {
    color: colors.neutral.textMuted,
  },
  dayBreakBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.status.warning,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  dayBreakBadgeSelected: {
    backgroundColor: colors.neutral.white,
  },
  dayBreakBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  dayBreakBadgeTextSelected: {
    color: colors.status.warning,
  },
  existingBreaksList: {
    gap: spacing.sm,
  },
  existingBreakItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FEF3C7',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: colors.status.warning,
  },
  existingBreakInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flex: 1,
    flexWrap: 'wrap',
  },
  existingBreakTime: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: '#92400E',
  },
  existingBreakNotes: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  existingBreakActions: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  existingBreakActionBtn: {
    padding: spacing.xs,
  },
  warningText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  availabilityHint: {
    fontSize: typography.sizes.xs,
    color: colors.primary.main,
    marginTop: spacing.sm,
  },
  timeHint: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginBottom: spacing.md,
    fontStyle: 'italic',
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
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.status.warning,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  timeInputError: {
    borderColor: colors.status.error,
  },
  timeInput: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    paddingVertical: spacing.xs,
  },
  timeErrorText: {
    fontSize: typography.sizes.xs,
    color: colors.status.error,
    marginTop: spacing.xs,
  },
  timeSeparator: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    marginTop: spacing.xl,
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
    backgroundColor: colors.status.warning,
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

export { AvailabilityFormModal, BreakFormModal };
