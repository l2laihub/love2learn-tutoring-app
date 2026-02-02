/**
 * StudentFormModal
 * Modal form for creating and editing students
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Pressable,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Input } from './ui/Input';
import { Button } from './ui/Button';
import { colors, spacing, typography, borderRadius } from '../theme';
import { Student, Parent, CreateStudentInput, UpdateStudentInput } from '../types/database';

interface StudentFormModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: (data: CreateStudentInput | UpdateStudentInput) => Promise<boolean>;
  student?: Student | null;
  parents: Parent[];
  loading?: boolean;
  /** If true, shows only name and birthday fields for parent editing */
  parentEditMode?: boolean;
}

const GRADE_OPTIONS = [
  { value: 'Preschool', label: 'Preschool' },
  { value: 'K', label: 'Kindergarten' },
  { value: '1st', label: '1st Grade' },
  { value: '2nd', label: '2nd Grade' },
  { value: '3rd', label: '3rd Grade' },
  { value: '4th', label: '4th Grade' },
  { value: '5th', label: '5th Grade' },
  { value: '6th', label: '6th Grade' },
  { value: '7th', label: '7th Grade' },
  { value: '8th', label: '8th Grade' },
  { value: '9th', label: '9th Grade' },
  { value: '10th', label: '10th Grade' },
  { value: '11th', label: '11th Grade' },
  { value: '12th', label: '12th Grade' },
];

const SUBJECT_OPTIONS = [
  { value: 'piano', label: 'Piano', icon: 'musical-notes', color: colors.piano.primary },
  { value: 'math', label: 'Math', icon: 'calculator', color: colors.math.primary },
  { value: 'reading', label: 'Reading', icon: 'book', color: '#9C27B0' },
  { value: 'speech', label: 'Speech', icon: 'mic', color: '#FF9800' },
  { value: 'english', label: 'English', icon: 'language', color: '#2196F3' },
];

// Helper function to calculate age from birthday
function calculateAgeFromBirthday(birthday: string | null): number | null {
  if (!birthday) return null;
  const birthDate = new Date(birthday);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// Helper function to suggest grade level from birthday
function suggestGradeFromBirthday(birthday: string | null): string | null {
  if (!birthday) return null;

  const birthDate = new Date(birthday);
  const today = new Date();

  // Determine school year start date (September 1st)
  let schoolYearStart: Date;
  if (today.getMonth() >= 8) { // September or later
    schoolYearStart = new Date(today.getFullYear(), 8, 1); // Sept 1 of current year
  } else {
    schoolYearStart = new Date(today.getFullYear() - 1, 8, 1); // Sept 1 of previous year
  }

  // Calculate age at school year start
  let ageAtSchoolStart = schoolYearStart.getFullYear() - birthDate.getFullYear();
  const monthDiff = schoolYearStart.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && schoolYearStart.getDate() < birthDate.getDate())) {
    ageAtSchoolStart--;
  }

  // Map age to grade level
  const ageToGrade: Record<number, string> = {
    3: 'Preschool',
    4: 'Preschool',
    5: 'K',
    6: '1st',
    7: '2nd',
    8: '3rd',
    9: '4th',
    10: '5th',
    11: '6th',
    12: '7th',
    13: '8th',
    14: '9th',
    15: '10th',
    16: '11th',
    17: '12th',
  };

  if (ageAtSchoolStart < 3) return 'Preschool';
  if (ageAtSchoolStart > 17) return '12th';
  return ageToGrade[ageAtSchoolStart] || null;
}

