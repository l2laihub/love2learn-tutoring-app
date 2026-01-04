/**
 * Parent Profile Screen
 * Shows parent info, preferences, and their children
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthContext } from '../src/contexts/AuthContext';
import { useStudents } from '../src/hooks/useStudents';
import { colors, spacing, typography, borderRadius, shadows, getSubjectColor, Subject } from '../src/theme';
import { Student } from '../src/types/database';

// Subject display names
const subjectNames: Record<Subject, string> = {
  piano: 'Piano',
  math: 'Math',
  reading: 'Reading',
  speech: 'Speech',
  english: 'English',
};

// Subject emoji mapping
const subjectEmojis: Record<Subject, string> = {
  piano: '🎹',
  math: '➗',
  reading: '📚',
  speech: '🗣️',
  english: '📝',
};

export default function ProfileScreen() {
  const { parent, signOut } = useAuthContext();
  const { data: students, loading: studentsLoading, refetch: refetchStudents } = useStudents();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetchStudents();
    setRefreshing(false);
  }, [refetchStudents]);

  const handleSignOut = async () => {
    const confirmSignOut = Platform.OS === 'web'
      ? window.confirm('Are you sure you want to sign out?')
      : await new Promise<boolean>((resolve) => {
          Alert.alert(
            'Sign Out',
            'Are you sure you want to sign out?',
            [
              { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
              { text: 'Sign Out', onPress: () => resolve(true), style: 'destructive' },
            ]
          );
        });

    if (confirmSignOut) {
      const { error } = await signOut();
      if (!error) {
        router.replace('/(auth)/login');
      }
    }
  };

  // Format notification preferences for display
  const getNotificationPreferences = () => {
    const prefs = parent?.preferences?.notifications;
    if (!prefs) return [];

    const items = [];
    if (prefs.lesson_reminders) {
      items.push({
        icon: 'notifications' as const,
        label: 'Lesson Reminders',
        value: `${prefs.lesson_reminders_hours_before || 24}h before`,
      });
    }
    if (prefs.worksheet_assigned) {
      items.push({
        icon: 'document-text' as const,
        label: 'Worksheet Notifications',
        value: 'Enabled',
      });
    }
    if (prefs.payment_due) {
      items.push({
        icon: 'card' as const,
        label: 'Payment Reminders',
        value: 'Enabled',
      });
    }
    if (prefs.lesson_notes) {
      items.push({
        icon: 'chatbubble-ellipses' as const,
        label: 'Lesson Notes',
        value: 'Enabled',
      });
    }
    return items;
  };

  const notificationPrefs = getNotificationPreferences();

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Profile',
          headerStyle: { backgroundColor: colors.primary.main },
          headerTintColor: colors.neutral.white,
          headerBackTitle: 'Back',
        }}
      />
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            <View style={styles.avatarContainer}>
              <Ionicons name="person" size={40} color={colors.primary.main} />
            </View>
            <Text style={styles.profileName}>{parent?.name || 'Parent'}</Text>
            <Text style={styles.profileEmail}>{parent?.email}</Text>
            {parent?.phone && (
              <Text style={styles.profilePhone}>{parent.phone}</Text>
            )}
          </View>

          {/* Contact Preference */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Preference</Text>
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <View style={styles.infoIcon}>
                  <Ionicons
                    name={parent?.preferences?.contact_preference === 'phone' ? 'call' : 'mail'}
                    size={20}
                    color={colors.primary.main}
                  />
                </View>
                <View style={styles.infoContent}>
                  <Text style={styles.infoLabel}>Preferred Contact Method</Text>
                  <Text style={styles.infoValue}>
                    {(parent?.preferences?.contact_preference || 'email').charAt(0).toUpperCase() +
                      (parent?.preferences?.contact_preference || 'email').slice(1)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Notification Preferences */}
          {notificationPrefs.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notifications</Text>
              <View style={styles.card}>
                {notificationPrefs.map((pref, index) => (
                  <View
                    key={pref.label}
                    style={[
                      styles.infoRow,
                      index < notificationPrefs.length - 1 && styles.infoRowBorder,
                    ]}
                  >
                    <View style={styles.infoIcon}>
                      <Ionicons name={pref.icon} size={20} color={colors.primary.main} />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={styles.infoLabel}>{pref.label}</Text>
                      <Text style={styles.infoValue}>{pref.value}</Text>
                    </View>
                    <Ionicons name="checkmark-circle" size={20} color={colors.status.success} />
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* My Children */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Children</Text>
            {students.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={48} color={colors.neutral.textMuted} />
                <Text style={styles.emptyTitle}>No children yet</Text>
                <Text style={styles.emptyText}>
                  Your tutor will add your children to the system.
                </Text>
              </View>
            ) : (
              <View style={styles.childrenList}>
                {students.map((student) => (
                  <ChildCard key={student.id} student={student} />
                ))}
              </View>
            )}
          </View>

          {/* Quick Links */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Links</Text>
            <View style={styles.linksCard}>
              <Pressable
                style={styles.linkRow}
                onPress={() => router.push('/agreement')}
              >
                <View style={[styles.linkIcon, { backgroundColor: colors.status.successBg }]}>
                  <Ionicons name="document-text" size={20} color={colors.status.success} />
                </View>
                <Text style={styles.linkLabel}>View Service Agreement</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
              </Pressable>

              <View style={styles.linkDivider} />

              <Pressable
                style={styles.linkRow}
                onPress={() => router.push('/(tabs)/calendar')}
              >
                <View style={[styles.linkIcon, { backgroundColor: colors.accent.subtle }]}>
                  <Ionicons name="calendar" size={20} color={colors.accent.main} />
                </View>
                <Text style={styles.linkLabel}>Lesson Schedule</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
              </Pressable>

              <View style={styles.linkDivider} />

              <Pressable
                style={styles.linkRow}
                onPress={() => router.push('/(tabs)/worksheets')}
              >
                <View style={[styles.linkIcon, { backgroundColor: colors.status.infoBg }]}>
                  <Ionicons name="document" size={20} color={colors.status.info} />
                </View>
                <Text style={styles.linkLabel}>Worksheets</Text>
                <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
              </Pressable>
            </View>
          </View>

          {/* Sign Out Button */}
          <View style={styles.section}>
            <Pressable style={styles.signOutButton} onPress={handleSignOut}>
              <Ionicons name="log-out-outline" size={20} color={colors.status.error} />
              <Text style={styles.signOutText}>Sign Out</Text>
            </Pressable>
          </View>

          {/* Account Info */}
          <View style={styles.accountInfo}>
            <Text style={styles.accountInfoText}>
              Member since {parent?.created_at
                ? new Date(parent.created_at).toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })
                : 'N/A'}
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </>
  );
}

