/**
 * LessonFormModal
 * Modal for creating and editing scheduled lessons
 * Features: Calendar date picker with multi-day selection, all subjects,
 *           recurrence options, multi-student selection, student search,
 *           custom duration
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
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { StudentWithParent, TutoringSubject, ScheduledLessonWithStudent } from '../types/database';
import { supabase } from '../lib/supabase';

interface LessonFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (data: LessonFormData) => Promise<void>;
  onSubmitSession?: (sessionData: SessionFormData) => Promise<void>;
  students: StudentWithParent[];
  studentsLoading?: boolean;
  initialData?: ScheduledLessonWithStudent | null;
  mode: 'create' | 'edit';
}

// Session creation data (grouped lessons)
export interface SessionFormData {
  scheduled_at: string;
  duration_min: number;
  notes?: string;
  lessons: Array<{
    student_id: string;
    subject: TutoringSubject;
  }>;
  recurrence?: RecurrenceType;
  recurrence_end_date?: string;
}

export interface LessonFormData {
  student_id: string;
  subject: TutoringSubject;
  scheduled_at: string;
  duration_min: number;
  notes?: string;
  recurrence?: RecurrenceType;
  recurrence_end_date?: string;
}

// Extended type for batch scheduling
export interface BatchLessonFormData {
  students: Array<{
    student_id: string;
    subjects: TutoringSubject[];
  }>;
  scheduled_at: string;
  duration_min: number;
  notes?: string;
  recurrence?: RecurrenceType;
  recurrence_end_date?: string;
}

export type RecurrenceType = 'none' | 'weekly' | 'biweekly' | 'monthly';

const PRESET_DURATIONS = [30, 45, 60, 90];

const SUBJECT_OPTIONS: { value: TutoringSubject; label: string; icon: string; color: string }[] = [
  { value: 'piano', label: 'Piano', icon: '🎹', color: colors.piano.primary },
  { value: 'math', label: 'Math', icon: '➗', color: colors.math.primary },
  { value: 'reading', label: 'Reading', icon: '📚', color: colors.subjects.reading.primary },
  { value: 'speech', label: 'Speech', icon: '🗣️', color: colors.subjects.speech.primary },
  { value: 'english', label: 'English', icon: '📝', color: colors.subjects.english.primary },
];

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string; description: string }[] = [
  { value: 'none', label: 'One-time', description: 'Single lesson' },
  { value: 'weekly', label: 'Weekly', description: 'Every week' },
  { value: 'biweekly', label: 'Bi-weekly', description: 'Every 2 weeks' },
  { value: 'monthly', label: 'Monthly', description: 'Same day each month' },
];

const TIME_SLOTS = [
  '09:00', '09:30', '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30', '14:00', '14:30',
  '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00',
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

// Type for student selection with subjects
interface StudentSelection {
  studentId: string;
  subjects: TutoringSubject[];
}

export function LessonFormModal({
  visible,
  onClose,
  onSubmit,
  onSubmitSession,
  students,
  studentsLoading = false,
  initialData,
  mode,
}: LessonFormModalProps) {
  // Multi-student selection state
  const [selectedStudents, setSelectedStudents] = useState<StudentSelection[]>([]);
  const [studentSearch, setStudentSearch] = useState('');

  // Duration state - supports custom values
  const [selectedDuration, setSelectedDuration] = useState<number>(30);
  const [customDuration, setCustomDuration] = useState<string>('');
  const [showCustomDuration, setShowCustomDuration] = useState(false);

  // Other form state - multi-day selection
  const [selectedDates, setSelectedDates] = useState<Date[]>([new Date()]);
  const [selectedTime, setSelectedTime] = useState<string>('15:00');
  const [showCustomTime, setShowCustomTime] = useState(false);
  const [customTimeHour, setCustomTimeHour] = useState<string>('15');
  const [customTimeMinute, setCustomTimeMinute] = useState<string>('00');
  const [notes, setNotes] = useState<string>('');
  const [recurrence, setRecurrence] = useState<RecurrenceType>('none');
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Session mode state - when true, creates as grouped session
  const [createAsSession, setCreateAsSession] = useState(false);

  // Calendar state
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [showTimePicker, setShowTimePicker] = useState(false);

  // Initialize form with data
  useEffect(() => {
    if (visible) {
      if (initialData && mode === 'edit') {
        // Edit mode - single student, single date
        setSelectedStudents([{
          studentId: initialData.student_id,
          subjects: [initialData.subject],
        }]);
        setSelectedDuration(initialData.duration_min);
        setShowCustomDuration(!PRESET_DURATIONS.includes(initialData.duration_min));
        if (!PRESET_DURATIONS.includes(initialData.duration_min)) {
          setCustomDuration(initialData.duration_min.toString());
        }
        setNotes(initialData.notes || '');

        const date = new Date(initialData.scheduled_at);
        setSelectedDates([date]);
        setCalendarMonth(date);
        const timeStr = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        setSelectedTime(timeStr);
        // Check if this is a non-standard time (not on 30-min intervals)
        const isCustomTime = !TIME_SLOTS.includes(timeStr);
        setShowCustomTime(isCustomTime);
        if (isCustomTime) {
          setCustomTimeHour(date.getHours().toString().padStart(2, '0'));
          setCustomTimeMinute(date.getMinutes().toString().padStart(2, '0'));
        }
        setRecurrence('none');
        setRecurrenceEndDate(null);
      } else {
        // Create mode - reset form
        const now = new Date();
        setSelectedDates([now]);
        setCalendarMonth(now);
        setSelectedTime('15:00');
        setShowCustomTime(false);
        setCustomTimeHour('15');
        setCustomTimeMinute('00');
        setSelectedStudents([]);
        setSelectedDuration(30);
        setCustomDuration('');
        setShowCustomDuration(false);
        setNotes('');
        setRecurrence('none');
        setRecurrenceEndDate(null);
        setCreateAsSession(false);
      }
      setStudentSearch('');
      setError(null);
      setShowTimePicker(false);
    }
  }, [visible, initialData, mode]);

  // Filter students based on search
  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return students;
    const search = studentSearch.toLowerCase().trim();
    return students.filter(student =>
      student.name.toLowerCase().includes(search) ||
      student.parent?.name?.toLowerCase().includes(search)
    );
  }, [students, studentSearch]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: (Date | null)[] = [];

    for (let i = 0; i < startPadding; i++) {
      days.push(null);
    }

    for (let i = 1; i <= totalDays; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  }, [calendarMonth]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCalendarMonth(prev => {
      const newMonth = new Date(prev);
      if (direction === 'prev') {
        newMonth.setMonth(newMonth.getMonth() - 1);
      } else {
        newMonth.setMonth(newMonth.getMonth() + 1);
      }
      return newMonth;
    });
  };

  const isDateSelected = (date: Date | null) => {
    if (!date) return false;
    return selectedDates.some(d => d.toDateString() === date.toDateString());
  };

  const isDateToday = (date: Date | null) => {
    if (!date) return false;
    return date.toDateString() === new Date().toDateString();
  };

  const isDatePast = (date: Date | null) => {
    if (!date) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleDateSelect = (date: Date | null) => {
    if (!date || isDatePast(date)) return;

    // In edit mode, only allow single date selection
    if (mode === 'edit') {
      setSelectedDates([date]);
      return;
    }

    // In create mode, toggle date selection
    setSelectedDates(prev => {
      const dateString = date.toDateString();
      const existingIndex = prev.findIndex(d => d.toDateString() === dateString);

      if (existingIndex >= 0) {
        // Remove date if already selected (but keep at least one)
        if (prev.length > 1) {
          return prev.filter((_, i) => i !== existingIndex);
        }
        return prev;
      } else {
        // Add date to selection
        return [...prev, date].sort((a, b) => a.getTime() - b.getTime());
      }
    });
  };

  // Student selection handlers
  const toggleStudentSelection = (studentId: string) => {
    setSelectedStudents(prev => {
      const existing = prev.find(s => s.studentId === studentId);
      if (existing) {
        // Remove student
        return prev.filter(s => s.studentId !== studentId);
      } else {
        // Add student with default subject (first available or piano)
        const student = students.find(s => s.id === studentId);
        const defaultSubject: TutoringSubject = student?.subjects?.[0] as TutoringSubject || 'piano';
        return [...prev, { studentId, subjects: [defaultSubject] }];
      }
    });
  };

  const toggleSubjectForStudent = (studentId: string, subject: TutoringSubject) => {
    setSelectedStudents(prev => {
      return prev.map(s => {
        if (s.studentId !== studentId) return s;

        const hasSubject = s.subjects.includes(subject);
        if (hasSubject) {
          // Remove subject (but keep at least one)
          if (s.subjects.length > 1) {
            return { ...s, subjects: s.subjects.filter(sub => sub !== subject) };
          }
          return s;
        } else {
          // Add subject
          return { ...s, subjects: [...s.subjects, subject] };
        }
      });
    });
  };

  const isStudentSelected = (studentId: string) => {
    return selectedStudents.some(s => s.studentId === studentId);
  };

  const getStudentSubjects = (studentId: string) => {
    return selectedStudents.find(s => s.studentId === studentId)?.subjects || [];
  };

  // Duration handlers
  const handleDurationSelect = (duration: number) => {
    setSelectedDuration(duration);
    setShowCustomDuration(false);
    setCustomDuration('');
  };

  const handleCustomDurationChange = (text: string) => {
    // Only allow numbers
    const numericValue = text.replace(/[^0-9]/g, '');
    setCustomDuration(numericValue);
    if (numericValue) {
      const num = parseInt(numericValue, 10);
      if (num > 0 && num <= 240) {
        setSelectedDuration(num);
      }
    }
  };

  const getEffectiveDuration = () => {
    if (showCustomDuration && customDuration) {
      const num = parseInt(customDuration, 10);
      if (num > 0 && num <= 240) return num;
    }
    return selectedDuration;
  };

  // Submit handler
  const handleSubmit = async () => {
    if (submitting) return;

    if (selectedStudents.length === 0) {
      setError('Please select at least one student');
      return;
    }

    // Validate each student has at least one subject
    const invalidStudent = selectedStudents.find(s => s.subjects.length === 0);
    if (invalidStudent) {
      const student = students.find(st => st.id === invalidStudent.studentId);
      setError(`Please select at least one subject for ${student?.name || 'the student'}`);
      return;
    }

    if (selectedDates.length === 0 || !selectedTime) {
      setError('Please select at least one date and time');
      return;
    }

    const duration = getEffectiveDuration();
    if (duration < 15 || duration > 240) {
      setError('Duration must be between 15 and 240 minutes');
      return;
    }

    // Check for scheduling conflicts (overlapping sessions)
    const [hours, minutes] = selectedTime.split(':').map(Number);

    for (const date of selectedDates) {
      const scheduledAt = new Date(date);
      scheduledAt.setHours(hours, minutes, 0, 0);
      const endAt = new Date(scheduledAt.getTime() + duration * 60 * 1000);

      // Format date for database query (YYYY-MM-DD)
      const dateStr = `${scheduledAt.getFullYear()}-${String(scheduledAt.getMonth() + 1).padStart(2, '0')}-${String(scheduledAt.getDate()).padStart(2, '0')}`;

      // Get busy slots for this date
      const { data: busySlots, error: fetchError } = await supabase
        .rpc('get_busy_slots_for_date', { check_date: dateStr });

      if (fetchError) {
        console.error('Error checking busy slots:', fetchError);
        // Continue without blocking if there's an error fetching slots
      } else if (busySlots && busySlots.length > 0) {
        // Check for overlaps: new lesson overlaps with existing if:
        // new_start < existing_end AND new_end > existing_start
        for (const slot of busySlots) {
          const slotStart = new Date(slot.start_time);
          const slotEnd = new Date(slot.end_time);

          // Skip if this is the same lesson being edited
          if (mode === 'edit' && initialData) {
            const editingStart = new Date(initialData.scheduled_at);
            const editingEnd = new Date(editingStart.getTime() + initialData.duration_min * 60 * 1000);
            if (slotStart.getTime() === editingStart.getTime() && slotEnd.getTime() === editingEnd.getTime()) {
              continue;
            }
          }

          // Check for overlap
          if (scheduledAt < slotEnd && endAt > slotStart) {
            const conflictTime = slotStart.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
            const conflictEndTime = slotEnd.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
            });
            const conflictDate = scheduledAt.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            });
            setError(`Scheduling conflict: There is already a session from ${conflictTime} to ${conflictEndTime} on ${conflictDate}. Please choose a different time.`);
            return;
          }
        }
      }
    }

    setSubmitting(true);
    setError(null);

    try {

      // For edit mode or single student+subject, submit directly
      // For multiple students/subjects/dates in create mode, submit each combination
      if (mode === 'edit') {
        // Edit mode - single submission with first date
        const scheduledAt = new Date(selectedDates[0]);
        scheduledAt.setHours(hours, minutes, 0, 0);
        const selection = selectedStudents[0];
        await onSubmit({
          student_id: selection.studentId,
          subject: selection.subjects[0],
          scheduled_at: scheduledAt.toISOString(),
          duration_min: duration,
          notes: notes.trim() || undefined,
          recurrence: recurrence !== 'none' ? recurrence : undefined,
          recurrence_end_date: recurrenceEndDate ? recurrenceEndDate.toISOString() : undefined,
        });
      } else if (createAsSession && onSubmitSession) {
        // Create mode with session - create grouped lesson
        // Build array of all student+subject combinations
        const lessons: Array<{ student_id: string; subject: TutoringSubject }> = [];
        for (const selection of selectedStudents) {
          for (const subject of selection.subjects) {
            lessons.push({
              student_id: selection.studentId,
              subject,
            });
          }
        }

        // When recurrence is set, only use the first date - recurrence logic generates the rest
        // When no recurrence, create a session for each selected date
        const datesToProcess = recurrence !== 'none' ? [selectedDates[0]] : selectedDates;

        for (const date of datesToProcess) {
          const scheduledAt = new Date(date);
          scheduledAt.setHours(hours, minutes, 0, 0);

          await onSubmitSession({
            scheduled_at: scheduledAt.toISOString(),
            duration_min: duration,
            notes: notes.trim() || undefined,
            lessons,
            recurrence: recurrence !== 'none' ? recurrence : undefined,
            recurrence_end_date: recurrenceEndDate ? recurrenceEndDate.toISOString() : undefined,
          });
        }
      } else {
        // Create mode - submit for each date + student + subject combination
        // When recurrence is set, only use the first date - recurrence logic generates the rest
        const datesToProcess = recurrence !== 'none' ? [selectedDates[0]] : selectedDates;

        for (const date of datesToProcess) {
          const scheduledAt = new Date(date);
          scheduledAt.setHours(hours, minutes, 0, 0);

          for (const selection of selectedStudents) {
            for (const subject of selection.subjects) {
              await onSubmit({
                student_id: selection.studentId,
                subject,
                scheduled_at: scheduledAt.toISOString(),
                duration_min: duration,
                notes: notes.trim() || undefined,
                recurrence: recurrence !== 'none' ? recurrence : undefined,
                recurrence_end_date: recurrenceEndDate ? recurrenceEndDate.toISOString() : undefined,
              });
            }
          }
        }
      }

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save lesson');
    } finally {
      setSubmitting(false);
    }
  };

  // Get primary color based on first selected student's first subject
  const getPrimaryColor = () => {
    if (selectedStudents.length > 0 && selectedStudents[0].subjects.length > 0) {
      const subject = selectedStudents[0].subjects[0];
      const option = SUBJECT_OPTIONS.find(o => o.value === subject);
      return option?.color || colors.piano.primary;
    }
    return colors.piano.primary;
  };

  const primaryColor = getPrimaryColor();

  // Count total lessons to be created (dates × students × subjects)
  const getTotalLessonsCount = () => {
    const subjectCount = selectedStudents.reduce((total, s) => total + s.subjects.length, 0);
    return selectedDates.length * subjectCount;
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
            {mode === 'create' ? 'Schedule Lesson' : 'Edit Lesson'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Student Selection with Search */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {mode === 'create' ? 'Students' : 'Student'}
              {selectedStudents.length > 0 && (
                <Text style={styles.selectedCount}> ({selectedStudents.length} selected)</Text>
              )}
            </Text>

            {/* Search Input */}
            {mode === 'create' && (
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={colors.neutral.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={studentSearch}
                  onChangeText={setStudentSearch}
                  placeholder="Search students by name..."
                  placeholderTextColor={colors.neutral.textMuted}
                />
                {studentSearch.length > 0 && (
                  <Pressable onPress={() => setStudentSearch('')}>
                    <Ionicons name="close-circle" size={20} color={colors.neutral.textMuted} />
                  </Pressable>
                )}
              </View>
            )}

            {/* Student List */}
            {studentsLoading ? (
              <ActivityIndicator size="small" color={primaryColor} />
            ) : filteredStudents.length === 0 ? (
              <Text style={styles.emptyText}>
                {studentSearch ? 'No students match your search' : 'No students available'}
              </Text>
            ) : (
              <View style={styles.studentList}>
                {filteredStudents.map((student) => {
                  const isSelected = isStudentSelected(student.id);
                  const selectedSubjects = getStudentSubjects(student.id);

                  return (
                    <View key={student.id} style={styles.studentCard}>
                      {/* Student Header */}
                      <Pressable
                        style={[
                          styles.studentHeader,
                          isSelected && styles.studentHeaderSelected,
                        ]}
                        onPress={() => toggleStudentSelection(student.id)}
                      >
                        <View style={styles.studentCheckbox}>
                          {isSelected ? (
                            <Ionicons name="checkbox" size={24} color={primaryColor} />
                          ) : (
                            <Ionicons name="square-outline" size={24} color={colors.neutral.border} />
                          )}
                        </View>
                        <View
                          style={[
                            styles.studentAvatar,
                            isSelected && { backgroundColor: primaryColor },
                          ]}
                        >
                          <Text style={styles.studentInitial}>
                            {student.name.charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={styles.studentInfo}>
                          <Text style={styles.studentName}>{student.name}</Text>
                          {student.parent && (
                            <Text style={styles.parentName}>{student.parent.name}</Text>
                          )}
                        </View>
                      </Pressable>

                      {/* Subject Selection (shown when student is selected) */}
                      {isSelected && (
                        <View style={styles.subjectSelection}>
                          <Text style={styles.subjectSelectionLabel}>Subjects:</Text>
                          <View style={styles.subjectChips}>
                            {SUBJECT_OPTIONS.map((option) => {
                              const isSubjectSelected = selectedSubjects.includes(option.value);
                              return (
                                <Pressable
                                  key={option.value}
                                  style={[
                                    styles.subjectChip,
                                    isSubjectSelected && {
                                      backgroundColor: option.color,
                                      borderColor: option.color,
                                    },
                                  ]}
                                  onPress={() => toggleSubjectForStudent(student.id, option.value)}
                                >
                                  <Text style={styles.subjectIcon}>{option.icon}</Text>
                                  <Text
                                    style={[
                                      styles.subjectChipLabel,
                                      isSubjectSelected && styles.subjectChipLabelSelected,
                                    ]}
                                  >
                                    {option.label}
                                  </Text>
                                </Pressable>
                              );
                            })}
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Group Session Toggle - Show when multiple students or subjects selected */}
          {mode === 'create' && onSubmitSession && getTotalLessonsCount() > 1 && (
            <View style={styles.section}>
              <Pressable
                style={[
                  styles.sessionToggle,
                  createAsSession && styles.sessionToggleActive,
                ]}
                onPress={() => setCreateAsSession(!createAsSession)}
              >
                <View style={styles.sessionToggleContent}>
                  <Ionicons
                    name={createAsSession ? "people" : "people-outline"}
                    size={24}
                    color={createAsSession ? primaryColor : colors.neutral.textSecondary}
                  />
                  <View style={styles.sessionToggleText}>
                    <Text style={[
                      styles.sessionToggleTitle,
                      createAsSession && { color: primaryColor }
                    ]}>
                      Create as Combined Session
                    </Text>
                    <Text style={styles.sessionToggleDesc}>
                      {createAsSession
                        ? 'All students will share one time slot on calendar'
                        : 'Each lesson will be displayed separately'}
                    </Text>
                  </View>
                </View>
                <View style={[
                  styles.sessionToggleCheckbox,
                  createAsSession && { backgroundColor: primaryColor, borderColor: primaryColor }
                ]}>
                  {createAsSession && (
                    <Ionicons name="checkmark" size={18} color={colors.neutral.white} />
                  )}
                </View>
              </Pressable>
              {createAsSession && (
                <View style={styles.sessionPreview}>
                  <Ionicons name="information-circle-outline" size={16} color={colors.neutral.textMuted} />
                  <Text style={styles.sessionPreviewText}>
                    Preview: {selectedStudents.map(s => students.find(st => st.id === s.studentId)?.name).join(' & ')} • {
                      [...new Set(selectedStudents.flatMap(s => s.subjects))].map(sub =>
                        SUBJECT_OPTIONS.find(o => o.value === sub)?.label
                      ).join(', ')
                    }
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Calendar Date Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {mode === 'create' ? 'Dates' : 'Date'}
              {mode === 'create' && selectedDates.length > 0 && (
                <Text style={styles.selectedCount}> ({selectedDates.length} selected)</Text>
              )}
            </Text>
            <View style={styles.calendarContainer}>
              {/* Month Navigation */}
              <View style={styles.calendarHeader}>
                <Pressable onPress={() => navigateMonth('prev')} style={styles.calendarNavButton}>
                  <Ionicons name="chevron-back" size={24} color={colors.neutral.text} />
                </Pressable>
                <Text style={styles.calendarMonthTitle}>
                  {MONTH_NAMES[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </Text>
                <Pressable onPress={() => navigateMonth('next')} style={styles.calendarNavButton}>
                  <Ionicons name="chevron-forward" size={24} color={colors.neutral.text} />
                </Pressable>
              </View>

              {/* Weekday Headers */}
              <View style={styles.weekdayRow}>
                {WEEKDAY_NAMES.map((day) => (
                  <Text key={day} style={styles.weekdayLabel}>{day}</Text>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.calendarGrid}>
                {calendarDays.map((date, index) => {
                  const selected = date && isDateSelected(date);
                  return (
                    <Pressable
                      key={index}
                      style={[
                        styles.calendarDay,
                        selected && {
                          backgroundColor: primaryColor,
                        },
                        date && isDateToday(date) && !selected && styles.calendarDayToday,
                        date && isDatePast(date) && styles.calendarDayPast,
                      ]}
                      onPress={() => handleDateSelect(date)}
                      disabled={!date || isDatePast(date)}
                    >
                      {date && (
                        <View style={styles.calendarDayContent}>
                          <Text
                            style={[
                              styles.calendarDayText,
                              selected && styles.calendarDayTextSelected,
                              isDateToday(date) && !selected && { color: primaryColor },
                              isDatePast(date) && styles.calendarDayTextPast,
                            ]}
                          >
                            {date.getDate()}
                          </Text>
                          {selected && mode === 'create' && (
                            <Ionicons
                              name="checkmark-circle"
                              size={12}
                              color={colors.neutral.white}
                              style={styles.calendarDayCheck}
                            />
                          )}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </View>

              {/* Selected Date Display */}
              <View style={styles.selectedDateDisplay}>
                <Ionicons name="calendar" size={18} color={primaryColor} />
                <View style={styles.selectedDatesContainer}>
                  {selectedDates.length === 1 ? (
                    <Text style={[styles.selectedDateText, { color: primaryColor }]}>
                      {selectedDates[0].toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Text>
                  ) : (
                    <View style={styles.selectedDatesChips}>
                      {selectedDates.slice(0, 5).map((date, idx) => (
                        <View key={idx} style={[styles.selectedDateChip, { backgroundColor: primaryColor + '20' }]}>
                          <Text style={[styles.selectedDateChipText, { color: primaryColor }]}>
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        </View>
                      ))}
                      {selectedDates.length > 5 && (
                        <Text style={[styles.selectedDateMore, { color: primaryColor }]}>
                          +{selectedDates.length - 5} more
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </View>

              {/* Multi-date hint for create mode */}
              {mode === 'create' && (
                <View style={styles.multiDateHint}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.neutral.textMuted} />
                  <Text style={styles.multiDateHintText}>
                    Tap multiple dates to schedule lessons on different days
                  </Text>
                  {selectedDates.length > 1 && (
                    <Pressable
                      onPress={() => setSelectedDates([selectedDates[0]])}
                      style={styles.clearDatesButton}
                    >
                      <Text style={[styles.clearDatesText, { color: primaryColor }]}>Clear</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          </View>

          {/* Time Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Time</Text>
            <Pressable
              style={styles.timeSelector}
              onPress={() => setShowTimePicker(!showTimePicker)}
            >
              <Ionicons name="time-outline" size={20} color={primaryColor} />
              <Text style={styles.timeSelectorText}>{selectedTime}</Text>
              <Ionicons
                name={showTimePicker ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.neutral.textMuted}
              />
            </Pressable>

            {showTimePicker && (
              <View style={styles.timePickerContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.timeSlotsList}
                >
                  {TIME_SLOTS.map((time) => (
                    <Pressable
                      key={time}
                      style={[
                        styles.timeSlot,
                        !showCustomTime && selectedTime === time && {
                          backgroundColor: primaryColor,
                          borderColor: primaryColor,
                        },
                      ]}
                      onPress={() => {
                        setSelectedTime(time);
                        setShowCustomTime(false);
                        setShowTimePicker(false);
                      }}
                    >
                      <Text
                        style={[
                          styles.timeSlotText,
                          !showCustomTime && selectedTime === time && styles.timeSlotTextSelected,
                        ]}
                      >
                        {time}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {/* Custom Time Toggle */}
                <Pressable
                  style={[
                    styles.customTimeToggle,
                    showCustomTime && {
                      borderColor: primaryColor,
                      backgroundColor: primaryColor + '15',
                    },
                  ]}
                  onPress={() => {
                    setShowCustomTime(!showCustomTime);
                    if (!showCustomTime) {
                      // Parse current time to initialize custom inputs
                      const [h, m] = selectedTime.split(':');
                      setCustomTimeHour(h);
                      setCustomTimeMinute(m);
                    }
                  }}
                >
                  <Ionicons
                    name="options-outline"
                    size={18}
                    color={showCustomTime ? primaryColor : colors.neutral.textSecondary}
                  />
                  <Text
                    style={[
                      styles.customTimeToggleText,
                      showCustomTime && { color: primaryColor },
                    ]}
                  >
                    Custom Time
                  </Text>
                </Pressable>

                {/* Custom Time Input */}
                {showCustomTime && (
                  <View style={styles.customTimeContainer}>
                    <View style={styles.customTimeInputGroup}>
                      <Text style={styles.customTimeLabel}>Hour</Text>
                      <TextInput
                        style={[styles.customTimeInput, { borderColor: primaryColor }]}
                        value={customTimeHour}
                        onChangeText={(text) => {
                          const numericValue = text.replace(/[^0-9]/g, '');
                          if (numericValue === '' || (parseInt(numericValue, 10) >= 0 && parseInt(numericValue, 10) <= 23)) {
                            setCustomTimeHour(numericValue);
                            if (numericValue.length > 0) {
                              const hour = numericValue.padStart(2, '0');
                              const minute = customTimeMinute.padStart(2, '0');
                              setSelectedTime(`${hour}:${minute}`);
                            }
                          }
                        }}
                        placeholder="00"
                        placeholderTextColor={colors.neutral.textMuted}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                      <Text style={styles.customTimeHint}>(0-23)</Text>
                    </View>
                    <Text style={styles.customTimeSeparator}>:</Text>
                    <View style={styles.customTimeInputGroup}>
                      <Text style={styles.customTimeLabel}>Min</Text>
                      <TextInput
                        style={[styles.customTimeInput, { borderColor: primaryColor }]}
                        value={customTimeMinute}
                        onChangeText={(text) => {
                          const numericValue = text.replace(/[^0-9]/g, '');
                          if (numericValue === '' || (parseInt(numericValue, 10) >= 0 && parseInt(numericValue, 10) <= 59)) {
                            setCustomTimeMinute(numericValue);
                            if (numericValue.length > 0) {
                              const hour = customTimeHour.padStart(2, '0');
                              const minute = numericValue.padStart(2, '0');
                              setSelectedTime(`${hour}:${minute}`);
                            }
                          }
                        }}
                        placeholder="00"
                        placeholderTextColor={colors.neutral.textMuted}
                        keyboardType="number-pad"
                        maxLength={2}
                      />
                      <Text style={styles.customTimeHint}>(0-59)</Text>
                    </View>
                    <Pressable
                      style={[styles.customTimeApplyButton, { backgroundColor: primaryColor }]}
                      onPress={() => {
                        const hour = customTimeHour.padStart(2, '0');
                        const minute = customTimeMinute.padStart(2, '0');
                        setSelectedTime(`${hour}:${minute}`);
                        setShowTimePicker(false);
                      }}
                    >
                      <Ionicons name="checkmark" size={20} color={colors.neutral.white} />
                    </Pressable>
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Duration Selection with Custom Option */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Duration</Text>
            <View style={styles.durationContainer}>
              {/* Preset Duration Options */}
              <View style={styles.durationGrid}>
                {PRESET_DURATIONS.map((duration) => (
                  <Pressable
                    key={duration}
                    style={[
                      styles.durationButton,
                      !showCustomDuration && selectedDuration === duration && {
                        borderColor: primaryColor,
                        backgroundColor: primaryColor + '15',
                      },
                    ]}
                    onPress={() => handleDurationSelect(duration)}
                  >
                    <Text
                      style={[
                        styles.durationLabel,
                        !showCustomDuration && selectedDuration === duration && {
                          color: primaryColor,
                        },
                      ]}
                    >
                      {duration} min
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Custom Duration Toggle */}
              <Pressable
                style={[
                  styles.customDurationToggle,
                  showCustomDuration && {
                    borderColor: primaryColor,
                    backgroundColor: primaryColor + '15',
                  },
                ]}
                onPress={() => {
                  setShowCustomDuration(!showCustomDuration);
                  if (!showCustomDuration) {
                    setCustomDuration(selectedDuration.toString());
                  }
                }}
              >
                <Ionicons
                  name="options-outline"
                  size={18}
                  color={showCustomDuration ? primaryColor : colors.neutral.textSecondary}
                />
                <Text
                  style={[
                    styles.customDurationToggleText,
                    showCustomDuration && { color: primaryColor },
                  ]}
                >
                  Custom
                </Text>
              </Pressable>

              {/* Custom Duration Input */}
              {showCustomDuration && (
                <View style={styles.customDurationContainer}>
                  <TextInput
                    style={[styles.customDurationInput, { borderColor: primaryColor }]}
                    value={customDuration}
                    onChangeText={handleCustomDurationChange}
                    placeholder="Enter minutes"
                    placeholderTextColor={colors.neutral.textMuted}
                    keyboardType="number-pad"
                    maxLength={3}
                  />
                  <Text style={styles.customDurationUnit}>minutes</Text>
                  <Text style={styles.customDurationHint}>(15-240)</Text>
                </View>
              )}
            </View>
          </View>

          {/* Recurrence Selection - Only show for create mode */}
          {mode === 'create' && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Repeat</Text>
              <View style={styles.recurrenceGrid}>
                {RECURRENCE_OPTIONS.map((option) => (
                  <Pressable
                    key={option.value}
                    style={[
                      styles.recurrenceButton,
                      recurrence === option.value && {
                        borderColor: primaryColor,
                        backgroundColor: primaryColor + '15',
                      },
                    ]}
                    onPress={() => setRecurrence(option.value)}
                  >
                    <Text
                      style={[
                        styles.recurrenceLabel,
                        recurrence === option.value && {
                          color: primaryColor,
                          fontWeight: typography.weights.semibold,
                        },
                      ]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.recurrenceDesc}>{option.description}</Text>
                  </Pressable>
                ))}
              </View>

              {/* End Date for Recurring Lessons */}
              {recurrence !== 'none' && (
                <View style={styles.recurrenceEndContainer}>
                  <Text style={styles.recurrenceEndLabel}>
                    Repeat until (optional):
                  </Text>
                  <View style={styles.recurrenceEndOptions}>
                    <Pressable
                      style={[
                        styles.recurrenceEndButton,
                        !recurrenceEndDate && styles.recurrenceEndButtonActive,
                      ]}
                      onPress={() => setRecurrenceEndDate(null)}
                    >
                      <Text style={[
                        styles.recurrenceEndButtonText,
                        !recurrenceEndDate && { color: primaryColor },
                      ]}>
                        No end date
                      </Text>
                    </Pressable>
                    {[4, 8, 12].map((weeks) => {
                      const baseDate = selectedDates[0] || new Date();
                      const endDate = new Date(baseDate);
                      endDate.setDate(endDate.getDate() + weeks * 7);
                      const isSelected = recurrenceEndDate?.toDateString() === endDate.toDateString();
                      return (
                        <Pressable
                          key={weeks}
                          style={[
                            styles.recurrenceEndButton,
                            isSelected && styles.recurrenceEndButtonActive,
                          ]}
                          onPress={() => setRecurrenceEndDate(endDate)}
                        >
                          <Text style={[
                            styles.recurrenceEndButtonText,
                            isSelected && { color: primaryColor },
                          ]}>
                            {weeks} weeks
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {recurrenceEndDate && (
                    <Text style={styles.recurrenceEndInfo}>
                      Ends: {recurrenceEndDate.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })}
                    </Text>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Notes */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Notes (optional)</Text>
            <TextInput
              style={[styles.textInput, styles.textArea]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any notes for this lesson..."
              placeholderTextColor={colors.neutral.textMuted}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.footer}>
          {mode === 'create' && getTotalLessonsCount() > 1 && (
            <Text style={styles.lessonCountInfo}>
              {getTotalLessonsCount()} lessons will be created
            </Text>
          )}
          <Pressable
            style={[
              styles.submitButton,
              { backgroundColor: primaryColor },
              submitting && styles.submitButtonDisabled
            ]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.neutral.white} />
            ) : (
              <>
                <Ionicons
                  name={mode === 'create' ? 'add-circle' : 'checkmark-circle'}
                  size={20}
                  color={colors.neutral.white}
                />
                <Text style={styles.submitButtonText}>
                  {mode === 'create'
                    ? createAsSession
                      ? `Schedule Combined Session`
                      : recurrence !== 'none'
                        ? 'Schedule Recurring Lessons'
                        : getTotalLessonsCount() > 1
                          ? `Schedule ${getTotalLessonsCount()} Lessons`
                          : 'Schedule Lesson'
                    : 'Save Changes'}
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
  selectedCount: {
    color: colors.neutral.textMuted,
    textTransform: 'none',
  },
  // Search styles
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    paddingVertical: spacing.xs,
  },
  // Student list styles
  studentList: {
    gap: spacing.sm,
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
    gap: spacing.sm,
  },
  studentHeaderSelected: {
    backgroundColor: colors.neutral.background,
  },
  studentCheckbox: {
    marginRight: spacing.xs,
  },
  studentAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  studentInitial: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  parentName: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  // Subject selection within student card
  subjectSelection: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.borderLight,
  },
  subjectSelectionLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  subjectChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.full,
    borderWidth: 1.5,
    borderColor: colors.neutral.border,
  },
  subjectIcon: {
    fontSize: 14,
  },
  subjectChipLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  subjectChipLabelSelected: {
    color: colors.neutral.white,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  // Session toggle styles
  sessionToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    ...shadows.sm,
  },
  sessionToggleActive: {
    borderColor: colors.piano.primary,
    backgroundColor: colors.piano.subtle,
  },
  sessionToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  sessionToggleText: {
    flex: 1,
  },
  sessionToggleTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  sessionToggleDesc: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  sessionToggleCheckbox: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionPreview: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  sessionPreviewText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
  },
  // Calendar styles
  calendarContainer: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  calendarNavButton: {
    padding: spacing.xs,
  },
  calendarMonthTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textMuted,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarDay: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  calendarDayToday: {
    borderWidth: 2,
    borderColor: colors.neutral.border,
  },
  calendarDayPast: {
    opacity: 0.4,
  },
  calendarDayText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  calendarDayTextSelected: {
    color: colors.neutral.white,
    fontWeight: typography.weights.bold,
  },
  calendarDayTextPast: {
    color: colors.neutral.textMuted,
  },
  selectedDateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  selectedDateText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
  },
  selectedDatesContainer: {
    flex: 1,
  },
  selectedDatesChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    alignItems: 'center',
  },
  selectedDateChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  selectedDateChipText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  selectedDateMore: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    marginLeft: spacing.xs,
  },
  calendarDayContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDayCheck: {
    position: 'absolute',
    bottom: -2,
    right: -4,
  },
  multiDateHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  multiDateHintText: {
    flex: 1,
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
  },
  clearDatesButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  clearDatesText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
  },
  // Time styles
  timeSelector: {
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
  timeSelectorText: {
    flex: 1,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  timePickerContainer: {
    marginTop: spacing.sm,
  },
  timeSlotsList: {
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  timeSlot: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral.border,
  },
  timeSlotText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  timeSlotTextSelected: {
    color: colors.neutral.white,
  },
  // Custom time styles
  customTimeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral.border,
  },
  customTimeToggleText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  customTimeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
  },
  customTimeInputGroup: {
    alignItems: 'center',
  },
  customTimeLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginBottom: spacing.xs,
  },
  customTimeInput: {
    width: 60,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderWidth: 2,
    borderRadius: borderRadius.md,
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    textAlign: 'center',
    backgroundColor: colors.neutral.white,
  },
  customTimeHint: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
  },
  customTimeSeparator: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginTop: spacing.md,
  },
  customTimeApplyButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
    marginTop: spacing.md,
  },
  // Duration styles
  durationContainer: {
    gap: spacing.sm,
  },
  durationGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  durationButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral.border,
  },
  durationLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  customDurationToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral.border,
  },
  customDurationToggleText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  customDurationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  customDurationInput: {
    width: 80,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 2,
    borderRadius: borderRadius.md,
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    textAlign: 'center',
  },
  customDurationUnit: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
  customDurationHint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  // Recurrence styles
  recurrenceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  recurrenceButton: {
    width: '48%',
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: colors.neutral.border,
  },
  recurrenceLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  recurrenceDesc: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  recurrenceEndContainer: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
  },
  recurrenceEndLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  recurrenceEndOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  recurrenceEndButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.background,
  },
  recurrenceEndButtonActive: {
    backgroundColor: colors.neutral.border,
  },
  recurrenceEndButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  recurrenceEndInfo: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: spacing.sm,
    fontStyle: 'italic',
  },
  // Input styles
  textInput: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  textArea: {
    minHeight: 80,
    paddingTop: spacing.md,
  },
  // Error styles
  errorContainer: {
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
  // Footer styles
  footer: {
    padding: spacing.base,
    backgroundColor: colors.neutral.white,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  lessonCountInfo: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
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

export default LessonFormModal;
