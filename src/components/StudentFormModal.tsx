/**
 * StudentFormModal
 * Modal form for creating and editing students
 */

import React, { useState, useEffect } from 'react';
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
}

const GRADE_OPTIONS = [
  { value: 'K', label: 'Kindergarten' },
  { value: '1st', label: '1st Grade' },
  { value: '2nd', label: '2nd Grade' },
  { value: '3rd', label: '3rd Grade' },
  { value: '4th', label: '4th Grade' },
  { value: '5th', label: '5th Grade' },
  { value: '6th', label: '6th Grade' },
];

export function StudentFormModal({
  visible,
  onClose,
  onSave,
  student,
  parents,
  loading = false,
}: StudentFormModalProps) {
  const isEditing = !!student;

  // Form state
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [gradeLevel, setGradeLevel] = useState('');
  const [parentId, setParentId] = useState('');

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when modal opens/closes or student changes
  useEffect(() => {
    if (visible) {
      if (student) {
        setName(student.name);
        setAge(student.age.toString());
        setGradeLevel(student.grade_level);
        setParentId(student.parent_id);
      } else {
        setName('');
        setAge('');
        setGradeLevel('');
        setParentId(parents.length === 1 ? parents[0].id : '');
      }
      setErrors({});
    }
  }, [visible, student, parents]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Name is required';
    }

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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const data: CreateStudentInput | UpdateStudentInput = {
      name: name.trim(),
      age: parseInt(age, 10),
      grade_level: gradeLevel,
      parent_id: parentId,
    };

    const success = await onSave(data);
    if (success) {
      onClose();
    }
  };

  const handleClose = () => {
    if (name || age || gradeLevel) {
      Alert.alert(
        'Discard Changes?',
        'You have unsaved changes. Are you sure you want to discard them?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: onClose },
        ]
      );
    } else {
      onClose();
    }
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
            {isEditing ? 'Edit Student' : 'Add Student'}
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

          {/* Grade Level Selector */}
          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Grade Level</Text>
            <View style={styles.gradeGrid}>
              {GRADE_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.gradeOption,
                    gradeLevel === option.value && styles.gradeOptionSelected,
                  ]}
                  onPress={() => setGradeLevel(option.value)}
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
            {errors.gradeLevel && (
              <Text style={styles.errorText}>{errors.gradeLevel}</Text>
            )}
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
                        {parent.name}
                      </Text>
                      <Text style={styles.parentEmail}>{parent.email}</Text>
                    </View>
                    {parentId === parent.id && (
                      <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color={colors.piano.primary}
                      />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {errors.parentId && (
              <Text style={styles.errorText}>{errors.parentId}</Text>
            )}
          </View>

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
            disabled={loading || parents.length === 0}
            style={styles.saveButton}
          />
        </View>
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
});

export default StudentFormModal;
