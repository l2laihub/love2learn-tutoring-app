/**
 * Worksheets Screen
 * AI-powered worksheet generation for piano and math lessons
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useStudents } from '../../src/hooks/useStudents';
import { useAssignments, useCreateAssignment } from '../../src/hooks/useAssignments';
import { WorksheetGeneratorModal, WorksheetConfig } from '../../src/components/WorksheetGeneratorModal';
import { TutoringSubject, PianoWorksheetConfig, AssignmentWithStudent } from '../../src/types/database';
import { generatePianoWorksheet } from '../../src/services/pianoWorksheetGenerator';

type TabType = 'generate' | 'assigned';

// Piano quick templates
const PIANO_TEMPLATES = [
  { id: 'note-naming', label: 'Note Naming', icon: '🎵', clef: 'treble', difficulty: 'beginner' },
  { id: 'note-drawing', label: 'Note Drawing', icon: '✏️', clef: 'treble', difficulty: 'beginner' },
  { id: 'bass-clef', label: 'Bass Clef', icon: '🎹', clef: 'bass', difficulty: 'elementary' },
  { id: 'grand-staff', label: 'Grand Staff', icon: '🎼', clef: 'grand', difficulty: 'intermediate' },
];

// Math quick templates
const MATH_TEMPLATES = [
  { id: 'addition', label: 'Addition', icon: '➕', topic: 'addition', grade: 1 },
  { id: 'subtraction', label: 'Subtraction', icon: '➖', topic: 'subtraction', grade: 1 },
  { id: 'multiplication', label: 'Multiplication', icon: '✖️', topic: 'multiplication', grade: 3 },
  { id: 'division', label: 'Division', icon: '➗', topic: 'division', grade: 3 },
];

export default function WorksheetsScreen() {
  const { role: userRole } = useAuthContext();
  const { data: students, loading: studentsLoading } = useStudents();
  const { data: assignments, loading: assignmentsLoading, refetch: refetchAssignments } = useAssignments();
  const { mutate: createAssignment } = useCreateAssignment();
  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [showGenerator, setShowGenerator] = useState(false);
  const [presetSubject, setPresetSubject] = useState<TutoringSubject | undefined>();

  const isTutor = userRole === 'tutor';

  const handleOpenGenerator = (subject?: TutoringSubject) => {
    setPresetSubject(subject);
    setShowGenerator(true);
  };

  const handleGenerateWorksheet = useCallback(async (config: WorksheetConfig, studentId: string) => {
    // Find student name for worksheet
    const student = students.find(s => s.id === studentId);
    const studentName = student?.name || 'Student';

    // Check if it's a piano worksheet
    if ('type' in config && (config.type === 'note_naming' || config.type === 'note_drawing')) {
      const pianoConfig = config as PianoWorksheetConfig;

      // Generate the worksheet HTML
      const result = generatePianoWorksheet(pianoConfig, studentName);
      const worksheetType = pianoConfig.type === 'note_naming' ? 'piano_naming' : 'piano_drawing';

      try {
        // Check if we're on a platform that supports printing
        const canPrint = Platform.OS !== 'web';

        if (canPrint) {
          // Generate PDF from HTML using expo-print
          const printResult = await Print.printToFileAsync({
            html: result.worksheetHtml,
          });

          // Save the assignment to database
          await createAssignment({
            student_id: studentId,
            worksheet_type: worksheetType,
            config: config as unknown as Record<string, unknown>,
            pdf_url: printResult.uri,
          });

          // Share/preview the PDF
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(printResult.uri, {
              mimeType: 'application/pdf',
              dialogTitle: 'Piano Worksheet',
            });
          }

          // Refresh assignments list
          refetchAssignments();

          Alert.alert(
            'Worksheet Created!',
            `A ${pianoConfig.type.replace('_', ' ')} worksheet has been created for ${studentName}.`,
            [{ text: 'OK' }]
          );
        } else {
          // Web platform - save assignment without PDF, offer to print HTML directly
          await createAssignment({
            student_id: studentId,
            worksheet_type: worksheetType,
            config: config as unknown as Record<string, unknown>,
          });

          refetchAssignments();

          // On web, we can use window.print() to print the HTML
          Alert.alert(
            'Worksheet Created!',
            `Worksheet assigned to ${studentName}. On web, use browser print to generate PDF.`,
            [
              { text: 'OK' },
              {
                text: 'Print Now',
                onPress: () => {
                  // Open a new window with the worksheet HTML and trigger print
                  const printWindow = window.open('', '_blank');
                  if (printWindow) {
                    printWindow.document.write(result.worksheetHtml);
                    printWindow.document.close();
                    printWindow.print();
                  }
                },
              },
            ]
          );
        }
      } catch (error) {
        console.error('Error generating worksheet:', error);

        // Still save the assignment even if PDF generation fails
        await createAssignment({
          student_id: studentId,
          worksheet_type: worksheetType,
          config: config as unknown as Record<string, unknown>,
        });

        refetchAssignments();

        Alert.alert(
          'Worksheet Assigned',
          `Worksheet assigned to ${studentName}. PDF generation encountered an issue but the assignment was saved.`,
          [{ text: 'OK' }]
        );
      }
    } else {
      // Math worksheet - for now, just save as assignment
      // Later: integrate with SheetMagic API or WebView
      await createAssignment({
        student_id: studentId,
        worksheet_type: 'math',
        config: config as unknown as Record<string, unknown>,
      });

      refetchAssignments();

      Alert.alert(
        'Math Worksheet',
        `Math worksheet configuration saved for ${studentName}. Full generation coming soon via SheetMagic integration!`,
        [{ text: 'OK' }]
      );
    }
  }, [students, createAssignment, refetchAssignments]);

  const handleQuickTemplate = (
    subject: TutoringSubject,
    _templateConfig: Record<string, unknown>
  ) => {
    // Pre-fill generator with template settings
    setPresetSubject(subject);
    setShowGenerator(true);
    // The modal will use preset subject to show appropriate initial config
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Get worksheet type display name
  const getWorksheetTypeName = (type: string) => {
    switch (type) {
      case 'piano_naming': return 'Note Naming';
      case 'piano_drawing': return 'Note Drawing';
      case 'math': return 'Math';
      default: return type;
    }
  };

  // Get icon for worksheet type
  const getWorksheetIcon = (type: string) => {
    switch (type) {
      case 'piano_naming': return '🎼';
      case 'piano_drawing': return '✏️';
      case 'math': return '➗';
      default: return '📄';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <Pressable
          style={[styles.tab, activeTab === 'generate' && styles.tabActive]}
          onPress={() => setActiveTab('generate')}
        >
          <Ionicons
            name="sparkles"
            size={20}
            color={activeTab === 'generate' ? colors.piano.primary : colors.neutral.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'generate' && styles.tabTextActive,
            ]}
          >
            Generate
          </Text>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'assigned' && styles.tabActive]}
          onPress={() => setActiveTab('assigned')}
        >
          <Ionicons
            name="document-text"
            size={20}
            color={activeTab === 'assigned' ? colors.piano.primary : colors.neutral.textMuted}
          />
          <Text
            style={[
              styles.tabText,
              activeTab === 'assigned' && styles.tabTextActive,
            ]}
          >
            Assigned
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'generate' ? (
          <>
            {/* Main Generate Button */}
            <Pressable
              style={styles.generateButton}
              onPress={() => handleOpenGenerator()}
            >
              <View style={styles.generateButtonGradient}>
                <View style={styles.generateButtonContent}>
                  <View style={styles.generateIconContainer}>
                    <Ionicons name="sparkles" size={32} color={colors.neutral.white} />
                  </View>
                  <Text style={styles.generateButtonTitle}>
                    Generate New Worksheet
                  </Text>
                  <Text style={styles.generateButtonSubtitle}>
                    AI-powered worksheets for piano & math
                  </Text>
                </View>
              </View>
            </Pressable>

            {/* Piano Templates */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>🎹</Text>
                <Text style={styles.sectionTitle}>Piano Worksheets</Text>
              </View>
              <View style={styles.templateGrid}>
                {PIANO_TEMPLATES.map((template) => (
                  <Pressable
                    key={template.id}
                    style={styles.templateCard}
                    onPress={() => handleQuickTemplate('piano', template)}
                  >
                    <View
                      style={[
                        styles.templateIconContainer,
                        { backgroundColor: colors.piano.subtle },
                      ]}
                    >
                      <Text style={styles.templateIcon}>{template.icon}</Text>
                    </View>
                    <Text style={styles.templateLabel}>{template.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Math Templates */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionIcon}>➗</Text>
                <Text style={styles.sectionTitle}>Math Worksheets</Text>
              </View>
              <View style={styles.templateGrid}>
                {MATH_TEMPLATES.map((template) => (
                  <Pressable
                    key={template.id}
                    style={styles.templateCard}
                    onPress={() => handleQuickTemplate('math', template)}
                  >
                    <View
                      style={[
                        styles.templateIconContainer,
                        { backgroundColor: colors.math.subtle },
                      ]}
                    >
                      <Text style={styles.templateIcon}>{template.icon}</Text>
                    </View>
                    <Text style={styles.templateLabel}>{template.label}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* How It Works */}
            <View style={styles.howItWorks}>
              <Text style={styles.howItWorksTitle}>How It Works</Text>
              <View style={styles.stepsList}>
                <View style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>1</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Choose Subject</Text>
                    <Text style={styles.stepDescription}>
                      Select piano or math worksheet type
                    </Text>
                  </View>
                </View>
                <View style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>2</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Configure Options</Text>
                    <Text style={styles.stepDescription}>
                      Set difficulty, topics, and problem count
                    </Text>
                  </View>
                </View>
                <View style={styles.step}>
                  <View style={styles.stepNumber}>
                    <Text style={styles.stepNumberText}>3</Text>
                  </View>
                  <View style={styles.stepContent}>
                    <Text style={styles.stepTitle}>Generate & Assign</Text>
                    <Text style={styles.stepDescription}>
                      AI creates a personalized worksheet PDF
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        ) : (
          /* Assigned Tab */
          <>
            {assignmentsLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.piano.primary} />
                <Text style={styles.loadingText}>Loading worksheets...</Text>
              </View>
            ) : assignments.length === 0 ? (
              <View style={styles.emptyState}>
                <View style={styles.emptyIconContainer}>
                  <Ionicons
                    name="document-text-outline"
                    size={64}
                    color={colors.neutral.border}
                  />
                </View>
                <Text style={styles.emptyTitle}>No Assigned Worksheets</Text>
                <Text style={styles.emptySubtitle}>
                  {isTutor
                    ? 'Generate a worksheet and assign it to a student to track their progress.'
                    : 'Your assigned worksheets will appear here.'}
                </Text>
                {isTutor && (
                  <Pressable
                    style={styles.emptyButton}
                    onPress={() => {
                      setActiveTab('generate');
                    }}
                  >
                    <Ionicons
                      name="sparkles"
                      size={18}
                      color={colors.neutral.white}
                    />
                    <Text style={styles.emptyButtonText}>Generate Worksheet</Text>
                  </Pressable>
                )}
              </View>
            ) : (
              <View style={styles.assignmentsList}>
                {assignments.map((assignment: AssignmentWithStudent) => (
                  <Pressable
                    key={assignment.id}
                    style={styles.assignmentCard}
                    onPress={() => {
                      // TODO: Open worksheet detail/preview
                      Alert.alert(
                        getWorksheetTypeName(assignment.worksheet_type),
                        `Assigned to: ${assignment.student?.name || 'Unknown'}\nStatus: ${assignment.status}\nAssigned: ${formatDate(assignment.assigned_at)}`,
                        [{ text: 'OK' }]
                      );
                    }}
                  >
                    <View
                      style={[
                        styles.assignmentIcon,
                        {
                          backgroundColor: assignment.worksheet_type.startsWith('piano')
                            ? colors.piano.subtle
                            : colors.math.subtle,
                        },
                      ]}
                    >
                      <Text style={styles.assignmentEmoji}>
                        {getWorksheetIcon(assignment.worksheet_type)}
                      </Text>
                    </View>
                    <View style={styles.assignmentInfo}>
                      <Text style={styles.assignmentTitle}>
                        {getWorksheetTypeName(assignment.worksheet_type)}
                      </Text>
                      <Text style={styles.assignmentStudent}>
                        {assignment.student?.name || 'Unknown Student'}
                      </Text>
                      <Text style={styles.assignmentDate}>
                        Assigned {formatDate(assignment.assigned_at)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        assignment.status === 'completed'
                          ? styles.statusCompleted
                          : styles.statusPending,
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusText,
                          assignment.status === 'completed'
                            ? styles.statusTextCompleted
                            : styles.statusTextPending,
                        ]}
                      >
                        {assignment.status === 'completed' ? 'Done' : 'Pending'}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Worksheet Generator Modal */}
      <WorksheetGeneratorModal
        visible={showGenerator}
        onClose={() => {
          setShowGenerator(false);
          setPresetSubject(undefined);
        }}
        onGenerate={handleGenerateWorksheet}
        students={students}
        studentsLoading={studentsLoading}
        presetSubject={presetSubject}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.piano.primary,
  },
  tabText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textMuted,
  },
  tabTextActive: {
    color: colors.piano.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
    paddingBottom: spacing['2xl'],
  },
  generateButton: {
    marginBottom: spacing.xl,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  generateButtonGradient: {
    backgroundColor: colors.piano.primary,
    padding: spacing.xl,
  },
  generateButtonContent: {
    alignItems: 'center',
  },
  generateIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  generateButtonTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
    marginBottom: spacing.xs,
  },
  generateButtonSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.white,
    opacity: 0.9,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionIcon: {
    fontSize: 20,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  templateGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  templateCard: {
    width: '48%',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  templateIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  templateIcon: {
    fontSize: 24,
  },
  templateLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    textAlign: 'center',
  },
  howItWorks: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  howItWorksTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  stepsList: {
    gap: spacing.md,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.piano.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.piano.primary,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  stepDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'] * 2,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.neutral.white,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.piano.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    ...shadows.md,
  },
  emptyButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  // Loading state
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['2xl'] * 2,
  },
  loadingText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
  // Assignments list
  assignmentsList: {
    gap: spacing.sm,
  },
  assignmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  assignmentIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  assignmentEmoji: {
    fontSize: 24,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  assignmentStudent: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  assignmentDate: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusPending: {
    backgroundColor: colors.status.warningBg,
  },
  statusCompleted: {
    backgroundColor: colors.status.successBg,
  },
  statusText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
  },
  statusTextPending: {
    color: colors.status.warning,
  },
  statusTextCompleted: {
    color: colors.status.success,
  },
});
