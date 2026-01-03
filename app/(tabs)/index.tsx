/**
 * Home Screen
 * Dashboard for tutors and parents with today's lessons and quick stats
 */

import { View, Text, StyleSheet, ScrollView, Pressable, Platform, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useStudents } from '../../src/hooks/useStudents';
import { useTodaysLessons, useUpcomingLessons } from '../../src/hooks/useLessons';
import { useMemo, useState, useCallback } from 'react';
import { colors, spacing, typography, borderRadius, shadows, getSubjectColor } from '../../src/theme';
import { ScheduledLessonWithStudent } from '../../src/types/database';

export default function HomeScreen() {
  const { parent, signOut, isTutor } = useAuthContext();
  const { data: students, loading: studentsLoading, refetch: refetchStudents } = useStudents();
  const { data: todaysLessons, loading: lessonsLoading, refetch: refetchLessons } = useTodaysLessons();
  const { data: upcomingLessons, refetch: refetchUpcoming } = useUpcomingLessons(5);
  const [refreshing, setRefreshing] = useState(false);

  // Calculate student counts by subject
  const studentCounts = useMemo(() => {
    let piano = 0;
    let math = 0;

    students.forEach((student) => {
      const subjects = student.subjects || [];
      if (subjects.includes('piano')) piano++;
      if (subjects.includes('math')) math++;
    });

    return { piano, math, total: students.length };
  }, [students]);

  // Calculate today's lesson stats
  const todayStats = useMemo(() => {
    const scheduled = todaysLessons.filter(l => l.status === 'scheduled').length;
    const completed = todaysLessons.filter(l => l.status === 'completed').length;
    const totalMinutes = todaysLessons
      .filter(l => l.status !== 'cancelled')
      .reduce((acc, l) => acc + l.duration_min, 0);

    return { scheduled, completed, totalMinutes, total: todaysLessons.length };
  }, [todaysLessons]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([refetchStudents(), refetchLessons(), refetchUpcoming()]);
    setRefreshing(false);
  }, [refetchStudents, refetchLessons, refetchUpcoming]);

  const handleSignOut = async () => {
    console.log('Sign out button pressed');

    const shouldSignOut = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to sign out?')
      : true;

    if (shouldSignOut) {
      console.log('Confirming sign out...');
      try {
        const { error } = await signOut();
        console.log('Sign out result:', error ? 'Error' : 'Success');
        if (!error) {
          router.replace('/(auth)/login');
        } else {
          if (Platform.OS === 'web') {
            window.alert('Failed to sign out. Please try again.');
          }
        }
      } catch (e) {
        console.error('Sign out exception:', e);
        if (Platform.OS === 'web') {
          window.alert('An unexpected error occurred.');
        }
      }
    }
  };

  // Get first name for greeting
  const firstName = parent?.name?.split(' ')[0] ?? '';

  // Get greeting based on time of day
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.userInfo}>
              <View style={[
                styles.avatarContainer,
                isTutor && styles.tutorAvatarContainer
              ]}>
                <Ionicons
                  name={isTutor ? 'school' : 'person'}
                  size={24}
                  color={isTutor ? colors.piano.primary : colors.piano.primary}
                />
              </View>
              <View>
                <Text style={styles.greeting}>
                  {greeting}{firstName ? `, ${firstName}` : ''}!
                </Text>
                <View style={styles.roleContainer}>
                  <View style={[
                    styles.roleBadge,
                    isTutor ? styles.tutorBadge : styles.parentBadge
                  ]}>
                    <Ionicons
                      name={isTutor ? 'star' : 'people'}
                      size={12}
                      color={isTutor ? colors.piano.primary : colors.neutral.textSecondary}
                    />
                    <Text style={[
                      styles.roleText,
                      isTutor && styles.tutorRoleText
                    ]}>
                      {isTutor ? 'Tutor' : 'Parent'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => [
                styles.signOutButton,
                pressed && { opacity: 0.7 }
              ]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="log-out-outline" size={24} color={colors.neutral.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Today's Schedule */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Today's Schedule</Text>
            <Pressable onPress={() => router.push('/(tabs)/calendar')}>
              <Text style={styles.seeAllText}>See all</Text>
            </Pressable>
          </View>

          {lessonsLoading ? (
            <View style={styles.loadingCard}>
              <ActivityIndicator color={colors.piano.primary} />
            </View>
          ) : todaysLessons.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="sunny-outline" size={40} color={colors.neutral.textMuted} />
              <Text style={styles.emptyTitle}>No lessons today</Text>
              <Text style={styles.emptySubtitle}>
                {isTutor ? 'Enjoy your day off!' : 'No lessons scheduled for today'}
              </Text>
            </View>
          ) : (
            <View style={styles.lessonsContainer}>
              {todaysLessons.slice(0, 3).map((lesson) => (
                <LessonCard key={lesson.id} lesson={lesson} />
              ))}
              {todaysLessons.length > 3 && (
                <Pressable
                  style={styles.moreButton}
                  onPress={() => router.push('/(tabs)/calendar')}
                >
                  <Text style={styles.moreButtonText}>
                    +{todaysLessons.length - 3} more lessons
                  </Text>
                </Pressable>
              )}
            </View>
          )}
        </View>

        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {isTutor ? 'Quick Stats' : 'Overview'}
          </Text>
          <View style={styles.statsGrid}>
            <Pressable
              style={[styles.statCard, { backgroundColor: colors.piano.primary }]}
              onPress={() => router.push('/(tabs)/students')}
            >
              {studentsLoading ? (
                <ActivityIndicator color={colors.neutral.white} size="small" />
              ) : (
                <Text style={styles.statNumber}>{studentCounts.piano}</Text>
              )}
              <Text style={styles.statLabel}>Piano</Text>
              <View style={styles.statIcon}>
                <Text style={{ fontSize: 20 }}>🎹</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.statCard, { backgroundColor: colors.math.primary }]}
              onPress={() => router.push('/(tabs)/students')}
            >
              {studentsLoading ? (
                <ActivityIndicator color={colors.neutral.white} size="small" />
              ) : (
                <Text style={styles.statNumber}>{studentCounts.math}</Text>
              )}
              <Text style={styles.statLabel}>Math</Text>
              <View style={styles.statIcon}>
                <Text style={{ fontSize: 20 }}>➗</Text>
              </View>
            </Pressable>

            <Pressable
              style={[styles.statCard, { backgroundColor: colors.accent.main }]}
              onPress={() => router.push('/(tabs)/calendar')}
            >
              <Text style={styles.statNumber}>{todayStats.scheduled}</Text>
              <Text style={styles.statLabel}>Today</Text>
              <View style={styles.statIcon}>
                <Ionicons name="today" size={20} color={colors.neutral.white} style={{ opacity: 0.8 }} />
              </View>
            </Pressable>

            {isTutor && (
              <View style={[styles.statCard, { backgroundColor: colors.status.success }]}>
                <Text style={styles.statNumber}>{todayStats.completed}</Text>
                <Text style={styles.statLabel}>Done</Text>
                <View style={styles.statIcon}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.neutral.white} style={{ opacity: 0.8 }} />
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Upcoming Lessons (Tutor only) */}
        {isTutor && upcomingLessons.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming</Text>
              <Pressable onPress={() => router.push('/(tabs)/calendar')}>
                <Text style={styles.seeAllText}>Calendar</Text>
              </Pressable>
            </View>
            <View style={styles.upcomingList}>
              {upcomingLessons.slice(0, 3).map((lesson) => (
                <UpcomingLessonRow key={lesson.id} lesson={lesson} />
              ))}
            </View>
          </View>
        )}

        {/* Quick Actions (Tutor) */}
        {isTutor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.actionsGrid}>
              <Pressable
                style={styles.actionCard}
                onPress={() => router.push('/(tabs)/calendar')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.accent.subtle }]}>
                  <Ionicons name="add-circle" size={24} color={colors.accent.main} />
                </View>
                <Text style={styles.actionLabel}>Schedule Lesson</Text>
              </Pressable>

              <Pressable
                style={styles.actionCard}
                onPress={() => router.push('/(tabs)/students')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.accent.subtle }]}>
                  <Ionicons name="person-add" size={24} color={colors.accent.main} />
                </View>
                <Text style={styles.actionLabel}>Add Student</Text>
              </Pressable>

              <Pressable
                style={styles.actionCard}
                onPress={() => router.push('/(tabs)/worksheets')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.status.infoBg }]}>
                  <Ionicons name="document-text" size={24} color={colors.status.info} />
                </View>
                <Text style={styles.actionLabel}>Worksheets</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Parent: Assignments placeholder */}
        {!isTutor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assignments</Text>
            <View style={styles.emptyCard}>
              <Ionicons name="document-text-outline" size={40} color={colors.neutral.textMuted} />
              <Text style={styles.emptyTitle}>No assignments yet</Text>
              <Text style={styles.emptySubtitle}>
                Worksheets from your tutor will appear here
              </Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Lesson Card Component
function LessonCard({ lesson }: { lesson: ScheduledLessonWithStudent }) {
  const subjectColor = getSubjectColor(lesson.subject);
  const lessonTime = new Date(lesson.scheduled_at);
  const timeString = lessonTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <Pressable
      style={[
        styles.lessonCard,
        { borderLeftColor: subjectColor.primary },
        lesson.status === 'completed' && styles.lessonCardCompleted,
      ]}
      onPress={() => router.push('/(tabs)/calendar')}
    >
      <View style={styles.lessonTime}>
        <Text style={styles.lessonTimeText}>{timeString}</Text>
        <Text style={styles.lessonDuration}>{lesson.duration_min}m</Text>
      </View>
      <View style={styles.lessonInfo}>
        <Text style={styles.lessonStudent}>{lesson.student.name}</Text>
        <View style={styles.lessonSubject}>
          <Text style={{ fontSize: 14 }}>
            {lesson.subject === 'piano' ? '🎹' : '➗'}
          </Text>
          <Text style={[styles.lessonSubjectText, { color: subjectColor.primary }]}>
            {lesson.subject === 'piano' ? 'Piano' : 'Math'}
          </Text>
        </View>
      </View>
      {lesson.status === 'completed' && (
        <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
      )}
      {lesson.status === 'scheduled' && (
        <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
      )}
    </Pressable>
  );
}