// Format date for display (MM/DD/YYYY)
function formatDateForDisplay(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}/${date.getFullYear()}`;
}

// Parse date from display format (MM/DD/YYYY) to ISO format (YYYY-MM-DD)
function parseDateFromDisplay(displayDate: string): string | null {
  const match = displayDate.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  if (isNaN(date.getTime())) return null;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

export function StudentFormModal({
  visible,
  onClose,
  onSave,
  student,
  parents,
  loading = false,
  parentEditMode = false,
}: StudentFormModalProps) {
  const isEditing = !!student;

  // Form state
  const [name, setName] = useState('');
  const [birthday, setBirthday] = useState('');
  const [birthdayDisplay, setBirthdayDisplay] = useState('');
  const [age, setAge] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [parentId, setParentId] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [autoGradeEnabled, setAutoGradeEnabled] = useState(true);

  // Confirmation dialog state (for web platform)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Track original values to detect actual changes
  const originalValues = useRef({
    name: '',
    birthday: '',
    age: '',
    gradeLevel: '',
    parentId: '',
    subjects: [] as string[]
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes or student changes
  useEffect(() => {
    if (visible) {
      if (student) {
        setName(student.name ?? '');
        setBirthday(student.birthday || '');
        setBirthdayDisplay(formatDateForDisplay(student.birthday || null));
        setAge(student.age?.toString() ?? '');
        setGradeLevel(student.grade_level);
        setParentId(student.parent_id);
        setSubjects(student.subjects || []);
        setAutoGradeEnabled(!!student.birthday);
        // Store original values for change detection
        originalValues.current = {
          name: student.name ?? '',
          birthday: student.birthday || '',
          age: student.age.toString(),
          gradeLevel: student.grade_level,
          parentId: student.parent_id,
          subjects: student.subjects || [],
        };
      } else {
        setName('');
        setBirthday('');
        setBirthdayDisplay('');
        setAge('');
        setGradeLevel('');
        setParentId(parents.length === 1 ? parents[0].id : '');
        setSubjects([]);
        setAutoGradeEnabled(true);
        // Store original values for change detection
        originalValues.current = {
          name: '',
          birthday: '',
          age: '',
          gradeLevel: '',
          parentId: parents.length === 1 ? parents[0].id : '',
          subjects: [],
        };
      }
      setErrors({});
      setShowConfirmDialog(false);
    }
  }, [visible, student, parents]);

  // Update age and grade level when birthday changes
  const handleBirthdayChange = (text: string) => {
    // Allow only numbers and forward slashes
    const cleaned = text.replace(/[^0-9/]/g, '');

    // Auto-format as user types (MM/DD/YYYY)
    let formatted = cleaned;
    if (cleaned.length >= 2 && !cleaned.includes('/')) {
      formatted = cleaned.slice(0, 2) + '/' + cleaned.slice(2);
    }
    if (cleaned.replace(/\//g, '').length >= 4 && formatted.split('/').length === 2) {
      const parts = formatted.split('/');
      formatted = parts[0] + '/' + parts[1].slice(0, 2) + '/' + parts[1].slice(2);
    }

    setBirthdayDisplay(formatted);

    // Try to parse the date
    const isoDate = parseDateFromDisplay(formatted);
    if (isoDate) {
      setBirthday(isoDate);

      // Auto-calculate age
      const calculatedAge = calculateAgeFromBirthday(isoDate);
      if (calculatedAge !== null && calculatedAge >= 0 && calculatedAge <= 100) {
        setAge(calculatedAge.toString());

        // Auto-suggest grade level if enabled
        if (autoGradeEnabled) {
          const suggestedGrade = suggestGradeFromBirthday(isoDate);
          if (suggestedGrade) {
            setGradeLevel(suggestedGrade);
          }
        }
      }
    } else {
      setBirthday('');
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

    // In parent edit mode, only validate name and birthday
    if (parentEditMode) {
      // Birthday is optional but if provided must be valid
      if (birthdayDisplay && !birthday) {
        newErrors.birthday = 'Invalid date format (use MM/DD/YYYY)';
      }
    } else {
      // Full validation for admin mode
      const ageNum = parseInt(age, 10);
      if (!age || isNaN(ageNum)) {
        newErrors.age = 'Age is required';
      } else if (ageNum < 3 || ageNum > 18) {
        newErrors.age = 'Age must be between 3 and 18';
      }

      if (!gradeLevel) {
        newErrors.gradeLevel = 'Grade level is required';
      }

      if (!parentId) {
        newErrors.parentId = 'Parent is required';
      }

      if (subjects.length === 0) {
        newErrors.subjects = 'At least one subject is required';
      }

      // Birthday validation (optional but must be valid if provided)
      if (birthdayDisplay && !birthday) {
        newErrors.birthday = 'Invalid date format (use MM/DD/YYYY)';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    let data: CreateStudentInput | UpdateStudentInput;

    if (parentEditMode) {
      // Parent can update name, birthday, and grade level
      data = {
        name: name.trim(),
        birthday: birthday || null,
        grade_level: gradeLevel,
        // Include age if birthday is set
        ...(birthday && { age: calculateAgeFromBirthday(birthday) || parseInt(age, 10) }),
      } as UpdateStudentInput;
    } else {
      data = {
        name: name.trim(),
        age: parseInt(age, 10),
        grade_level: gradeLevel,
        parent_id: parentId,
        subjects: subjects,
        birthday: birthday || null,
      };
    }

    const success = await onSave(data);
    if (success) {
      onClose();
    }
  };

  // Check if form has unsaved changes
  const hasChanges = (): boolean => {
    const orig = originalValues.current;
    const subjectsChanged =
      subjects.length !== orig.subjects.length ||
      subjects.some((s) => !orig.subjects.includes(s));

    return (
      name !== orig.name ||
      birthday !== orig.birthday ||
      age !== orig.age ||
      gradeLevel !== orig.gradeLevel ||
      parentId !== orig.parentId ||
      subjectsChanged
    );
  };

  const handleClose = () => {
    if (hasChanges()) {
      // On web, Alert.alert doesn't work well, so use a custom dialog
      if (Platform.OS === 'web') {
        setShowConfirmDialog(true);
      } else {
        Alert.alert(
          'Discard Changes?',
          'You have unsaved changes. Are you sure you want to discard them?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Discard', style: 'destructive', onPress: onClose },
          ]
        );
      }
    } else {
      onClose();
    }
  };

  const handleConfirmDiscard = () => {
    setShowConfirmDialog(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={colors.neutral.text} />
          </TouchableOpacity>
          <Text style={styles.title}>
            {parentEditMode
              ? 'Edit Child Info'
              : isEditing
                ? 'Edit Student'
                : 'Add Student'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Name Input */}
          <Input
            label="Student Name"
            placeholder="Enter student's full name"
            value={name}
            onChangeText={setName}
            error={errors.name}
            autoCapitalize="words"
            autoFocus
          />

          {/* Birthday Input */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Birthday</Text>
            <Input
              placeholder="MM/DD/YYYY"
              value={birthdayDisplay}
              onChangeText={handleBirthdayChange}
              error={errors.birthday}
              keyboardType="number-pad"
              maxLength={10}
            />
            {birthday ? (
              <View style={styles.birthdayInfo}>
                <Ionicons name="information-circle" size={16} color={colors.primary.main} />
                <Text style={styles.birthdayInfoText}>
                  Age will be calculated as {calculateAgeFromBirthday(birthday)} years old
                </Text>
              </View>
            ) : null}
          </View>

          {/* Grade Level Selector - shown for both parent and admin edit modes */}
          <View style={styles.fieldContainer}>
            <View style={styles.gradeLevelHeader}>
              <Text style={styles.label}>Grade Level</Text>
              {birthday ? (
                <Pressable
                  style={styles.autoGradeToggle}
                  onPress={() => setAutoGradeEnabled(!autoGradeEnabled)}
                >
                  <Ionicons
                    name={autoGradeEnabled ? 'checkbox' : 'square-outline'}
                    size={18}
                    color={autoGradeEnabled ? colors.primary.main : colors.neutral.textMuted}
                  />
                  <Text style={[
                    styles.autoGradeText,
                    autoGradeEnabled && styles.autoGradeTextActive
                  ]}>
                    Auto from birthday
                  </Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.gradeGrid}>
              {GRADE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.gradeOption,
                    gradeLevel === option.value && styles.gradeOptionSelected,
                  ]}
                  onPress={() => {
                    setGradeLevel(option.value);
                    setAutoGradeEnabled(false); // Disable auto when manually selected
                  }}
                >
                  <Text
                    style={[
                      styles.gradeOptionText,
                      gradeLevel === option.value && styles.gradeOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {errors.gradeLevel ? (
              <Text style={styles.errorText}>{errors.gradeLevel}</Text>
            ) : null}
          </View>

          {/* Show remaining fields only for admin (not parent edit mode) */}
          {!parentEditMode && (
            <>
              {/* Age Input */}
              <Input
                label="Age"
                placeholder="Enter age"
                value={age}
                onChangeText={(text) => setAge(text.replace(/[^0-9]/g, ''))}
                error={errors.age}
                keyboardType="number-pad"
                maxLength={2}
              />

              {/* Subjects Selector */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Subjects</Text>
                <View style={styles.subjectsGrid}>
                  {SUBJECT_OPTIONS.map((option) => {
                    const isSelected = subjects.includes(option.value);
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.subjectOption,
                          isSelected && { backgroundColor: option.color + '20', borderColor: option.color },
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setSubjects(subjects.filter((s) => s !== option.value));
                          } else {
                            setSubjects([...subjects, option.value]);
                          }
                        }}
                      >
                        <Ionicons
                          name={option.icon as any}
                          size={18}
                          color={isSelected ? option.color : colors.neutral.textMuted}
                        />
                        <Text
                          style={[
                            styles.subjectOptionText,
                            isSelected && { color: option.color, fontWeight: typography.weights.medium },
                          ]}
                        >
                          {option.label}
                        </Text>
                        {isSelected ? (
                          <Ionicons name="checkmark-circle" size={16} color={option.color} />
                        ) : null}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.subjects ? (
                  <Text style={styles.errorText}>{errors.subjects}</Text>
                ) : null}
              </View>

              {/* Parent Selector */}
              <View style={styles.fieldContainer}>
                <Text style={styles.label}>Parent/Guardian</Text>
                {parents.length === 0 ? (
                  <View style={styles.noParentsWarning}>
                    <Ionicons name="warning" size={20} color={colors.status.warning} />
                    <Text style={styles.noParentsText}>
                      No parents available. Please add a parent first.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.parentsList}>
                    {parents.map((parent) => (
                      <TouchableOpacity
                        key={parent.id}
                        style={[
                          styles.parentOption,
                          parentId === parent.id && styles.parentOptionSelected,
                        ]}
                        onPress={() => setParentId(parent.id)}
                      >
                        <View style={styles.parentInfo}>
                          <Text
                            style={[
                              styles.parentName,
                              parentId === parent.id && styles.parentNameSelected,
                            ]}
                          >
                            {parent.name ?? 'Parent'}
                          </Text>
                          <Text style={styles.parentEmail}>{parent.email ?? ''}</Text>
                        </View>
                        {parentId === parent.id ? (
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={colors.piano.primary}
                          />
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                {errors.parentId ? (
                  <Text style={styles.errorText}>{errors.parentId}</Text>
                ) : null}
              </View>
            </>
          )}

          {/* Bottom Spacing */}
          <View style={styles.bottomSpacer} />
        </ScrollView>

        {/* Footer */}
        <View style={styles.footer}>
          <Button
            title="Cancel"
            onPress={handleClose}
            variant="outline"
            style={styles.cancelButton}
          />
          <Button
            title={isEditing ? 'Save Changes' : 'Add Student'}
            onPress={handleSave}
            loading={loading}
            disabled={loading || (!parentEditMode && parents.length === 0)}
            style={styles.saveButton}
          />
        </View>

        {/* Confirmation Dialog for Web */}
        {showConfirmDialog && (
          <View style={styles.confirmOverlay}>
            <View style={styles.confirmDialog}>
              <Text style={styles.confirmTitle}>Discard Changes?</Text>
              <Text style={styles.confirmMessage}>
                You have unsaved changes. Are you sure you want to discard them?
              </Text>
              <View style={styles.confirmButtons}>
                <TouchableOpacity
                  style={styles.confirmButtonCancel}
                  onPress={() => setShowConfirmDialog(false)}
                >
                  <Text style={styles.confirmButtonCancelText}>Keep Editing</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.confirmButtonDiscard}
                  onPress={handleConfirmDiscard}
                >
                  <Text style={styles.confirmButtonDiscardText}>Discard</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  closeButton: {
    padding: spacing.sm,
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
    padding: spacing.lg,
  },
  fieldContainer: {
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  birthdayInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  birthdayInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.primary.main,
  },
  gradeLevelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  autoGradeToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  autoGradeText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  autoGradeTextActive: {
    color: colors.primary.main,
  },
  gradeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  gradeOption: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  gradeOptionSelected: {
    backgroundColor: colors.piano.subtle,
    borderColor: colors.piano.primary,
  },
  gradeOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  gradeOptionTextSelected: {
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  subjectsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  subjectOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    gap: spacing.xs,
  },
  subjectOptionText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  parentsList: {
    gap: spacing.sm,
  },
  parentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral.background,
    borderWidth: 1,
    borderColor: colors.neutral.border,
  },
  parentOptionSelected: {
    backgroundColor: colors.piano.subtle,
    borderColor: colors.piano.primary,
  },
  parentInfo: {
    flex: 1,
  },
  parentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  parentNameSelected: {
    color: colors.piano.primary,
  },
  parentEmail: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  noParentsWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.status.warningBg,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  noParentsText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.status.warning,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    marginTop: spacing.xs,
  },
  bottomSpacer: {
    height: 100,
  },
  footer: {
    flexDirection: 'row',
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    backgroundColor: colors.neutral.surface,
    gap: spacing.md,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 2,
  },

  // Confirmation Dialog Styles
  confirmOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  confirmDialog: {
    backgroundColor: colors.neutral.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    width: '85%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 10,
  },
  confirmTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  confirmMessage: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  confirmButtons: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  confirmButtonCancel: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    alignItems: 'center',
  },
  confirmButtonCancelText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  confirmButtonDiscard: {
    flex: 1,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: colors.status.error,
    alignItems: 'center',
  },
  confirmButtonDiscardText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: '#FFFFFF',
  },
});

export default StudentFormModal;
