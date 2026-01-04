/**
 * Welcome Screen
 * First step of parent onboarding - shows welcome message and linked children
 */

import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../../../src/contexts/AuthContext';
import { useStudents } from '../../../src/hooks/useStudents';
import { Button } from '../../../src/components/ui/Button';
import { colors, spacing, typography, borderRadius, shadows } from '../../../src/theme';
import { Student } from '../../../src/types/database';

// Subject emoji mapping
const subjectEmojis: Record<string, string> = {
  piano: '🎹',
  math: '➗',
  reading: '📚',
  speech: '🗣️',
  english: '📝',
};

export default function WelcomeScreen() {
  const { parent } = useAuthContext();
  const { data: students, loading: studentsLoading } = useStudents();

  // Get first name for greeting
  const firstName = parent?.name?.split(' ')[0] ?? '';

  // Check if this is an imported parent (has children already)
  const hasChildren = students.length > 0;

  const handleContinue = () => {
    // Navigate to agreement screen for parents to sign
    router.push('/(auth)/onboarding/agreement');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Ionicons name="heart" size={56} color={colors.primary.main} />
        </View>

        {/* Welcome Message */}
        <Text style={styles.title}>
          Welcome{firstName ? `, ${firstName}` : ''}!
        </Text>

        {hasChildren ? (
          <>
            <Text style={styles.subtitle}>
              Your tutor has already set up your account.{'\n'}
              Let's make sure everything looks right.
            </Text>

            {/* Children Section */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Ionicons name="people" size={20} color={colors.primary.main} />
                <Text style={styles.sectionTitle}>Your Children</Text>
              </View>

              {studentsLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator color={colors.primary.main} />
                </View>
              ) : (
                <View style={styles.childrenList}>
                  {students.map((student) => (
                    <ChildCard key={student.id} student={student} />
                  ))}
                </View>
              )}
            </View>

            {/* Info Note */}
            <View style={styles.infoNote}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.neutral.textSecondary}
              />
              <Text style={styles.infoText}>
                Something not right? You can contact your tutor after completing setup.
              </Text>
            </View>
          </>
        ) : (
          <>
            <Text style={styles.subtitle}>
              Welcome to Love2Learn! Let's set up your parent account.
            </Text>

            {/* No Children Note */}
            <View style={styles.noChildrenCard}>
              <Ionicons
                name="information-circle"
                size={32}
                color={colors.accent.main}
              />
              <Text style={styles.noChildrenTitle}>No Children Linked Yet</Text>
              <Text style={styles.noChildrenText}>
                Your tutor will add your children to the system. Once they do, you'll be able to see their lessons and worksheets here.
              </Text>
            </View>
          </>
        )}

        {/* Spacer */}
        <View style={styles.spacer} />
      </ScrollView>

      {/* Continue Button */}
      <View style={styles.footer}>
        <Button
          title="Continue"
          onPress={handleContinue}
          style={styles.continueButton}
          icon={<Ionicons name="arrow-forward" size={20} color={colors.neutral.white} />}
          iconPosition="right"
        />
      </View>
    </SafeAreaView>
  );
}

// Child Card Component
function ChildCard({ student }: { student: Student }) {
  const subjects = student.subjects || [];

  return (
    <View style={styles.childCard}>
      <View style={styles.childAvatar}>
        <Ionicons name="person" size={24} color={colors.primary.main} />
      </View>
      <View style={styles.childInfo}>
        <Text style={styles.childName}>{student.name}</Text>
        <Text style={styles.childDetails}>
          Age {student.age} · Grade {student.grade_level}
        </Text>
        {subjects.length > 0 && (
          <View style={styles.subjectsRow}>
            {subjects.map((subject, index) => (
              <View key={index} style={styles.subjectBadge}>
                <Text style={styles.subjectEmoji}>
                  {subjectEmojis[subject] || '📖'}
                </Text>
                <Text style={styles.subjectText}>
                  {subject.charAt(0).toUpperCase() + subject.slice(1)}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
  },
  logoContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: spacing.xl,
    marginTop: spacing.xl,
  },
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  subtitle: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  childrenList: {
    gap: spacing.md,
  },
  childCard: {
    flexDirection: 'row',
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  childAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  childInfo: {
    flex: 1,
  },
  childName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  childDetails: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  subjectsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  subjectBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  subjectEmoji: {
    fontSize: 12,
  },
  subjectText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.text,
    fontWeight: typography.weights.medium,
  },
  infoNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.neutral.background,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  infoText: {
    flex: 1,
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
  },
  noChildrenCard: {
    backgroundColor: colors.accent.subtle,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
  },
  noChildrenTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  noChildrenText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  spacer: {
    flex: 1,
    minHeight: spacing.xl,
  },
  footer: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  continueButton: {
    width: '100%',
  },
});
