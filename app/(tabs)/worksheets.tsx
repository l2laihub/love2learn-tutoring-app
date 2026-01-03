/**
 * Worksheets Screen
 * AI-powered worksheet generation for piano and math lessons
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useStudents } from '../../src/hooks/useStudents';
import { WorksheetGeneratorModal, WorksheetConfig } from '../../src/components/WorksheetGeneratorModal';
import { TutoringSubject } from '../../src/types/database';

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
  const { data: students } = useStudents();
  const [activeTab, setActiveTab] = useState<TabType>('generate');
  const [showGenerator, setShowGenerator] = useState(false);
  const [presetSubject, setPresetSubject] = useState<TutoringSubject | undefined>();

  const isTutor = userRole === 'tutor';

  const handleOpenGenerator = (subject?: TutoringSubject) => {
    setPresetSubject(subject);
    setShowGenerator(true);
  };

  const handleGenerateWorksheet = async (config: WorksheetConfig) => {
    // TODO: Call Supabase Edge Function to generate PDF
    console.log('Generating worksheet with config:', config);

    // For now, just show success
    // In production, this would:
    // 1. Call edge function to generate PDF
    // 2. Store worksheet record in database
    // 3. Optionally assign to student
  };

  const handleQuickTemplate = (
    subject: TutoringSubject,
    templateConfig: Record<string, unknown>
  ) => {
    // Pre-fill generator with template settings
    setPresetSubject(subject);
    setShowGenerator(true);
    // The modal will use preset subject to show appropriate initial config
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
        studentsLoading={false}
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
});
