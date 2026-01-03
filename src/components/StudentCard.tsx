import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Card } from './ui/Card';
import { Avatar } from './ui/Avatar';
import { SubjectBadge } from './ui/Badge';
import { colors, spacing, typography, borderRadius } from '../theme';

interface StudentCardProps {
  name: string;
  grade: number;
  subjects: string[];
  parentName: string;
  pianoLevel?: 'beginner' | 'intermediate' | 'advanced';
  nextLesson?: string;
  onPress?: () => void;
}

function gradeToString(grade: number): string {
  if (grade === 0) return 'Kindergarten';
  return `${grade}${getOrdinalSuffix(grade)} Grade`;
}

function getOrdinalSuffix(n: number): string {
  if (n === 1) return 'st';
  if (n === 2) return 'nd';
  if (n === 3) return 'rd';
  return 'th';
}

export function StudentCard({
  name,
  grade,
  subjects,
  parentName,
  pianoLevel,
  nextLesson,
  onPress,
}: StudentCardProps) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Avatar name={name} size="lg" />
        <View style={styles.headerText}>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.grade}>{gradeToString(grade)}</Text>
          <View style={styles.subjects}>
            {subjects.map((subject) => (
              <SubjectBadge key={subject} subject={subject} size="sm" style={styles.subjectBadge} />
            ))}
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
      </View>

      <View style={styles.details}>
        <View style={styles.detailItem}>
          <Ionicons name="person-outline" size={16} color={colors.neutral.textSecondary} />
          <Text style={styles.detailText}>{parentName}</Text>
        </View>

        {pianoLevel && subjects.includes('piano') && (
          <View style={styles.detailItem}>
            <Ionicons name="musical-notes-outline" size={16} color={colors.piano.primary} />
            <Text style={[styles.detailText, { color: colors.piano.primary }]}>
              {pianoLevel.charAt(0).toUpperCase() + pianoLevel.slice(1)}
            </Text>
          </View>
        )}

        {nextLesson && (
          <View style={styles.detailItem}>
            <Ionicons name="calendar-outline" size={16} color={colors.neutral.textSecondary} />
            <Text style={styles.detailText}>Next: {nextLesson}</Text>
          </View>
        )}
      </View>
    </Card>
  );
}

// Subject emoji mapping
const SUBJECT_EMOJIS: Record<string, string> = {
  piano: '🎹',
  math: '➗',
  reading: '📖',
  speech: '🎤',
  english: '📝',
};

const SUBJECT_COLORS: Record<string, string> = {
  piano: colors.piano.primary,
  math: colors.math.primary,
  reading: '#9C27B0',
  speech: '#FF9800',
  english: '#2196F3',
};

// Compact student list item
interface StudentListItemProps {
  name: string;
  subjects: string[];
  onPress?: () => void;
}

export function StudentListItem({ name, subjects, onPress }: StudentListItemProps) {
  return (
    <Pressable onPress={onPress} style={styles.listItem}>
      <Avatar name={name} size="md" />
      <View style={styles.listItemText}>
        <Text style={styles.listItemName}>{name}</Text>
        <View style={styles.listItemSubjects}>
          {subjects.map((subject) => (
            <Text
              key={subject}
              style={[
                styles.listItemSubject,
                { color: SUBJECT_COLORS[subject] || colors.neutral.textSecondary },
              ]}
            >
              {SUBJECT_EMOJIS[subject] || '📚'}
            </Text>
          ))}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.neutral.textMuted} />
    </Pressable>
  );
}

// Student selector for forms
interface StudentSelectorProps {
  students: Array<{ id: string; name: string; subjects: string[] }>;
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function StudentSelector({ students, selectedId, onSelect }: StudentSelectorProps) {
  return (
    <View style={styles.selector}>
      {students.map((student) => {
        const isSelected = student.id === selectedId;
        return (
          <Pressable
            key={student.id}
            onPress={() => onSelect(student.id)}
            style={[styles.selectorItem, isSelected && styles.selectorItemSelected]}
          >
            <Avatar name={student.name} size="sm" />
            <Text
              style={[styles.selectorName, isSelected && styles.selectorNameSelected]}
              numberOfLines={1}
            >
              {student.name}
            </Text>
            {isSelected && (
              <Ionicons name="checkmark-circle" size={18} color={colors.piano.primary} />
            )}
          </Pressable>
        );
      })}
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
  },
  headerText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  grade: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  subjects: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  subjectBadge: {
    marginRight: spacing.xs,
  },
  details: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    gap: spacing.sm,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  detailText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },

  // List item
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.neutral.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  listItemText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  listItemName: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  listItemSubjects: {
    flexDirection: 'row',
    marginTop: 4,
    gap: spacing.xs,
  },
  listItemSubject: {
    fontSize: typography.sizes.sm,
  },

  // Selector
  selector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  selectorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.full,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: spacing.sm,
  },
  selectorItemSelected: {
    borderColor: colors.piano.primary,
    backgroundColor: colors.piano.subtle,
  },
  selectorName: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    maxWidth: 100,
  },
  selectorNameSelected: {
    color: colors.neutral.text,
    fontWeight: typography.weights.medium,
  },
});

export default StudentCard;
