import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { SubjectBadge } from './ui/Badge';
import { Avatar } from './ui/Avatar';
import { colors, spacing, typography, borderRadius, getSubjectColor } from '../theme';

interface LessonCardProps {
  studentName: string;
  subject: 'piano' | 'math';
  time: string;
  duration: number;
  status?: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
  onPress?: () => void;
  variant?: 'default' | 'compact';
}

export function LessonCard({
  studentName,
  subject,
  time,
  duration,
  status = 'scheduled',
  notes,
  onPress,
  variant = 'default',
}: LessonCardProps) {
  const subjectColor = getSubjectColor(subject);

  if (variant === 'compact') {
    return (
      <Card
        onPress={onPress}
        accentColor={subjectColor.primary}
        accentPosition="left"
        padding="sm"
        style={styles.compactCard}
      >
        <View style={styles.compactContent}>
          <View style={styles.compactLeft}>
            <Text style={styles.compactTime}>{time}</Text>
            <Text style={styles.compactDuration}>{duration}min</Text>
          </View>
          <View style={styles.compactRight}>
            <Text style={styles.compactName} numberOfLines={1}>
              {studentName}
            </Text>
            <Text style={[styles.compactSubject, { color: subjectColor.primary }]}>
              {subject === 'piano' ? '🎹 Piano' : '➗ Math'}
            </Text>
          </View>
        </View>
      </Card>
    );
  }

  return (
    <Card
      onPress={onPress}
      accentColor={subjectColor.primary}
      accentPosition="left"
      style={styles.card}
    >
      <View style={styles.header}>
        <Avatar name={studentName} size="md" backgroundColor={subjectColor.primary} />
        <View style={styles.headerText}>
          <Text style={styles.studentName}>{studentName}</Text>
          <SubjectBadge subject={subject} size="sm" />
        </View>
        {status === 'completed' && (
          <View style={styles.checkmark}>
            <Ionicons name="checkmark-circle" size={24} color={colors.math.primary} />
          </View>
        )}
        {status === 'cancelled' && (
          <View style={styles.checkmark}>
            <Ionicons name="close-circle" size={24} color={colors.status.error} />
          </View>
        )}
      </View>

      <View style={styles.details}>
        <View style={styles.detailRow}>
          <Ionicons name="time-outline" size={18} color={colors.neutral.textSecondary} />
          <Text style={styles.detailText}>{time}</Text>
        </View>
        <View style={styles.detailRow}>
          <Ionicons name="hourglass-outline" size={18} color={colors.neutral.textSecondary} />
          <Text style={styles.detailText}>{duration} minutes</Text>
        </View>
      </View>

      {notes && (
        <View style={styles.notes}>
          <Text style={styles.notesText} numberOfLines={2}>
            {notes}
          </Text>
        </View>
      )}

      {status === 'scheduled' && (
        <View style={styles.actions}>
          <Pressable style={styles.actionButton}>
            <Ionicons name="checkmark" size={18} color={colors.math.primary} />
            <Text style={[styles.actionText, { color: colors.math.primary }]}>Complete</Text>
          </Pressable>
          <Pressable style={styles.actionButton}>
            <Ionicons name="create-outline" size={18} color={colors.neutral.textSecondary} />
            <Text style={styles.actionText}>Edit</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

// Today's lesson summary component
interface TodaysLessonsProps {
  lessons: Array<{
    id: string;
    studentName: string;
    subject: 'piano' | 'math';
    time: string;
    duration: number;
  }>;
  onLessonPress?: (id: string) => void;
}

export function TodaysLessons({ lessons, onLessonPress }: TodaysLessonsProps) {
  if (lessons.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyEmoji}>☀️</Text>
        <Text style={styles.emptyText}>No lessons scheduled for today</Text>
      </View>
    );
  }

  return (
    <View style={styles.todayContainer}>
      <View style={styles.todayHeader}>
        <Text style={styles.todayTitle}>Today's Schedule</Text>
        <Text style={styles.lessonCount}>
          {lessons.length} lesson{lessons.length > 1 ? 's' : ''}
        </Text>
      </View>
      {lessons.map((lesson) => (
        <LessonCard
          key={lesson.id}
          {...lesson}
          variant="compact"
          onPress={() => onLessonPress?.(lesson.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  studentName: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  checkmark: {
    marginLeft: spacing.sm,
  },
  details: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  notes: {
    marginTop: spacing.md,
    padding: spacing.sm,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.sm,
  },
  notesText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    fontStyle: 'italic',
  },
  actions: {
    flexDirection: 'row',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    gap: spacing.lg,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },

  // Compact variant
  compactCard: {
    marginBottom: spacing.sm,
  },
  compactContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compactLeft: {
    width: 60,
    alignItems: 'flex-start',
  },
  compactTime: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  compactDuration: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  compactRight: {
    flex: 1,
    marginLeft: spacing.md,
  },
  compactName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  compactSubject: {
    fontSize: typography.sizes.sm,
  },

  // Today's lessons
  todayContainer: {
    marginBottom: spacing.lg,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  todayTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  lessonCount: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },

  // Empty state
  emptyContainer: {
    alignItems: 'center',
    padding: spacing['2xl'],
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
  },
});

export default LessonCard;
