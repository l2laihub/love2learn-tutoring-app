/**
 * DropinRequestModal
 * Modal for parents to request a new drop-in session
 * Shows tutor availability and allows selecting preferred time slot
 * Similar to RescheduleRequestModal but for requesting new sessions
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
  TutorAvailability,
  TutoringSubject,
} from '../types/database';
import {
  useTutorAvailability,
  useBusySlotsForDate,
  DAY_NAMES,
  formatTimeDisplay,
} from '../hooks/useTutorAvailability';
import { useCreateLessonRequest } from '../hooks/useLessonRequests';
import { useTutor } from '../hooks/useParents';
import { useTutorSettings } from '../hooks/useTutorSettings';

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

// Default session durations
const DURATION_OPTIONS = [30, 45, 60, 90];

interface StudentSelection {
  student: Student;
  subject: TutoringSubject | null;
}

interface DropinRequestModalProps {
  visible: boolean;
  parentId: string;
  students: Student[];
  onClose: () => void;
  onSuccess: () => void;
}

// Generate next 14 days for date selection
function getNextTwoWeeks(): Date[] {
  const dates: Date[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 1; i <= 14; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + i);
    dates.push(date);
  }

  return dates;
}

export function DropinRequestModal({
  visible,
  parentId,
  students,
  onClose,
  onSuccess,
}: DropinRequestModalProps) {
  // Get the tutor for availability lookup
  const { data: tutor, loading: tutorLoading } = useTutor();
  const { data: tutorSettings } = useTutorSettings(tutor?.id);

  // Step flow: student -> date -> time -> confirm
  const [step, setStep] = useState<'student' | 'date' | 'time' | 'confirm'>('student');

  // Student/subject selection state
  const [selectedStudents, setSelectedStudents] = useState<StudentSelection[]>([]);
  const [duration, setDuration] = useState<number>(60);

  // Date/time selection state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<TutorAvailability | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Fetch tutor availability
  const {
    data: availability,
    loading: availabilityLoading,
  } = useTutorAvailability({ tutorId: tutor?.id, isRecurring: true });

  const { createRequest, loading: submitting } = useCreateLessonRequest();

  // Generate date options
  const dateOptions = useMemo(() => getNextTwoWeeks(), []);

  // Compute date string for fetching busy slots
  const selectedDateString = useMemo(() => {
    if (!selectedDate) return undefined;
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, [selectedDate]);

  // Fetch busy time slots for the selected date
  const {
    data: busySlots,
    loading: busySlotsLoading,
  } = useBusySlotsForDate(selectedDateString);

  // Get available slots for selected date
  const availableSlotsForDate = useMemo(() => {
    if (!selectedDate) return [];

    const dayOfWeek = selectedDate.getDay();
    return availability.filter(
      (slot) => slot.is_recurring && slot.day_of_week === dayOfWeek
    );
  }, [selectedDate, availability]);

  // Helper function to parse time string to minutes from midnight
  const parseTimeToMinutes = useCallback((timeStr: string): number => {
    if (timeStr.includes('T') || (timeStr.includes('-') && timeStr.includes(':'))) {
      const isoStr = timeStr.replace(' ', 'T');
      const date = new Date(isoStr);
      return date.getHours() * 60 + date.getMinutes();
    }
    const parts = timeStr.split(':').map(Number);
    return parts[0] * 60 + parts[1];
  }, []);

  // Helper function to check if a time slot conflicts with an existing lesson
  const isTimeSlotBusy = useCallback((timeStr: string, durationMin: number = 30) => {
    if (!selectedDate || busySlots.length === 0) return false;

    const proposedStartMins = parseTimeToMinutes(timeStr);
    const proposedEndMins = proposedStartMins + durationMin;

    for (const busySlot of busySlots) {
      const slotStartMins = parseTimeToMinutes(busySlot.start_time);
      const slotEndMins = parseTimeToMinutes(busySlot.end_time);

      if (proposedStartMins < slotEndMins && proposedEndMins > slotStartMins) {
        return true;
      }
    }

    return false;
  }, [selectedDate, busySlots, parseTimeToMinutes]);

  // Generate time options within a slot, filtering out busy times
  const timeOptionsForSlot = useMemo(() => {
    if (!selectedSlot) return [];

    const times: { time: string; isBusy: boolean }[] = [];
    const [startHour, startMin] = selectedSlot.start_time.split(':').map(Number);
    const [endHour, endMin] = selectedSlot.end_time.split(':').map(Number);

    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;

    // Generate 30-minute intervals
    for (let mins = startMinutes; mins < endMinutes; mins += 30) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      const timeStr = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      const isBusy = isTimeSlotBusy(timeStr, duration);
      times.push({ time: timeStr, isBusy });
    }

    return times;
  }, [selectedSlot, isTimeSlotBusy, duration]);

  // Get valid selections (students with subjects selected)
  const validSelections = useMemo(() => {
    return selectedStudents.filter(s => s.subject !== null);
  }, [selectedStudents]);

  // Check if we can proceed to date selection
  const canProceedToDate = validSelections.length > 0;

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setSelectedStudents([]);
      setDuration(60);
      setSelectedDate(null);
      setSelectedSlot(null);
      setSelectedTime(null);
      setNotes('');
      setError(null);
      setStep('student');
    }
  }, [visible]);

  // Toggle student selection
  const toggleStudent = (student: Student) => {
    setSelectedStudents(prev => {
      const existing = prev.find(s => s.student.id === student.id);
      if (existing) {
        // Remove student
        return prev.filter(s => s.student.id !== student.id);
      } else {
        // Add student with no subject selected yet
        return [...prev, { student, subject: null }];
      }
    });
  };

  // Set subject for a student
  const setStudentSubject = (studentId: string, subject: TutoringSubject) => {
    setSelectedStudents(prev =>
      prev.map(s =>
        s.student.id === studentId ? { ...s, subject } : s
      )
    );
  };

  const handleProceedToDate = () => {
    if (canProceedToDate) {
      setStep('date');
    }
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
    setSelectedTime(null);
    setStep('time');
  };

  const handleSlotSelect = (slot: TutorAvailability) => {
    setSelectedSlot(slot);
    setSelectedTime(null);
  };

  const handleTimeSelect = (time: string) => {
    setSelectedTime(time);
    setStep('confirm');
  };

  const handleBack = () => {
    if (step === 'confirm') {
      setStep('time');
    } else if (step === 'time') {
      setStep('date');
      setSelectedSlot(null);
      setSelectedTime(null);
    } else if (step === 'date') {
      setStep('student');
    }
  };

  const handleSubmit = async () => {
    if (validSelections.length === 0 || !selectedDate || !selectedTime) {
      setError('Please complete all selections');
      return;
    }

    setError(null);

    // Check if this is a combined session (multiple students)
    const isCombinedSession = validSelections.length > 1;

    // Format date as YYYY-MM-DD
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    if (isCombinedSession) {
      // Create a unique group ID to link all requests
      const requestGroupId = crypto.randomUUID();

      let allSucceeded = true;
      for (const selection of validSelections) {
        const result = await createRequest({
          parent_id: parentId,
          student_id: selection.student.id,
          subject: selection.subject!,
          preferred_date: dateStr,
          preferred_time: selectedTime,
          preferred_duration: duration,
          notes: notes.trim() || null,
          request_group_id: requestGroupId,
          request_type: 'dropin',
        });

        if (!result) {
          allSucceeded = false;
          break;
        }
      }

      if (allSucceeded) {
        onSuccess();
        onClose();
      } else {
        setError('Failed to submit request. Please try again.');
      }
    } else {
      // Single student request
      const selection = validSelections[0];
      const result = await createRequest({
        parent_id: parentId,
        student_id: selection.student.id,
        subject: selection.subject!,
        preferred_date: dateStr,
        preferred_time: selectedTime,
        preferred_duration: duration,
        notes: notes.trim() || null,
        request_type: 'dropin',
      });

      if (result) {
        onSuccess();
        onClose();
      } else {
        setError('Failed to submit request. Please try again.');
      }
    }
  };

  // Get display info for confirmation
  const displayStudentNames = validSelections.map(s => s.student.name).join(' & ');
  const displaySubjects = validSelections.map(s => s.subject!);
  const displaySubjectsText = displaySubjects.map(s => SUBJECT_NAMES[s]).join(', ');
  const displayEmojis = displaySubjects.map(s => SUBJECT_EMOJI[s]).join(' ');
  const primaryColor = validSelections.length > 0
    ? getSubjectColor(validSelections[0].subject || 'piano')
    : getSubjectColor('piano');

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
          <Text style={styles.title}>Request Drop-in Session</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Step Indicator */}
        <View style={styles.stepIndicator}>
          <View style={[styles.stepDot, step === 'student' && styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step === 'date' && styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step === 'time' && styles.stepDotActive]} />
          <View style={styles.stepLine} />
          <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Step 1: Student/Subject Selection */}
          {step === 'student' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Select students & subjects</Text>
              <Text style={styles.sectionSubtitle}>
                Choose who needs a drop-in session and what subject
              </Text>

              {students.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="person-outline" size={48} color={colors.neutral.textMuted} />
                  <Text style={styles.emptyStateText}>No students found</Text>
                </View>
              ) : (
                <View style={styles.studentsContainer}>
                  {students.map((student) => {
                    const selection = selectedStudents.find(s => s.student.id === student.id);
                    const isSelected = !!selection;
                    const enrolledSubjects = (student.subjects || []) as TutoringSubject[];

                    return (
                      <View key={student.id} style={styles.studentCard}>
                        <Pressable
                          style={[
                            styles.studentHeader,
                            isSelected && styles.studentHeaderSelected,
                          ]}
                          onPress={() => toggleStudent(student)}
                        >
                          <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                            {isSelected && (
                              <Ionicons name="checkmark" size={16} color={colors.neutral.white} />
                            )}
                          </View>
                          <View style={styles.studentInfo}>
                            <Text style={styles.studentName}>{student.name}</Text>
                            <Text style={styles.studentMeta}>
                              {enrolledSubjects.length > 0
                                ? `Enrolled: ${enrolledSubjects.map(s => SUBJECT_NAMES[s]).join(', ')}`
                                : 'No enrolled subjects'}
                            </Text>
                          </View>
                        </Pressable>

                        {isSelected && enrolledSubjects.length > 0 && (
                          <View style={styles.subjectSelection}>
                            <Text style={styles.subjectLabel}>Select subject:</Text>
                            <View style={styles.subjectOptions}>
                              {enrolledSubjects.map((subject) => (
                                <Pressable
                                  key={subject}
                                  style={[
                                    styles.subjectOption,
                                    selection?.subject === subject && styles.subjectOptionSelected,
                                  ]}
                                  onPress={() => setStudentSubject(student.id, subject)}
                                >
                                  <Text style={styles.subjectEmoji}>{SUBJECT_EMOJI[subject]}</Text>
                                  <Text
                                    style={[
                                      styles.subjectText,
                                      selection?.subject === subject && styles.subjectTextSelected,
                                    ]}
                                  >
                                    {SUBJECT_NAMES[subject]}
                                  </Text>
                                </Pressable>
                              ))}
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}

              {/* Duration Selection */}
              {validSelections.length > 0 && (
                <View style={styles.durationSection}>
                  <Text style={styles.durationLabel}>Session duration:</Text>
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

              {/* Continue Button */}
              {canProceedToDate && (
                <Pressable style={styles.continueButton} onPress={handleProceedToDate}>
                  <Text style={styles.continueButtonText}>Continue to Date Selection</Text>
                  <Ionicons name="arrow-forward" size={20} color={colors.neutral.white} />
                </Pressable>
              )}
            </View>
          )}

          {/* Step 2: Date Selection */}
          {step === 'date' && (
            <View style={styles.section}>
              <Pressable style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={20} color={colors.primary.main} />
                <Text style={styles.backButtonText}>Back to students</Text>
              </Pressable>

              <Text style={styles.sectionTitle}>Select a date</Text>
              <Text style={styles.sectionSubtitle}>
                Choose from the next 2 weeks
              </Text>

              {/* Selected summary */}
              <View style={[styles.selectionSummary, { backgroundColor: primaryColor.subtle }]}>
                <Text style={styles.summaryEmoji}>{displayEmojis}</Text>
                <View>
                  <Text style={styles.summaryText}>
                    {displaySubjectsText} with {displayStudentNames}
                  </Text>
                  <Text style={styles.summaryDuration}>{duration} minutes</Text>
                </View>
              </View>

              {availabilityLoading || tutorLoading ? (
                <ActivityIndicator size="large" color={primaryColor.primary} />
              ) : (
                <View style={styles.dateGrid}>
                  {dateOptions.map((date, index) => {
                    const dayOfWeek = date.getDay();
                    const hasAvailability = availability.some(
                      (slot) => slot.is_recurring && slot.day_of_week === dayOfWeek
                    );
                    const isSelected = selectedDate?.toDateString() === date.toDateString();

                    return (
                      <Pressable
                        key={index}
                        style={[
                          styles.dateOption,
                          !hasAvailability && styles.dateOptionUnavailable,
                          isSelected && styles.dateOptionSelected,
                        ]}
                        onPress={() => hasAvailability && handleDateSelect(date)}
                        disabled={!hasAvailability}
                      >
                        <Text
                          style={[
                            styles.dateDayName,
                            !hasAvailability && styles.dateTextUnavailable,
                            isSelected && styles.dateTextSelected,
                          ]}
                        >
                          {DAY_NAMES[dayOfWeek].slice(0, 3)}
                        </Text>
                        <Text
                          style={[
                            styles.dateDay,
                            !hasAvailability && styles.dateTextUnavailable,
                            isSelected && styles.dateTextSelected,
                          ]}
                        >
                          {date.getDate()}
                        </Text>
                        <Text
                          style={[
                            styles.dateMonth,
                            !hasAvailability && styles.dateTextUnavailable,
                            isSelected && styles.dateTextSelected,
                          ]}
                        >
                          {date.toLocaleDateString('en-US', { month: 'short' })}
                        </Text>
                        {!hasAvailability && (
                          <Text style={styles.unavailableLabel}>N/A</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}

              {/* Legend */}
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.primary.main }]} />
                  <Text style={styles.legendText}>Available</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.neutral.border }]} />
                  <Text style={styles.legendText}>Not available</Text>
                </View>
              </View>
            </View>
          )}

          {/* Step 3: Time Selection */}
          {step === 'time' && selectedDate && (
            <View style={styles.section}>
              <Pressable style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={20} color={colors.primary.main} />
                <Text style={styles.backButtonText}>Back to dates</Text>
              </Pressable>

              <Text style={styles.sectionTitle}>
                Available times on {selectedDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>

              {availableSlotsForDate.length === 0 ? (
                <View style={styles.emptyState}>
                  <Ionicons name="calendar-outline" size={48} color={colors.neutral.textMuted} />
                  <Text style={styles.emptyStateText}>
                    No availability on this day
                  </Text>
                </View>
              ) : (
                <View style={styles.slotsContainer}>
                  {availableSlotsForDate.map((slot) => (
                    <View key={slot.id} style={styles.slotCard}>
                      <Pressable
                        style={[
                          styles.slotHeader,
                          selectedSlot?.id === slot.id && styles.slotHeaderSelected,
                        ]}
                        onPress={() => handleSlotSelect(slot)}
                      >
                        <Ionicons
                          name="time-outline"
                          size={20}
                          color={selectedSlot?.id === slot.id ? colors.primary.main : colors.neutral.textSecondary}
                        />
                        <Text
                          style={[
                            styles.slotTime,
                            selectedSlot?.id === slot.id && styles.slotTimeSelected,
                          ]}
                        >
                          {formatTimeDisplay(slot.start_time)} - {formatTimeDisplay(slot.end_time)}
                        </Text>
                        <Ionicons
                          name={selectedSlot?.id === slot.id ? 'chevron-up' : 'chevron-down'}
                          size={20}
                          color={colors.neutral.textMuted}
                        />
                      </Pressable>

                      {selectedSlot?.id === slot.id && (
                        <View style={styles.timeOptionsContainer}>
                          <Text style={styles.timeOptionsLabel}>Select a start time:</Text>
                          {busySlotsLoading ? (
                            <ActivityIndicator size="small" color={colors.primary.main} />
                          ) : (
                            <View style={styles.timeOptionsGrid}>
                              {timeOptionsForSlot.map(({ time, isBusy }) => (
                                <Pressable
                                  key={time}
                                  style={[
                                    styles.timeOption,
                                    selectedTime === time && styles.timeOptionSelected,
                                    isBusy && styles.timeOptionBusy,
                                  ]}
                                  onPress={() => !isBusy && handleTimeSelect(time)}
                                  disabled={isBusy}
                                >
                                  <Text
                                    style={[
                                      styles.timeOptionText,
                                      selectedTime === time && styles.timeOptionTextSelected,
                                      isBusy && styles.timeOptionTextBusy,
                                    ]}
                                  >
                                    {formatTimeDisplay(time)}
                                  </Text>
                                  {isBusy && (
                                    <Text style={styles.busyLabel}>Booked</Text>
                                  )}
                                </Pressable>
                              ))}
                            </View>
                          )}
                        </View>
                      )}

                      {slot.notes && (
                        <Text style={styles.slotNotes}>{slot.notes}</Text>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}

          {/* Step 4: Confirmation */}
          {step === 'confirm' && selectedDate && selectedTime && (
            <View style={styles.section}>
              <Pressable style={styles.backButton} onPress={handleBack}>
                <Ionicons name="arrow-back" size={20} color={colors.primary.main} />
                <Text style={styles.backButtonText}>Back to times</Text>
              </Pressable>

              <Text style={styles.sectionTitle}>Confirm your request</Text>

              {/* Summary Card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Ionicons name="person" size={20} color={colors.primary.main} />
                  <View style={styles.summaryContent}>
                    <Text style={styles.summaryLabel}>Student(s)</Text>
                    <Text style={styles.summaryValue}>{displayStudentNames}</Text>
                  </View>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="book" size={20} color={colors.primary.main} />
                  <View style={styles.summaryContent}>
                    <Text style={styles.summaryLabel}>Subject(s)</Text>
                    <Text style={styles.summaryValue}>{displayEmojis} {displaySubjectsText}</Text>
                  </View>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="calendar" size={20} color={colors.primary.main} />
                  <View style={styles.summaryContent}>
                    <Text style={styles.summaryLabel}>Date</Text>
                    <Text style={styles.summaryValue}>
                      {selectedDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </Text>
                  </View>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="time" size={20} color={colors.primary.main} />
                  <View style={styles.summaryContent}>
                    <Text style={styles.summaryLabel}>Time</Text>
                    <Text style={styles.summaryValue}>{formatTimeDisplay(selectedTime)}</Text>
                  </View>
                </View>
                <View style={styles.summaryRow}>
                  <Ionicons name="hourglass" size={20} color={colors.primary.main} />
                  <View style={styles.summaryContent}>
                    <Text style={styles.summaryLabel}>Duration</Text>
                    <Text style={styles.summaryValue}>{duration} minutes</Text>
                  </View>
                </View>
                {validSelections.length > 1 && (
                  <View style={styles.summaryRow}>
                    <Ionicons name="people" size={20} color={colors.primary.main} />
                    <View style={styles.summaryContent}>
                      <Text style={styles.summaryLabel}>Session Type</Text>
                      <Text style={styles.summaryValue}>Combined Session</Text>
                    </View>
                  </View>
                )}
              </View>

              {/* Notes Input */}
              <View style={styles.notesSection}>
                <Text style={styles.notesLabel}>Add a note (optional)</Text>
                <TextInput
                  style={styles.notesInput}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="e.g., Need extra practice before upcoming recital"
                  placeholderTextColor={colors.neutral.textMuted}
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Info Message */}
              <View style={styles.infoBox}>
                <Ionicons name="information-circle-outline" size={20} color={colors.status.info} />
                <Text style={styles.infoText}>
                  Your tutor will review this request and confirm availability.
                  You'll be notified once they respond.
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
        {step === 'confirm' && (
          <View style={styles.footer}>
            <Pressable
              style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <>
                  <Ionicons name="send" size={20} color={colors.neutral.white} />
                  <Text style={styles.submitButtonText}>Send Request</Text>
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
    width: 30,
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
  studentsContainer: {
    gap: spacing.md,
  },
  studentCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  studentHeaderSelected: {
    backgroundColor: colors.primary.subtle,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.primary.main,
    backgroundColor: colors.neutral.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    backgroundColor: colors.primary.main,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  studentMeta: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  subjectSelection: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  subjectLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
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
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  subjectOptionSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  subjectEmoji: {
    fontSize: 16,
  },
  subjectText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  subjectTextSelected: {
    color: colors.neutral.white,
  },
  durationSection: {
    marginTop: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  durationLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  durationOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  durationOptionSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  durationText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  durationTextSelected: {
    color: colors.neutral.white,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    backgroundColor: colors.primary.main,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  continueButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  selectionSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  summaryEmoji: {
    fontSize: 24,
  },
  summaryText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  summaryDuration: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: spacing.xs,
  },
  dateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dateOption: {
    width: '22%',
    aspectRatio: 0.8,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.primary.main,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  dateOptionUnavailable: {
    borderColor: colors.neutral.border,
    opacity: 0.5,
  },
  dateOptionSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  dateDayName: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  dateDay: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  dateMonth: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  dateTextUnavailable: {
    color: colors.neutral.textMuted,
  },
  dateTextSelected: {
    color: colors.neutral.white,
  },
  unavailableLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
  },
  legend: {
    flexDirection: 'row',
    gap: spacing.lg,
    marginTop: spacing.lg,
    justifyContent: 'center',
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
  slotsContainer: {
    gap: spacing.md,
  },
  slotCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  slotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  slotHeaderSelected: {
    backgroundColor: colors.primary.subtle,
  },
  slotTime: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  slotTimeSelected: {
    color: colors.primary.main,
  },
  slotNotes: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  timeOptionsContainer: {
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  timeOptionsLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  timeOptionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  timeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  timeOptionSelected: {
    backgroundColor: colors.primary.main,
    borderColor: colors.primary.main,
  },
  timeOptionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  timeOptionTextSelected: {
    color: colors.neutral.white,
  },
  timeOptionBusy: {
    backgroundColor: colors.neutral.border,
    borderColor: colors.neutral.border,
    opacity: 0.6,
  },
  timeOptionTextBusy: {
    color: colors.neutral.textMuted,
    textDecorationLine: 'line-through',
  },
  busyLabel: {
    fontSize: typography.sizes.xs,
    color: colors.status.error,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyStateText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    marginTop: spacing.md,
  },
  summaryCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  summaryContent: {
    flex: 1,
  },
  summaryLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginTop: spacing.xs,
  },
  notesSection: {
    marginBottom: spacing.lg,
  },
  notesLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
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

export default DropinRequestModal;
