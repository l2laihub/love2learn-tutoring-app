/**
 * WorksheetGeneratorModal
 * Modal for generating piano and math worksheets
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { StudentWithParent, PianoWorksheetConfig, MathWorksheetConfig, TutoringSubject } from '../types/database';

// Export config type for external use
export type WorksheetConfig = PianoWorksheetConfig | MathWorksheetConfig;

export interface WorksheetGeneratorModalProps {
  visible: boolean;
  onClose: () => void;
  onGenerate: (config: WorksheetConfig, studentId: string) => Promise<void>;
  onGenerateMultiple?: (config: WorksheetConfig, studentIds: string[]) => Promise<void>;
  students: StudentWithParent[];
  studentsLoading?: boolean;
  presetSubject?: TutoringSubject;
  allowMultiSelect?: boolean;
}

type WorksheetType = 'piano_naming' | 'piano_drawing' | 'math';
type Step = 'type' | 'student' | 'config';

// Piano configuration options
const CLEF_OPTIONS = [
  { value: 'treble', label: 'Treble Clef', icon: '🎼' },
  { value: 'bass', label: 'Bass Clef', icon: '🎵' },
  { value: 'grand', label: 'Grand Staff', icon: '🎹' },
];

const PIANO_DIFFICULTY = [
  { value: 'beginner', label: 'Beginner', description: 'Middle C area' },
  { value: 'elementary', label: 'Elementary', description: 'Expanded range' },
  { value: 'intermediate', label: 'Intermediate', description: 'Full staff' },
  { value: 'advanced', label: 'Advanced', description: 'Ledger lines' },
];

const ACCIDENTALS_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'sharps', label: 'Sharps ♯' },
  { value: 'flats', label: 'Flats ♭' },
  { value: 'mixed', label: 'Mixed' },
];

// Math configuration options
const GRADE_OPTIONS = [
  { value: 0, label: 'Kindergarten' },
  { value: 1, label: 'Grade 1' },
  { value: 2, label: 'Grade 2' },
  { value: 3, label: 'Grade 3' },
  { value: 4, label: 'Grade 4' },
  { value: 5, label: 'Grade 5' },
  { value: 6, label: 'Grade 6' },
];

const MATH_TOPICS = [
  { value: 'addition', label: 'Addition', icon: '+' },
  { value: 'subtraction', label: 'Subtraction', icon: '−' },
  { value: 'multiplication', label: 'Multiplication', icon: '×' },
  { value: 'division', label: 'Division', icon: '÷' },
  { value: 'mixed', label: 'Mixed Operations', icon: '±' },
  { value: 'fractions', label: 'Fractions', icon: '½' },
  { value: 'word_problems', label: 'Word Problems', icon: '📝' },
];

const PROBLEM_COUNT_OPTIONS = [10, 15, 20, 25];

export function WorksheetGeneratorModal({
  visible,
  onClose,
  onGenerate,
  onGenerateMultiple,
  students,
  studentsLoading = false,
  presetSubject,
  allowMultiSelect = true,
}: WorksheetGeneratorModalProps) {
  const [step, setStep] = useState<Step>('type');
  const [worksheetType, setWorksheetType] = useState<WorksheetType | null>(
    presetSubject === 'piano' ? 'piano_naming' : presetSubject === 'math' ? 'math' : null
  );
  const [selectedStudent, setSelectedStudent] = useState<string>('');
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Piano config state
  const [clef, setClef] = useState<'treble' | 'bass' | 'grand'>('treble');
  const [pianoDifficulty, setPianoDifficulty] = useState<'beginner' | 'elementary' | 'intermediate' | 'advanced'>('beginner');
  const [accidentals, setAccidentals] = useState<'none' | 'sharps' | 'flats' | 'mixed'>('none');
  const [pianoProblemCount, setPianoProblemCount] = useState<10 | 15 | 20>(10);

  // Math config state
  const [grade, setGrade] = useState<number>(1);
  const [mathTopic, setMathTopic] = useState<string>('addition');
  const [mathProblemCount, setMathProblemCount] = useState<10 | 15 | 20 | 25>(15);
  const [includeWordProblems, setIncludeWordProblems] = useState(false);
  const [includeVisualAids, setIncludeVisualAids] = useState(true);

  const handleClose = () => {
    setStep('type');
    setWorksheetType(null);
    setSelectedStudent('');
    setSelectedStudents([]);
    setIsMultiSelectMode(false);
    setError(null);
    onClose();
  };

  const handleBack = () => {
    if (step === 'config') setStep('student');
    else if (step === 'student') setStep('type');
  };

  const handleSelectType = (type: WorksheetType) => {
    setWorksheetType(type);
    setStep('student');
  };

  const handleSelectStudent = (studentId: string) => {
    if (isMultiSelectMode) {
      // Toggle selection in multi-select mode
      setSelectedStudents(prev =>
        prev.includes(studentId)
          ? prev.filter(id => id !== studentId)
          : [...prev, studentId]
      );
    } else {
      // Single select mode - proceed to config
      setSelectedStudent(studentId);
      setStep('config');
    }
  };

  const handleToggleSelectAll = () => {
    if (selectedStudents.length === filteredStudents.length) {
      setSelectedStudents([]);
    } else {
      setSelectedStudents(filteredStudents.map(s => s.id));
    }
  };

  const handleProceedWithMultiple = () => {
    if (selectedStudents.length > 0) {
      setStep('config');
    }
  };

  const handleGenerate = async () => {
    const hasSelection = isMultiSelectMode ? selectedStudents.length > 0 : !!selectedStudent;
    if (!worksheetType || !hasSelection) return;

    setGenerating(true);
    setError(null);

    try {
      let config: PianoWorksheetConfig | MathWorksheetConfig;

      if (worksheetType === 'piano_naming' || worksheetType === 'piano_drawing') {
        config = {
          type: worksheetType === 'piano_naming' ? 'note_naming' : 'note_drawing',
          clef,
          difficulty: pianoDifficulty,
          problemCount: pianoProblemCount,
          accidentals,
        } as PianoWorksheetConfig;
      } else {
        config = {
          grade: grade as 0 | 1 | 2 | 3 | 4 | 5 | 6,
          topic: mathTopic,
          problemCount: mathProblemCount,
          includeWordProblems,
          includeVisualAids,
        } as MathWorksheetConfig;
      }

      if (isMultiSelectMode && selectedStudents.length > 0) {
        // Generate for multiple students
        if (onGenerateMultiple) {
          await onGenerateMultiple(config, selectedStudents);
        } else {
          // Fallback: generate for each student sequentially
          for (const studentId of selectedStudents) {
            await onGenerate(config, studentId);
          }
        }
      } else {
        await onGenerate(config, selectedStudent);
      }
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate worksheet');
    } finally {
      setGenerating(false);
    }
  };

  // Filter students based on worksheet type
  const filteredStudents = students.filter(student => {
    if (!worksheetType) return true;
    const subjects = student.subjects || [];
    if (worksheetType.startsWith('piano')) {
      return subjects.includes('piano') || subjects.length === 0;
    }
    return subjects.includes('math') || subjects.length === 0;
  });

  const renderTypeSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Choose Worksheet Type</Text>
      <Text style={styles.stepSubtitle}>Select the type of worksheet to generate</Text>

      <View style={styles.typeGrid}>
        <Pressable
          style={styles.typeCard}
          onPress={() => handleSelectType('piano_naming')}
        >
          <View style={[styles.typeIcon, { backgroundColor: colors.piano.subtle }]}>
            <Text style={styles.typeEmoji}>🎼</Text>
          </View>
          <Text style={styles.typeLabel}>Note Naming</Text>
          <Text style={styles.typeDescription}>
            Identify notes on the staff
          </Text>
        </Pressable>

        <Pressable
          style={styles.typeCard}
          onPress={() => handleSelectType('piano_drawing')}
        >
          <View style={[styles.typeIcon, { backgroundColor: colors.piano.subtle }]}>
            <Text style={styles.typeEmoji}>✏️</Text>
          </View>
          <Text style={styles.typeLabel}>Note Drawing</Text>
          <Text style={styles.typeDescription}>
            Draw notes on the staff
          </Text>
        </Pressable>

        <Pressable
          style={[styles.typeCard, styles.typeCardWide]}
          onPress={() => handleSelectType('math')}
        >
          <View style={[styles.typeIcon, { backgroundColor: colors.math.subtle }]}>
            <Text style={styles.typeEmoji}>➗</Text>
          </View>
          <Text style={styles.typeLabel}>Math Worksheet</Text>
          <Text style={styles.typeDescription}>
            Addition, subtraction, multiplication & more
          </Text>
        </Pressable>
      </View>
    </View>
  );

  const renderStudentSelection = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>
        {isMultiSelectMode ? 'Select Students' : 'Select Student'}
      </Text>
      <Text style={styles.stepSubtitle}>
        {isMultiSelectMode
          ? `Choose students for this worksheet (${selectedStudents.length} selected)`
          : 'Choose the student for this worksheet'}
      </Text>

      {/* Multi-select toggle */}
      {allowMultiSelect && filteredStudents.length > 1 && (
        <View style={styles.multiSelectToggle}>
          <Pressable
            style={[
              styles.multiSelectButton,
              isMultiSelectMode && styles.multiSelectButtonActive,
            ]}
            onPress={() => {
              setIsMultiSelectMode(!isMultiSelectMode);
              if (!isMultiSelectMode) {
                setSelectedStudents([]);
              }
            }}
          >
            <Ionicons
              name={isMultiSelectMode ? 'checkbox' : 'checkbox-outline'}
              size={18}
              color={isMultiSelectMode ? colors.piano.primary : colors.neutral.textMuted}
            />
            <Text
              style={[
                styles.multiSelectButtonText,
                isMultiSelectMode && styles.multiSelectButtonTextActive,
              ]}
            >
              Assign to Multiple Students
            </Text>
          </Pressable>

          {isMultiSelectMode && (
            <Pressable style={styles.selectAllButton} onPress={handleToggleSelectAll}>
              <Text style={styles.selectAllText}>
                {selectedStudents.length === filteredStudents.length ? 'Deselect All' : 'Select All'}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {studentsLoading ? (
        <ActivityIndicator size="large" color={colors.piano.primary} />
      ) : filteredStudents.length === 0 ? (
        <View style={styles.emptyCard}>
          <Ionicons name="person-outline" size={48} color={colors.neutral.textMuted} />
          <Text style={styles.emptyText}>
            No students found for {worksheetType?.startsWith('piano') ? 'piano' : 'math'}
          </Text>
        </View>
      ) : (
        <View style={styles.studentList}>
          {filteredStudents.map((student) => {
            const isSelected = isMultiSelectMode
              ? selectedStudents.includes(student.id)
              : selectedStudent === student.id;

            return (
              <Pressable
                key={student.id}
                style={[
                  styles.studentCard,
                  isMultiSelectMode && isSelected && styles.studentCardSelected,
                ]}
                onPress={() => handleSelectStudent(student.id)}
              >
                {isMultiSelectMode && (
                  <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color={colors.neutral.white} />
                    )}
                  </View>
                )}
                <View style={styles.studentAvatar}>
                  <Text style={styles.studentInitial}>
                    {student.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.studentInfo}>
                  <Text style={styles.studentName}>{student.name}</Text>
                  <Text style={styles.studentGrade}>
                    Grade {student.grade_level} • Age {student.age}
                  </Text>
                </View>
                {!isMultiSelectMode && (
                  <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
                )}
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Multi-select proceed button */}
      {isMultiSelectMode && selectedStudents.length > 0 && (
        <Pressable style={styles.proceedButton} onPress={handleProceedWithMultiple}>
          <Text style={styles.proceedButtonText}>
            Continue with {selectedStudents.length} Student{selectedStudents.length > 1 ? 's' : ''}
          </Text>
          <Ionicons name="arrow-forward" size={20} color={colors.neutral.white} />
        </Pressable>
      )}
    </View>
  );

  const renderPianoConfig = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Piano Worksheet Settings</Text>

      {/* Clef Selection */}
      <View style={styles.configSection}>
        <Text style={styles.configLabel}>Clef</Text>
        <View style={styles.optionRow}>
          {CLEF_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.optionButton,
                clef === option.value && styles.optionButtonSelected,
              ]}
              onPress={() => setClef(option.value as typeof clef)}
            >
              <Text style={styles.optionEmoji}>{option.icon}</Text>
              <Text style={[
                styles.optionText,
                clef === option.value && styles.optionTextSelected,
              ]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Difficulty */}
      <View style={styles.configSection}>
        <Text style={styles.configLabel}>Difficulty</Text>
        <View style={styles.difficultyGrid}>
          {PIANO_DIFFICULTY.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.difficultyButton,
                pianoDifficulty === option.value && styles.difficultyButtonSelected,
              ]}
              onPress={() => setPianoDifficulty(option.value as typeof pianoDifficulty)}
            >
              <Text style={[
                styles.difficultyLabel,
                pianoDifficulty === option.value && styles.difficultyLabelSelected,
              ]}>
                {option.label}
              </Text>
              <Text style={styles.difficultyDesc}>{option.description}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Accidentals */}
      <View style={styles.configSection}>
        <Text style={styles.configLabel}>Accidentals</Text>
        <View style={styles.optionRow}>
          {ACCIDENTALS_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              style={[
                styles.smallOptionButton,
                accidentals === option.value && styles.optionButtonSelected,
              ]}
              onPress={() => setAccidentals(option.value as typeof accidentals)}
            >
              <Text style={[
                styles.smallOptionText,
                accidentals === option.value && styles.optionTextSelected,
              ]}>
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Problem Count */}
      <View style={styles.configSection}>
        <Text style={styles.configLabel}>Number of Problems</Text>
        <View style={styles.countRow}>
          {[10, 15, 20].map((count) => (
            <Pressable
              key={count}
              style={[
                styles.countButton,
                pianoProblemCount === count && styles.countButtonSelected,
              ]}
              onPress={() => setPianoProblemCount(count as 10 | 15 | 20)}
            >
              <Text style={[
                styles.countText,
                pianoProblemCount === count && styles.countTextSelected,
              ]}>
                {count}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );

  const renderMathConfig = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Math Worksheet Settings</Text>

      {/* Grade Level */}
      <View style={styles.configSection}>
        <Text style={styles.configLabel}>Grade Level</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.gradeRow}>
            {GRADE_OPTIONS.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.gradeButton,
                  grade === option.value && styles.gradeButtonSelected,
                ]}
                onPress={() => setGrade(option.value)}
              >
                <Text style={[
                  styles.gradeText,
                  grade === option.value && styles.gradeTextSelected,
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Topic */}
      <View style={styles.configSection}>
        <Text style={styles.configLabel}>Topic</Text>
        <View style={styles.topicGrid}>
          {MATH_TOPICS.map((topic) => (
            <Pressable
              key={topic.value}
              style={[
                styles.topicButton,
                mathTopic === topic.value && styles.topicButtonSelected,
              ]}
              onPress={() => setMathTopic(topic.value)}
            >
              <Text style={styles.topicIcon}>{topic.icon}</Text>
              <Text style={[
                styles.topicText,
                mathTopic === topic.value && styles.topicTextSelected,
              ]}>
                {topic.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Problem Count */}
      <View style={styles.configSection}>
        <Text style={styles.configLabel}>Number of Problems</Text>
        <View style={styles.countRow}>
          {PROBLEM_COUNT_OPTIONS.map((count) => (
            <Pressable
              key={count}
              style={[
                styles.countButton,
                mathProblemCount === count && styles.countButtonSelected,
              ]}
              onPress={() => setMathProblemCount(count as 10 | 15 | 20 | 25)}
            >
              <Text style={[
                styles.countText,
                mathProblemCount === count && styles.countTextSelected,
              ]}>
                {count}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Options */}
      <View style={styles.configSection}>
        <Text style={styles.configLabel}>Options</Text>
        <Pressable
          style={styles.toggleRow}
          onPress={() => setIncludeWordProblems(!includeWordProblems)}
        >
          <View style={[
            styles.checkbox,
            includeWordProblems && styles.checkboxChecked,
          ]}>
            {includeWordProblems && (
              <Ionicons name="checkmark" size={14} color={colors.neutral.white} />
            )}
          </View>
          <Text style={styles.toggleLabel}>Include word problems</Text>
        </Pressable>
        <Pressable
          style={styles.toggleRow}
          onPress={() => setIncludeVisualAids(!includeVisualAids)}
        >
          <View style={[
            styles.checkbox,
            includeVisualAids && styles.checkboxChecked,
          ]}>
            {includeVisualAids && (
              <Ionicons name="checkmark" size={14} color={colors.neutral.white} />
            )}
          </View>
          <Text style={styles.toggleLabel}>Include visual aids (pictures, diagrams)</Text>
        </Pressable>
      </View>
    </View>
  );

  const renderConfig = () => {
    if (worksheetType?.startsWith('piano')) {
      return renderPianoConfig();
    }
    return renderMathConfig();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          {step !== 'type' ? (
            <Pressable onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={colors.neutral.text} />
            </Pressable>
          ) : (
            <Pressable onPress={handleClose} style={styles.backButton}>
              <Ionicons name="close" size={24} color={colors.neutral.text} />
            </Pressable>
          )}
          <Text style={styles.headerTitle}>Generate Worksheet</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Progress */}
        <View style={styles.progressBar}>
          <View style={[styles.progressDot, step === 'type' && styles.progressDotActive]} />
          <View style={[styles.progressLine, step !== 'type' && styles.progressLineActive]} />
          <View style={[styles.progressDot, step === 'student' && styles.progressDotActive]} />
          <View style={[styles.progressLine, step === 'config' && styles.progressLineActive]} />
          <View style={[styles.progressDot, step === 'config' && styles.progressDotActive]} />
        </View>

        {/* Content */}
        <ScrollView style={styles.content}>
          {step === 'type' && renderTypeSelection()}
          {step === 'student' && renderStudentSelection()}
          {step === 'config' && renderConfig()}

          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={18} color={colors.status.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </ScrollView>

        {/* Generate Button */}
        {step === 'config' && (
          <View style={styles.footer}>
            <Pressable
              style={[styles.generateButton, generating && styles.generateButtonDisabled]}
              onPress={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator size="small" color={colors.neutral.white} />
              ) : (
                <>
                  <Ionicons name="sparkles" size={20} color={colors.neutral.white} />
                  <Text style={styles.generateButtonText}>
                    {isMultiSelectMode && selectedStudents.length > 1
                      ? `Generate for ${selectedStudents.length} Students`
                      : 'Generate Worksheet'}
                  </Text>
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
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  headerSpacer: {
    width: 40,
  },
  progressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.neutral.border,
  },
  progressDotActive: {
    backgroundColor: colors.piano.primary,
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.neutral.border,
    marginHorizontal: spacing.xs,
  },
  progressLineActive: {
    backgroundColor: colors.piano.primary,
  },
  content: {
    flex: 1,
  },
  stepContent: {
    padding: spacing.base,
  },
  stepTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  stepSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.lg,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  typeCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    ...shadows.sm,
  },
  typeCardWide: {
    minWidth: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: spacing.md,
  },
  typeIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  typeEmoji: {
    fontSize: 28,
  },
  typeLabel: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  typeDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  studentList: {
    gap: spacing.sm,
  },
  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  studentCardSelected: {
    backgroundColor: colors.piano.subtle,
    borderWidth: 2,
    borderColor: colors.piano.primary,
  },
  studentAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.piano.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  studentInitial: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  studentInfo: {
    flex: 1,
  },
  studentName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  studentGrade: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  // Multi-select styles
  multiSelectToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
  },
  multiSelectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  multiSelectButtonActive: {},
  multiSelectButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  multiSelectButtonTextActive: {
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  selectAllButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  selectAllText: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  checkboxSelected: {
    backgroundColor: colors.piano.primary,
    borderColor: colors.piano.primary,
  },
  proceedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.piano.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.lg,
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  proceedButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  configSection: {
    marginBottom: spacing.xl,
  },
  configLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  optionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  optionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionButtonSelected: {
    borderColor: colors.piano.primary,
    backgroundColor: colors.piano.subtle,
  },
  optionEmoji: {
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  optionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  optionTextSelected: {
    color: colors.piano.primary,
  },
  smallOptionButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  smallOptionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  difficultyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  difficultyButton: {
    width: '48%',
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  difficultyButtonSelected: {
    borderColor: colors.piano.primary,
    backgroundColor: colors.piano.subtle,
  },
  difficultyLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  difficultyLabelSelected: {
    color: colors.piano.primary,
  },
  difficultyDesc: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  countRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  countButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  countButtonSelected: {
    borderColor: colors.piano.primary,
    backgroundColor: colors.piano.subtle,
  },
  countText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  countTextSelected: {
    color: colors.piano.primary,
  },
  gradeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingRight: spacing.base,
  },
  gradeButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gradeButtonSelected: {
    borderColor: colors.math.primary,
    backgroundColor: colors.math.subtle,
  },
  gradeText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  gradeTextSelected: {
    color: colors.math.primary,
  },
  topicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  topicButton: {
    width: '31%',
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  topicButtonSelected: {
    borderColor: colors.math.primary,
    backgroundColor: colors.math.subtle,
  },
  topicIcon: {
    fontSize: 20,
    marginBottom: spacing.xs,
  },
  topicText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  topicTextSelected: {
    color: colors.math.primary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    borderColor: colors.neutral.border,
    marginRight: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: colors.math.primary,
    borderColor: colors.math.primary,
  },
  toggleLabel: {
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.status.errorBg,
    borderRadius: borderRadius.md,
    margin: spacing.base,
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
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.math.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

export default WorksheetGeneratorModal;
