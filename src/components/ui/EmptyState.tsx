import React from 'react';
import { View, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '../../theme';
import { Button } from './Button';

interface EmptyStateProps {
  icon?: keyof typeof Ionicons.glyphMap;
  emoji?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export function EmptyState({
  icon,
  emoji,
  title,
  description,
  actionLabel,
  onAction,
  style,
}: EmptyStateProps) {
  return (
    <View style={[styles.container, style]}>
      {emoji ? (
        <Text style={styles.emoji}>{emoji}</Text>
      ) : icon ? (
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={48} color={colors.neutral.textMuted} />
        </View>
      ) : null}

      <Text style={styles.title}>{title}</Text>

      {description && <Text style={styles.description}>{description}</Text>}

      {actionLabel && onAction && (
        <Button
          title={actionLabel}
          onPress={onAction}
          variant="primary"
          size="md"
          style={styles.button}
        />
      )}
    </View>
  );
}

// Pre-configured empty states for common scenarios
export function NoLessonsToday() {
  return (
    <EmptyState
      emoji="☀️"
      title="No lessons today"
      description="Enjoy your free time! Check the calendar to see upcoming lessons."
    />
  );
}

export function NoStudents({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      emoji="👋"
      title="No students yet"
      description="Add your first student to get started with scheduling and worksheets."
      actionLabel="Add Student"
      onAction={onAdd}
    />
  );
}

export function NoAssignments() {
  return (
    <EmptyState
      emoji="📝"
      title="No assignments"
      description="Create a worksheet and assign it to track student progress."
    />
  );
}

export function NoPaymentsThisMonth() {
  return (
    <EmptyState
      emoji="💰"
      title="No payment records"
      description="Payment records for this month will appear here."
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['3xl'],
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.neutral.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  emoji: {
    fontSize: 64,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  description: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    lineHeight: typography.sizes.base * typography.lineHeights.relaxed,
    maxWidth: 280,
  },
  button: {
    marginTop: spacing.xl,
  },
});

export default EmptyState;
