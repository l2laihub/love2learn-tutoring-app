/**
 * Openings screen (tutor-only)
 *
 * Lists bookable 30-minute open slots per day for a navigable week, so a tutor
 * can instantly answer "do you have anything open?" when a parent asks to
 * reschedule. Slots match what a parent sees in RescheduleRequestModal.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../src/theme';
import { useAuthContext } from '../src/contexts/AuthContext';
import { useTutorBranding, DEFAULT_TIMEZONE } from '../src/hooks/useTutorBranding';
import {
  getWeekStartInTimezone,
  addDaysInTimezone,
} from '../src/utils/dateUtils';
import { useWeekOpenSlots, DayOpenings } from '../src/hooks/useWeekOpenSlots';
import { formatTimeDisplay } from '../src/hooks/useTutorAvailability';

function formatWeekRange(days: DayOpenings[], timezone: string): string {
  if (days.length === 0) return '';
  const fmt = (d: Date) =>
    new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      month: 'short',
      day: 'numeric',
    }).format(d);
  return `${fmt(days[0].date)} – ${fmt(days[days.length - 1].date)}`;
}

export default function OpeningsScreen() {
  const { isTutor, parent } = useAuthContext();
  const { data: tutorBranding } = useTutorBranding();
  const timezone = tutorBranding?.timezone || DEFAULT_TIMEZONE;

  // Seed with DEFAULT_TIMEZONE because tutor branding hasn't loaded on first
  // render, mirroring app/(tabs)/calendar.tsx. The day rows recompute in the
  // tutor's real timezone once branding loads; only the fetch window stays
  // anchored to the seed until the tutor navigates weeks. The resulting edge
  // misalignment is at most the tz offset around midnight (no tutoring then),
  // and pressing prev/next/this-week re-derives it in the correct timezone.
  const [weekStart, setWeekStart] = useState<Date>(() =>
    getWeekStartInTimezone(new Date(), DEFAULT_TIMEZONE)
  );
  const [refreshing, setRefreshing] = useState(false);

  const { days, loading, error, refetch } = useWeekOpenSlots(
    parent?.id,
    weekStart,
    timezone
  );

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const goToPreviousWeek = () =>
    setWeekStart((w) => addDaysInTimezone(w, -7, timezone));
  const goToNextWeek = () =>
    setWeekStart((w) => addDaysInTimezone(w, 7, timezone));
  const goToThisWeek = () =>
    setWeekStart(getWeekStartInTimezone(new Date(), timezone));

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  // Tutor-only screen.
  if (!isTutor) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* Week navigation */}
      <View style={styles.weekNav}>
        <Pressable
          style={styles.navButton}
          onPress={goToPreviousWeek}
          accessibilityRole="button"
          accessibilityLabel="Previous week"
        >
          <Ionicons name="chevron-back" size={24} color={colors.neutral.text} />
        </Pressable>
        <Pressable
          style={styles.weekRange}
          onPress={goToThisWeek}
          accessibilityRole="button"
          accessibilityLabel="Go to this week"
        >
          <Text style={styles.weekRangeText}>{formatWeekRange(days, timezone)}</Text>
          <Text style={styles.weekRangeHint}>Tap for this week</Text>
        </Pressable>
        <Pressable
          style={styles.navButton}
          onPress={goToNextWeek}
          accessibilityRole="button"
          accessibilityLabel="Next week"
        >
          <Ionicons name="chevron-forward" size={24} color={colors.neutral.text} />
        </Pressable>
      </View>

      {loading && days.every((d) => d.slots.length === 0) ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary.main} />
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={48} color={colors.status.error} />
          <Text style={styles.errorText}>Couldn't load openings. Pull to retry.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
        >
          {days.map((day) => (
            <View key={day.dayLabel} style={styles.dayCard}>
              <View style={styles.dayHeader}>
                <Text style={styles.dayLabel}>{day.dayLabel}</Text>
                {day.state === 'open' && (
                  <Text style={styles.slotCount}>
                    {day.slots.length} open
                  </Text>
                )}
              </View>

              {day.state === 'no-availability' ? (
                <Text style={styles.emptyText}>No availability set</Text>
              ) : day.state === 'fully-booked' ? (
                <Text style={styles.emptyText}>Fully booked</Text>
              ) : (
                <View style={styles.slotsGrid}>
                  {day.slots.map((time) => (
                    <View key={time} style={styles.slotChip}>
                      <Text style={styles.slotChipText}>{formatTimeDisplay(time)}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    backgroundColor: colors.neutral.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  navButton: {
    padding: spacing.sm,
  },
  weekRange: {
    flex: 1,
    alignItems: 'center',
  },
  weekRangeText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  weekRangeHint: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  errorText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
  },
  content: {
    padding: spacing.base,
    gap: spacing.md,
  },
  dayCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  dayLabel: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  slotCount: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  slotChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary.subtle,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary.main,
  },
  slotChipText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
});