// Child Card Component
function ChildCard({ student }: { student: Student }) {
  const subjects = student.subjects || [];

  return (
    <View style={styles.childCard}>
      <View style={styles.childHeader}>
        <View style={styles.childAvatar}>
          <Ionicons name="person" size={24} color={colors.primary.main} />
        </View>
        <View style={styles.childInfo}>
          <Text style={styles.childName}>{student.name}</Text>
          <Text style={styles.childMeta}>
            Age {student.age} · Grade {student.grade_level}
          </Text>
        </View>
      </View>

      {subjects.length > 0 && (
        <View style={styles.childSubjects}>
          <Text style={styles.childSubjectsLabel}>Subjects:</Text>
          <View style={styles.subjectTags}>
            {subjects.map((subject) => {
              const subjectColor = getSubjectColor(subject as Subject);
              return (
                <View
                  key={subject}
                  style={[styles.subjectTag, { backgroundColor: subjectColor.subtle }]}
                >
                  <Text style={{ fontSize: 12 }}>
                    {subjectEmojis[subject as Subject] || '📖'}
                  </Text>
                  <Text style={[styles.subjectTagText, { color: subjectColor.primary }]}>
                    {subjectNames[subject as Subject] || subject}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {student.hourly_rate && (
        <View style={styles.childRate}>
          <Ionicons name="cash-outline" size={16} color={colors.neutral.textSecondary} />
          <Text style={styles.childRateText}>
            ${student.hourly_rate}/hour
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  profileHeader: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    marginBottom: spacing.lg,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  profileName: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
  profilePhone: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: spacing.xs,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  infoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  infoValue: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginTop: 2,
  },
  emptyCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: 'center',
    ...shadows.sm,
  },
  emptyTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginTop: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  childrenList: {
    gap: spacing.md,
  },
  childCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  childHeader: {
    flexDirection: 'row',
    alignItems: 'center',
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
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  childMeta: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  childSubjects: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  childSubjectsLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
  },
  subjectTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  subjectTagText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
  },
  childRate: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  childRateText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  linksCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    ...shadows.sm,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  linkLabel: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
  },
  linkDivider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginHorizontal: spacing.md,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadows.sm,
  },
  signOutText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.status.error,
  },
  accountInfo: {
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  accountInfoText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
});
