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
import { useTodaysLessons, useUpcomingGroupedLessons } from '../../src/hooks/useLessons';
import { usePendingAssignments } from '../../src/hooks/useAssignments';
import { usePaymentSummary, useOverduePayments, useParentPaymentSummary, usePrepaidPayments, ParentPaymentSummary } from '../../src/hooks/usePayments';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useMemo, useState, useCallback } from 'react';
import { colors, spacing, typography, borderRadius, shadows, getSubjectColor, Subject } from '../../src/theme';
import { ScheduledLessonWithStudent, AssignmentWithStudent, GroupedLesson } from '../../src/types/database';
import { AvatarDisplay } from '../../src/components/AvatarUpload';

// Layout constants for responsive design
const layoutConstants = {
  contentMaxWidth: 1200,
};

// Subject emoji mapping
const subjectEmojis: Record<Subject, string> = {
  piano: '🎹',
  math: '➗',
  reading: '📚',
  speech: '🗣️',
  english: '📝',
};

// Subject display names
const subjectNames: Record<Subject, string> = {
  piano: 'Piano',
  math: 'Math',
  reading: 'Reading',
  speech: 'Speech',
  english: 'English',
};

export default function HomeScreen() {
  const { parent, signOut, isTutor } = useAuthContext();
  // Only tutors need students data for Quick Stats
  const { data: students, loading: studentsLoading, refetch: refetchStudents } = useStudents();
  const { data: todaysLessons, loading: lessonsLoading, refetch: refetchLessons } = useTodaysLessons();
  const { data: upcomingLessons, refetch: refetchUpcoming } = useUpcomingGroupedLessons(5);
  const { data: pendingAssignments, loading: assignmentsLoading, refetch: refetchAssignments } = usePendingAssignments();
  const { summary: paymentSummary, refetch: refetchPayments } = usePaymentSummary();
  const { data: overduePayments, refetch: refetchOverdue } = useOverduePayments();
  const { data: parentPaymentSummary, refetch: refetchParentPayment } = useParentPaymentSummary(parent?.id || null);
  // Prepaid data for parents on prepaid billing
  const currentMonth = useMemo(() => new Date(), []);
  const { data: prepaidPayments, refetch: refetchPrepaidPayments } = usePrepaidPayments(currentMonth);
  const [refreshing, setRefreshing] = useState(false);
  const responsive = useResponsive();

  // Calculate student counts by subject dynamically
  const subjectCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const allSubjects: Subject[] = ['piano', 'math', 'reading', 'speech', 'english'];

    // Initialize all subjects with 0
    allSubjects.forEach(subject => {
      counts[subject] = 0;
    });

    students.forEach((student) => {
      const subjects = student.subjects || [];
      subjects.forEach((subject) => {
        if (counts[subject] !== undefined) {
          counts[subject]++;
        }
      });
    });

    // Get subjects that have at least one student, sorted by count (descending)
    const activeSubjects = allSubjects
      .filter(subject => counts[subject] > 0)
      .sort((a, b) => counts[b] - counts[a]);

    return { counts, activeSubjects, total: students.length };
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

  // Get parent's prepaid payment for current month (if exists)
  const parentPrepaidPayment = useMemo(() => {
    if (!parent) return null;
    return prepaidPayments.find(p => p.parent_id === parent.id) || null;
  }, [parent, prepaidPayments]);

  // Current month display for prepaid section
  const monthDisplay = useMemo(() => {
    return currentMonth.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [currentMonth]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      refetchStudents(),
      refetchLessons(),
      refetchUpcoming(),
      refetchAssignments(),
      refetchPayments(),
      refetchOverdue(),
      refetchParentPayment(),
      refetchPrepaidPayments(),
    ]);
    setRefreshing(false);
  }, [refetchStudents, refetchLessons, refetchUpcoming, refetchAssignments, refetchPayments, refetchOverdue, refetchParentPayment, refetchPrepaidPayments]);

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

  // Responsive styles
  const responsiveStyles = useMemo(() => ({
    content: {
      padding: responsive.contentPadding,
      maxWidth: layoutConstants.contentMaxWidth,
      alignSelf: 'center' as const,
      width: '100%' as const,
    },
    statsGrid: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: spacing.md,
    },
    statCard: {
      minWidth: responsive.isDesktop ? '15%' : responsive.isTablet ? '30%' : '45%',
      flex: 1,
    },
    actionsGrid: {
      flexDirection: 'row' as const,
      flexWrap: 'wrap' as const,
      gap: spacing.md,
    },
    actionCard: {
      minWidth: responsive.isDesktop ? '15%' : '22%',
      flex: 1,
    },
    twoColumnLayout: {
      flexDirection: responsive.isDesktop ? 'row' as const : 'column' as const,
      gap: spacing.xl,
    },
    mainColumn: {
      flex: responsive.isDesktop ? 2 : 1,
    },
    sideColumn: {
      flex: responsive.isDesktop ? 1 : 1,
    },
  }), [responsive]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        contentContainerStyle={[styles.content, responsiveStyles.content]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View style={styles.userInfo}>
              {isTutor ? (
                <View style={[styles.avatarContainer, styles.tutorAvatarContainer]}>
                  <Ionicons name="school" size={24} color={colors.piano.primary} />
                </View>
              ) : (
                <AvatarDisplay
                  avatarUrl={parent?.avatar_url}
                  name={parent?.name || 'Parent'}
                  size={48}
                />
              )}
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

        {/* Parent: Overdue Payment Alert Banner */}
        {!isTutor && parentPaymentSummary?.hasOverdueBalance && (
          <OverdueAlertBanner
            overdueAmount={parentPaymentSummary.overdueAmount}
            overdueMonths={parentPaymentSummary.overdueMonths}
          />
        )}

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

        {/* Quick Stats (Tutor only) */}
        {isTutor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Stats</Text>
            <View style={[styles.statsGrid, responsiveStyles.statsGrid]}>
              {/* Dynamic subject cards - show active subjects */}
              {subjectCounts.activeSubjects.map((subject) => {
                const subjectColor = getSubjectColor(subject);
                return (
                  <Pressable
                    key={subject}
                    style={[styles.statCard, responsiveStyles.statCard, { backgroundColor: subjectColor.primary }]}
                    onPress={() => router.push('/(tabs)/students')}
                  >
                    {studentsLoading ? (
                      <ActivityIndicator color={colors.neutral.white} size="small" />
                    ) : (
                      <Text style={styles.statNumber}>{subjectCounts.counts[subject]}</Text>
                    )}
                    <Text style={styles.statLabel}>{subjectNames[subject]}</Text>
                    <View style={styles.statIcon}>
                      <Text style={{ fontSize: 20 }}>{subjectEmojis[subject]}</Text>
                    </View>
                  </Pressable>
                );
              })}

              {/* Today's lessons card */}
              <Pressable
                style={[styles.statCard, responsiveStyles.statCard, { backgroundColor: colors.accent.main }]}
                onPress={() => router.push('/(tabs)/calendar')}
              >
                <Text style={styles.statNumber}>{todayStats.scheduled}</Text>
                <Text style={styles.statLabel}>Today</Text>
                <View style={styles.statIcon}>
                  <Ionicons name="today" size={20} color={colors.neutral.white} style={{ opacity: 0.8 }} />
                </View>
              </Pressable>

              {/* Done card */}
              <View style={[styles.statCard, responsiveStyles.statCard, { backgroundColor: colors.status.success }]}>
                <Text style={styles.statNumber}>{todayStats.completed}</Text>
                <Text style={styles.statLabel}>Done</Text>
                <View style={styles.statIcon}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.neutral.white} style={{ opacity: 0.8 }} />
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Parent: Payment Summary Card */}
        {!isTutor && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Payment Status</Text>
              <Pressable onPress={() => router.push('/(tabs)/payments')}>
                <Text style={styles.seeAllText}>View all</Text>
              </Pressable>
            </View>
            {parentPrepaidPayment ? (
              // Prepaid status view - show if there's a prepaid payment for this parent
              <ParentPrepaidCard
                parentName={parent?.name || ''}
                monthDisplay={monthDisplay}
                sessionsTotal={parentPrepaidPayment.sessions_prepaid || 0}
                sessionsUsed={parentPrepaidPayment.sessions_used || 0}
                sessionsRemaining={Math.max(0, (parentPrepaidPayment.sessions_prepaid || 0) - (parentPrepaidPayment.sessions_used || 0))}
                sessionsRolledOver={parentPrepaidPayment.sessions_rolled_over || 0}
                amountDue={parentPrepaidPayment.amount_due}
                isPaid={parentPrepaidPayment.status === 'paid'}
                paidAt={parentPrepaidPayment.paid_at ? new Date(parentPrepaidPayment.paid_at).toLocaleDateString() : undefined}
              />
            ) : (
              // Invoice status view - show for invoice billing or no prepaid plan
              parentPaymentSummary && <ParentPaymentCard summary={parentPaymentSummary} />
            )}
          </View>
        )}

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
              {upcomingLessons.slice(0, 3).map((group) => (
                <UpcomingLessonRow key={group.session_id || group.lessons[0].id} group={group} />
              ))}
            </View>
          </View>
        )}

        {/* Payments Summary (Tutor only) */}
        {isTutor && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Payments This Month</Text>
              <Pressable onPress={() => router.push('/(tabs)/payments')}>
                <Text style={styles.seeAllText}>View all</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.paymentSummaryCard}
              onPress={() => router.push('/(tabs)/payments')}
            >
              <View style={styles.paymentStats}>
                <View style={styles.paymentStatItem}>
                  <Ionicons name="wallet-outline" size={20} color={colors.status.success} />
                  <View style={styles.paymentStatInfo}>
                    <Text style={styles.paymentStatLabel}>Collected</Text>
                    <Text style={[styles.paymentStatAmount, { color: colors.status.success }]}>
                      ${paymentSummary.totalPaid.toFixed(0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.paymentStatDivider} />

                <View style={styles.paymentStatItem}>
                  <Ionicons name="time-outline" size={20} color={colors.status.warning} />
                  <View style={styles.paymentStatInfo}>
                    <Text style={styles.paymentStatLabel}>Outstanding</Text>
                    <Text style={[styles.paymentStatAmount, { color: colors.status.warning }]}>
                      ${paymentSummary.totalOutstanding.toFixed(0)}
                    </Text>
                  </View>
                </View>

                <View style={styles.paymentStatDivider} />

                <View style={styles.paymentStatItem}>
                  <Ionicons name="people-outline" size={20} color={colors.piano.primary} />
                  <View style={styles.paymentStatInfo}>
                    <Text style={styles.paymentStatLabel}>Families</Text>
                    <Text style={[styles.paymentStatAmount, { color: colors.piano.primary }]}>
                      {paymentSummary.totalFamilies}
                    </Text>
                  </View>
                </View>
              </View>

              {overduePayments.length > 0 && (
                <View style={styles.overdueAlert}>
                  <Ionicons name="alert-circle" size={16} color={colors.status.error} />
                  <Text style={styles.overdueAlertText}>
                    {overduePayments.length} overdue payment{overduePayments.length > 1 ? 's' : ''}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        )}

        {/* Quick Actions (Tutor) */}
        {isTutor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={[styles.actionsGrid, responsiveStyles.actionsGrid]}>
              <Pressable
                style={[styles.actionCard, responsiveStyles.actionCard]}
                onPress={() => router.push('/(tabs)/calendar')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.accent.subtle }]}>
                  <Ionicons name="add-circle" size={24} color={colors.accent.main} />
                </View>
                <Text style={styles.actionLabel}>Schedule Lesson</Text>
              </Pressable>

              <Pressable
                style={[styles.actionCard, responsiveStyles.actionCard]}
                onPress={() => router.push('/(tabs)/students')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.accent.subtle }]}>
                  <Ionicons name="person-add" size={24} color={colors.accent.main} />
                </View>
                <Text style={styles.actionLabel}>Add Student</Text>
              </Pressable>

              <Pressable
                style={[styles.actionCard, responsiveStyles.actionCard]}
                onPress={() => router.push('/(tabs)/worksheets')}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.status.infoBg }]}>
                  <Ionicons name="document-text" size={24} color={colors.status.info} />
                </View>
                <Text style={styles.actionLabel}>Worksheets</Text>
              </Pressable>

              <Pressable
                style={[styles.actionCard, responsiveStyles.actionCard]}
                onPress={() => router.push('/availability' as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.primary.subtle }]}>
                  <Ionicons name="time" size={24} color={colors.primary.main} />
                </View>
                <Text style={styles.actionLabel}>My Availability</Text>
              </Pressable>

              <Pressable
                style={[styles.actionCard, responsiveStyles.actionCard]}
                onPress={() => router.push('/requests' as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: colors.status.warningBg }]}>
                  <Ionicons name="git-pull-request" size={24} color={colors.status.warning} />
                </View>
                <Text style={styles.actionLabel}>Requests</Text>
              </Pressable>

              <Pressable
                style={[styles.actionCard, responsiveStyles.actionCard]}
                onPress={() => router.push('/admin' as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: '#E8EAF6' }]}>
                  <Ionicons name="settings" size={24} color="#5C6BC0" />
                </View>
                <Text style={styles.actionLabel}>Admin Panel</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Parent: Quick Actions */}
        {!isTutor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={[styles.parentActionsGrid, responsiveStyles.actionsGrid]}>
              <Pressable
                style={[styles.parentActionCard, responsiveStyles.actionCard]}
                onPress={() => router.push('/profile' as any)}
              >
                <View style={[styles.parentActionIcon, { backgroundColor: colors.primary.subtle }]}>
                  <Ionicons name="person-circle" size={24} color={colors.primary.main} />
                </View>
                <Text style={styles.parentActionLabel}>My Profile</Text>
              </Pressable>

              <Pressable
                style={[styles.parentActionCard, responsiveStyles.actionCard]}
                onPress={() => router.push('/(tabs)/payments' as any)}
              >
                <View style={[styles.parentActionIcon, { backgroundColor: colors.status.warningBg }]}>
                  <Ionicons name="wallet" size={24} color={colors.status.warning} />
                </View>
                <Text style={styles.parentActionLabel}>Payments</Text>
              </Pressable>

              <Pressable
                style={[styles.parentActionCard, responsiveStyles.actionCard]}
                onPress={() => router.push('/(tabs)/calendar')}
              >
                <View style={[styles.parentActionIcon, { backgroundColor: colors.accent.subtle }]}>
                  <Ionicons name="calendar" size={24} color={colors.accent.main} />
                </View>
                <Text style={styles.parentActionLabel}>Schedule</Text>
              </Pressable>

              <Pressable
                style={[styles.parentActionCard, responsiveStyles.actionCard]}
                onPress={() => router.push('/(tabs)/worksheets')}
              >
                <View style={[styles.parentActionIcon, { backgroundColor: colors.status.infoBg }]}>
                  <Ionicons name="document" size={24} color={colors.status.info} />
                </View>
                <Text style={styles.parentActionLabel}>Worksheets</Text>
              </Pressable>

              <Pressable
                style={[styles.parentActionCard, responsiveStyles.actionCard]}
                onPress={() => router.push('/agreement' as any)}
              >
                <View style={[styles.parentActionIcon, { backgroundColor: colors.status.successBg }]}>
                  <Ionicons name="document-text" size={24} color={colors.status.success} />
                </View>
                <Text style={styles.parentActionLabel}>Agreement</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Parent: Assignments section */}
        {!isTutor && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Assignments</Text>
            {assignmentsLoading ? (
              <View style={styles.loadingCard}>
                <ActivityIndicator color={colors.piano.primary} />
              </View>
            ) : pendingAssignments.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="document-text-outline" size={40} color={colors.neutral.textMuted} />
                <Text style={styles.emptyTitle}>No assignments yet</Text>
                <Text style={styles.emptySubtitle}>
                  Worksheets from your tutor will appear here
                </Text>
              </View>
            ) : (
              <View style={styles.assignmentsContainer}>
                {pendingAssignments.slice(0, 5).map((assignment) => (
                  <AssignmentCard key={assignment.id} assignment={assignment} />
                ))}
                {pendingAssignments.length > 5 && (
                  <Pressable
                    style={styles.moreButton}
                    onPress={() => router.push('/(tabs)/worksheets')}
                  >
                    <Text style={styles.moreButtonText}>
                      +{pendingAssignments.length - 5} more assignments
                    </Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// Lesson Card Component
function LessonCard({ lesson }: { lesson: ScheduledLessonWithStudent }) {
  const subjectColor = getSubjectColor(lesson.subject as Subject);
  const lessonTime = new Date(lesson.scheduled_at);
  const timeString = lessonTime.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const emoji = subjectEmojis[lesson.subject as Subject] || '📖';
  const displayName = subjectNames[lesson.subject as Subject] || lesson.subject;

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
          <Text style={{ fontSize: 14 }}>{emoji}</Text>
          <Text style={[styles.lessonSubjectText, { color: subjectColor.primary }]}>
            {displayName}
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

// Upcoming Lesson Row - now handles grouped sessions
function UpcomingLessonRow({ group }: { group: GroupedLesson }) {
  const isGrouped = group.session_id !== null && group.lessons.length > 1;
  const primarySubject = group.subjects[0] as Subject;
  const subjectColor = getSubjectColor(primarySubject);
  const lessonDate = new Date(group.scheduled_at);
  const dayName = lessonDate.toLocaleDateString('en-US', { weekday: 'short' });
  const timeString = lessonDate.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  // For grouped sessions, show multiple emojis or a group indicator
  const displayEmojis = isGrouped
    ? group.subjects.slice(0, 2).map(s => subjectEmojis[s as Subject] || '📖').join('')
    : subjectEmojis[primarySubject] || '📖';

  // Display student names
  const studentDisplay = isGrouped
    ? group.student_names.join(' & ')
    : group.student_names[0];

  // Display subjects for grouped sessions
  const subjectDisplay = isGrouped
    ? group.subjects.map(s => subjectNames[s as Subject] || s).join(', ')
    : null;

  return (
    <View style={[styles.upcomingRow, isGrouped && styles.upcomingRowGrouped]}>
      {isGrouped ? (
        <View style={[styles.upcomingDotGrouped, { backgroundColor: subjectColor.primary }]}>
          <Ionicons name="people" size={10} color={colors.neutral.white} />
        </View>
      ) : (
        <View style={[styles.upcomingDot, { backgroundColor: subjectColor.primary }]} />
      )}
      <View style={styles.upcomingInfo}>
        <Text style={styles.upcomingStudent} numberOfLines={1}>{studentDisplay}</Text>
        <Text style={styles.upcomingTime}>
          {dayName} at {timeString}
          {subjectDisplay && <Text style={styles.upcomingSubjects}> · {subjectDisplay}</Text>}
        </Text>
      </View>
      <Text style={{ fontSize: 16 }}>{displayEmojis}</Text>
    </View>
  );
}

// Assignment Card Component
function AssignmentCard({ assignment }: { assignment: AssignmentWithStudent }) {
  const worksheetTypeMap: Record<string, { name: string; emoji: string; color: string }> = {
    piano_naming: { name: 'Piano Naming', emoji: '🎹', color: colors.piano.primary },
    piano_drawing: { name: 'Piano Drawing', emoji: '✏️', color: colors.piano.primary },
    math: { name: 'Math', emoji: '➗', color: colors.math.primary },
  };

  const typeInfo = worksheetTypeMap[assignment.worksheet_type] || {
    name: assignment.worksheet_type,
    emoji: '📄',
    color: colors.primary.main,
  };

  const dueDate = assignment.due_date ? new Date(assignment.due_date) : null;
  const isOverdue = dueDate && dueDate < new Date();
  const dueDateString = dueDate
    ? dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <View style={[styles.assignmentCard, isOverdue && styles.assignmentCardOverdue]}>
      <View style={[styles.assignmentTypeIcon, { backgroundColor: typeInfo.color + '20' }]}>
        <Text style={{ fontSize: 20 }}>{typeInfo.emoji}</Text>
      </View>
      <View style={styles.assignmentInfo}>
        <Text style={styles.assignmentType}>{typeInfo.name}</Text>
        <Text style={styles.assignmentStudent}>{assignment.student.name}</Text>
      </View>
      {dueDate && (
        <View style={[styles.assignmentDue, isOverdue && styles.assignmentDueOverdue]}>
          <Ionicons
            name={isOverdue ? 'alert-circle' : 'calendar-outline'}
            size={12}
            color={isOverdue ? colors.status.error : colors.neutral.textSecondary}
          />
          <Text style={[styles.assignmentDueText, isOverdue && styles.assignmentDueTextOverdue]}>
            {dueDateString}
          </Text>
        </View>
      )}
    </View>
  );
}

// Parent Payment Summary Card Component
function ParentPaymentCard({ summary }: { summary: ParentPaymentSummary }) {
  // Determine payment status display
  const getStatusInfo = () => {
    if (!summary.hasPaymentRecord) {
      // No invoice yet - show sessions info
      if (summary.completedSessions === 0 && summary.scheduledSessions === 0) {
        return {
          icon: 'calendar-outline' as const,
          text: 'No sessions this month',
          color: colors.neutral.textMuted,
          bgColor: colors.neutral.borderLight,
        };
      }
      return {
        icon: 'time-outline' as const,
        text: 'Invoice pending',
        color: colors.status.info,
        bgColor: colors.status.infoBg,
      };
    }

    switch (summary.status) {
      case 'paid':
        return {
          icon: 'checkmark-circle' as const,
          text: 'Paid',
          color: colors.status.success,
          bgColor: colors.status.successBg,
        };
      case 'partial':
        return {
          icon: 'time-outline' as const,
          text: 'Partial',
          color: colors.status.warning,
          bgColor: colors.status.warningBg,
        };
      case 'unpaid':
        return {
          icon: 'alert-circle' as const,
          text: 'Payment Due',
          color: colors.status.error,
          bgColor: colors.status.errorBg,
        };
      default:
        return {
          icon: 'help-circle-outline' as const,
          text: 'Unknown',
          color: colors.neutral.textMuted,
          bgColor: colors.neutral.borderLight,
        };
    }
  };

  const statusInfo = getStatusInfo();
  const totalSessions = summary.completedSessions + summary.scheduledSessions;

  return (
    <Pressable
      style={styles.parentPaymentCard}
      onPress={() => router.push('/(tabs)/payments' as any)}
    >
      {/* Header */}
      <View style={styles.parentPaymentHeader}>
        <View style={styles.parentPaymentTitleRow}>
          <Ionicons name="wallet-outline" size={20} color={colors.piano.primary} />
          <Text style={styles.parentPaymentTitle}>{summary.currentMonthDisplay}</Text>
        </View>
        <Text style={styles.parentPaymentViewAll}>View all</Text>
      </View>

      {/* Stats Row */}
      <View style={styles.parentPaymentStats}>
        {/* Amount Due */}
        <View style={styles.parentPaymentStatItem}>
          <Text style={styles.parentPaymentStatLabel}>Total Due</Text>
          <Text style={[styles.parentPaymentStatAmount, { color: colors.neutral.text }]}>
            ${summary.amountDue.toFixed(0)}
          </Text>
        </View>

        <View style={styles.parentPaymentStatDivider} />

        {/* Amount Paid */}
        <View style={styles.parentPaymentStatItem}>
          <Text style={styles.parentPaymentStatLabel}>Paid</Text>
          <Text style={[styles.parentPaymentStatAmount, { color: colors.status.success }]}>
            ${summary.amountPaid.toFixed(0)}
          </Text>
        </View>

        <View style={styles.parentPaymentStatDivider} />

        {/* Balance */}
        <View style={styles.parentPaymentStatItem}>
          <Text style={styles.parentPaymentStatLabel}>Balance</Text>
          <Text style={[
            styles.parentPaymentStatAmount,
            { color: summary.balance > 0 ? colors.status.warning : colors.status.success }
          ]}>
            ${summary.balance.toFixed(0)}
          </Text>
        </View>
      </View>

      {/* Status Badge and Sessions */}
      <View style={styles.parentPaymentFooter}>
        <View style={[styles.parentPaymentStatusBadge, { backgroundColor: statusInfo.bgColor }]}>
          <Ionicons name={statusInfo.icon} size={14} color={statusInfo.color} />
          <Text style={[styles.parentPaymentStatusText, { color: statusInfo.color }]}>
            {statusInfo.text}
          </Text>
        </View>

        <View style={styles.parentPaymentSessions}>
          <Ionicons name="book-outline" size={14} color={colors.neutral.textSecondary} />
          <Text style={styles.parentPaymentSessionsText}>
            {totalSessions} session{totalSessions !== 1 ? 's' : ''} this month
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// Parent Prepaid Card Component - Similar to admin's Parent View Preview
interface ParentPrepaidCardProps {
  parentName: string;
  monthDisplay: string;
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  sessionsRolledOver?: number;
  amountDue: number;
  isPaid: boolean;
  paidAt?: string;
}

function ParentPrepaidCard({
  parentName,
  monthDisplay,
  sessionsTotal,
  sessionsUsed,
  sessionsRemaining,
  sessionsRolledOver = 0,
  amountDue,
  isPaid,
  paidAt,
}: ParentPrepaidCardProps) {
  const progressPercent = sessionsTotal > 0 ? (sessionsUsed / sessionsTotal) * 100 : 0;

  return (
    <Pressable
      style={styles.prepaidCard}
      onPress={() => router.push('/(tabs)/payments' as any)}
    >
      {/* Header with month and session count */}
      <View style={styles.prepaidHeader}>
        <View style={styles.prepaidTitleRow}>
          <Text style={styles.prepaidTitle}>{monthDisplay} Sessions</Text>
          <View style={styles.prepaidBadge}>
            <Text style={styles.prepaidBadgeText}>Prepaid</Text>
          </View>
        </View>
        <View style={styles.prepaidCountContainer}>
          <Text style={styles.prepaidCountLarge}>{sessionsUsed}</Text>
          <Text style={styles.prepaidCountSlash}>/</Text>
          <Text style={styles.prepaidCountTotal}>{sessionsTotal}</Text>
          <Text style={styles.prepaidCountLabel}>used</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.prepaidProgressContainer}>
        <View style={styles.prepaidProgressTrack}>
          <View
            style={[
              styles.prepaidProgressFill,
              { width: `${Math.min(progressPercent, 100)}%` }
            ]}
          />
        </View>
        <Text style={styles.prepaidRemainingText}>{sessionsRemaining} sessions remaining</Text>
      </View>

      {/* Usage indicator */}
      <View style={styles.prepaidUsageRow}>
        <View style={styles.prepaidUsageItem}>
          <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
          <Text style={styles.prepaidUsageText}>{sessionsUsed} used</Text>
        </View>
        <View style={styles.prepaidUsageItem}>
          <Ionicons name="time-outline" size={14} color={colors.neutral.textSecondary} />
          <Text style={styles.prepaidUsageText}>{sessionsRemaining} remaining</Text>
        </View>
      </View>

      {/* Payment info */}
      <View style={styles.prepaidPaymentSection}>
        <View style={styles.prepaidPaymentRow}>
          <View>
            <Text style={styles.prepaidPaymentLabel}>Prepaid Amount</Text>
            {isPaid && paidAt && (
              <View style={styles.prepaidPaidRow}>
                <Ionicons name="checkmark-circle" size={12} color={colors.status.success} />
                <Text style={styles.prepaidPaidText}>Paid on {paidAt}</Text>
              </View>
            )}
          </View>
          <Text style={styles.prepaidPaymentAmount}>${amountDue.toFixed(2)}</Text>
        </View>
        <Text style={styles.prepaidSessionInfo}>
          Prepaid for {sessionsTotal - sessionsRolledOver} sessions{sessionsRolledOver > 0 ? ` (${sessionsRolledOver} rolled over)` : ''}
        </Text>
      </View>
    </Pressable>
  );
}

// Overdue Payment Alert Banner Component
function OverdueAlertBanner({ overdueAmount, overdueMonths }: { overdueAmount: number; overdueMonths: number }) {
  return (
    <Pressable
      style={styles.overdueAlertBanner}
      onPress={() => router.push('/(tabs)/payments' as any)}
    >
      <View style={styles.overdueAlertContent}>
        <View style={styles.overdueAlertIconContainer}>
          <Ionicons name="alert-circle" size={20} color={colors.neutral.white} />
        </View>
        <View style={styles.overdueAlertTextContainer}>
          <Text style={styles.overdueAlertTitle}>Outstanding Balance</Text>
          <Text style={styles.overdueAlertSubtitle}>
            ${overdueAmount.toFixed(0)} from {overdueMonths} previous month{overdueMonths > 1 ? 's' : ''}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.neutral.white} style={{ opacity: 0.7 }} />
    </Pressable>
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
    gap: spacing.md,
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
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.md,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
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
  upcomingSubjects: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  upcomingRowGrouped: {
    backgroundColor: colors.piano.subtle,
  },
  upcomingDotGrouped: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
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
  // Assignment styles
  assignmentsContainer: {
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
  assignmentCardOverdue: {
    borderLeftWidth: 3,
    borderLeftColor: colors.status.error,
  },
  assignmentTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  assignmentInfo: {
    flex: 1,
  },
  assignmentType: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  assignmentStudent: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  assignmentDue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.neutral.borderLight,
    borderRadius: borderRadius.sm,
  },
  assignmentDueOverdue: {
    backgroundColor: colors.status.errorBg,
  },
  assignmentDueText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
  assignmentDueTextOverdue: {
    color: colors.status.error,
  },
  // Payment summary styles
  paymentSummaryCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  paymentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentStatItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paymentStatInfo: {
    flex: 1,
  },
  paymentStatLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  paymentStatAmount: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
  },
  paymentStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.neutral.border,
    marginHorizontal: spacing.sm,
  },
  overdueAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  overdueAlertText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
    fontWeight: typography.weights.medium,
  },
  // Parent: Quick Actions styles
  parentActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  parentActionCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
    minWidth: '22%',
    flex: 1,
    ...shadows.sm,
  },
  parentActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  parentActionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    textAlign: 'center',
  },
  // Parent Payment Card styles
  parentPaymentCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  parentPaymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  parentPaymentTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  parentPaymentTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  parentPaymentViewAll: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    fontWeight: typography.weights.medium,
  },
  parentPaymentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  parentPaymentStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  parentPaymentStatLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  parentPaymentStatAmount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
  },
  parentPaymentStatDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.neutral.border,
  },
  parentPaymentFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.borderLight,
  },
  parentPaymentStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  parentPaymentStatusText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  parentPaymentSessions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  parentPaymentSessionsText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  // Overdue Alert Banner styles
  overdueAlertBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.status.error,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  overdueAlertContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  overdueAlertIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  overdueAlertTextContainer: {
    flex: 1,
  },
  overdueAlertTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
  overdueAlertSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.white,
    opacity: 0.9,
    marginTop: 2,
  },
  // Parent Prepaid Card styles
  prepaidCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  prepaidHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.md,
  },
  prepaidTitleRow: {
    flex: 1,
  },
  prepaidTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  prepaidBadge: {
    backgroundColor: colors.piano.subtle,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    alignSelf: 'flex-start',
  },
  prepaidBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.piano.primary,
  },
  prepaidCountContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  prepaidCountLarge: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  prepaidCountSlash: {
    fontSize: typography.sizes.lg,
    color: colors.neutral.textMuted,
    marginHorizontal: 2,
  },
  prepaidCountTotal: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  prepaidCountLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
    marginLeft: spacing.xs,
  },
  prepaidProgressContainer: {
    marginBottom: spacing.md,
  },
  prepaidProgressTrack: {
    height: 8,
    backgroundColor: colors.neutral.borderLight,
    borderRadius: 4,
    overflow: 'hidden',
  },
  prepaidProgressFill: {
    height: '100%',
    backgroundColor: colors.piano.primary,
    borderRadius: 4,
  },
  prepaidRemainingText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  prepaidUsageRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginBottom: spacing.md,
  },
  prepaidUsageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  prepaidUsageText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  prepaidPaymentSection: {
    borderTopWidth: 1,
    borderTopColor: colors.neutral.borderLight,
    paddingTop: spacing.md,
  },
  prepaidPaymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xs,
  },
  prepaidPaymentLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  prepaidPaidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  prepaidPaidText: {
    fontSize: typography.sizes.xs,
    color: colors.status.success,
  },
  prepaidPaymentAmount: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  prepaidSessionInfo: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    fontStyle: 'italic',
  },
  // No prepaid plan card styles
  noPrepaidCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  noPrepaidTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  noPrepaidText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
});