// Upcoming Lesson Row
function UpcomingLessonRow({ lesson }: { lesson: ScheduledLessonWithStudent }) {
  const subjectColor = getSubjectColor(lesson.subject);
  const lessonDate = new Date(lesson.scheduled_at);
  const dayName = lessonDate.toLocaleDateString('en-US', { weekday: 'short' });
  const timeString = lessonDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return (
    <View style={styles.upcomingRow}>
      <View style={[styles.upcomingDot, { backgroundColor: subjectColor.primary }]} />
      <View style={styles.upcomingInfo}>
        <Text style={styles.upcomingStudent}>{lesson.student.name}</Text>
        <Text style={styles.upcomingTime}>
          {dayName} at {timeString}
        </Text>
      </View>
      <Text style={{ fontSize: 16 }}>
        {lesson.subject === 'piano' ? '🎹' : '➗'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  content: {
    padding: spacing.base,
  },
  header: {
    marginBottom: spacing.lg,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.piano.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  tutorAvatarContainer: {
    backgroundColor: colors.piano.subtle,
  },
  greeting: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  roleContainer: {
    flexDirection: 'row',
    marginTop: spacing.xs,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  parentBadge: {
    backgroundColor: colors.neutral.borderLight,
  },
  tutorBadge: {
    backgroundColor: colors.piano.subtle,
  },
  roleText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  tutorRoleText: {
    color: colors.piano.primary,
  },
  signOutButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: colors.neutral.white,
    ...shadows.sm,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  seeAllText: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.md,
  },
  loadingCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  emptyCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadows.sm,
  },
  emptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
  },
  lessonsContainer: {
    gap: spacing.sm,
  },
  lessonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    ...shadows.sm,
  },
  lessonCardCompleted: {
    backgroundColor: colors.status.successBg,
    opacity: 0.9,
  },
  lessonTime: {
    width: 60,
    marginRight: spacing.md,
  },
  lessonTimeText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  lessonDuration: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  lessonInfo: {
    flex: 1,
  },
  lessonStudent: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  lessonSubject: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  lessonSubjectText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  moreButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  moreButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    position: 'relative',
    overflow: 'hidden',
    ...shadows.md,
  },
  statNumber: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  statLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.white,
    marginTop: spacing.xs,
    opacity: 0.9,
  },
  statIcon: {
    position: 'absolute',
    right: spacing.md,
    top: spacing.md,
    opacity: 0.8,
  },
  upcomingList: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.borderLight,
  },
  upcomingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.md,
  },
  upcomingInfo: {
    flex: 1,
  },
  upcomingStudent: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  upcomingTime: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  actionCard: {
    flex: 1,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    ...shadows.sm,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  actionLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    textAlign: 'center',
  },
});
