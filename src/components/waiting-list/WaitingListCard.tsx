import React from 'react';
import { View, Text, StyleSheet, Pressable, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WaitingListEntry, WaitingListStatus } from '../../types/database';
import { getWaitingListStatusInfo } from '../../hooks/useWaitingList';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface WaitingListCardProps {
  entry: WaitingListEntry;
  onAdvance: (entry: WaitingListEntry, next: WaitingListStatus) => void;
  onEditNotes: (entry: WaitingListEntry) => void;
  onDelete: (entry: WaitingListEntry) => void;
}

// Linear primary path; converted/declined are terminal.
function nextStatus(status: WaitingListStatus): WaitingListStatus | null {
  switch (status) {
    case 'new':
      return 'contacted';
    case 'contacted':
      return 'waitlisted';
    case 'waitlisted':
      return 'converted';
    default:
      return null;
  }
}

export function WaitingListCard({
  entry,
  onAdvance,
  onEditNotes,
  onDelete,
}: WaitingListCardProps) {
  const statusInfo = getWaitingListStatusInfo(entry.status);
  const next = nextStatus(entry.status);
  const isClosed = entry.status === 'converted' || entry.status === 'declined';

  const call = () => {
    if (entry.parent_phone) Linking.openURL(`tel:${entry.parent_phone}`);
  };
  const email = () => {
    if (entry.parent_email) Linking.openURL(`mailto:${entry.parent_email}`);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.name}>{entry.parent_name}</Text>
        <View style={[styles.badge, { backgroundColor: statusInfo.bgColor }]}>
          <Ionicons
            name={statusInfo.icon as IoniconsName}
            size={14}
            color={statusInfo.color}
          />
          <Text style={[styles.badgeText, { color: statusInfo.color }]}>
            {statusInfo.label}
          </Text>
        </View>
      </View>

      {entry.student_name ? (
        <Text style={styles.detail}>
          Student: {entry.student_name}
          {entry.student_grade ? ` · ${entry.student_grade}` : ''}
          {entry.student_age != null ? ` · age ${entry.student_age}` : ''}
        </Text>
      ) : null}

      {entry.subjects?.length ? (
        <Text style={styles.detail}>Subjects: {entry.subjects.join(', ')}</Text>
      ) : null}

      {entry.preferred_availability ? (
        <Text style={styles.detail}>Availability: {entry.preferred_availability}</Text>
      ) : null}

      {entry.message ? <Text style={styles.message}>"{entry.message}"</Text> : null}

      {entry.referral_source ? (
        <Text style={styles.detailMuted}>Heard via: {entry.referral_source}</Text>
      ) : null}

      {entry.tutor_notes ? (
        <Text style={styles.notes}>Notes: {entry.tutor_notes}</Text>
      ) : null}

      <View style={styles.actions}>
        {entry.parent_phone ? (
          <Pressable style={styles.actionBtn} onPress={call}>
            <Ionicons name="call-outline" size={18} color={colors.primary.main} />
            <Text style={styles.actionText}>Call</Text>
          </Pressable>
        ) : null}
        {entry.parent_email ? (
          <Pressable style={styles.actionBtn} onPress={email}>
            <Ionicons name="mail-outline" size={18} color={colors.primary.main} />
            <Text style={styles.actionText}>Email</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.actionBtn} onPress={() => onEditNotes(entry)}>
          <Ionicons name="create-outline" size={18} color={colors.primary.main} />
          <Text style={styles.actionText}>Notes</Text>
        </Pressable>
      </View>

      <View style={styles.statusRow}>
        {next ? (
          <Pressable
            style={[styles.statusBtn, styles.advanceBtn]}
            onPress={() => onAdvance(entry, next)}
          >
            <Text style={styles.advanceText}>
              Mark {getWaitingListStatusInfo(next).label}
            </Text>
          </Pressable>
        ) : null}
        {!isClosed ? (
          <Pressable
            style={[styles.statusBtn, styles.declineBtn]}
            onPress={() => onAdvance(entry, 'declined')}
          >
            <Text style={styles.declineText}>Decline</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.statusBtn, styles.deleteBtn]}
            onPress={() => onDelete(entry)}
          >
            <Ionicons name="trash-outline" size={16} color="#E53935" />
            <Text style={styles.declineText}>Remove</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  name: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    flexShrink: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  badgeText: { fontSize: typography.sizes.xs, fontWeight: typography.weights.semibold },
  detail: { fontSize: typography.sizes.base, color: colors.neutral.text, marginTop: 2 },
  detailMuted: { fontSize: typography.sizes.xs, color: colors.neutral.textSecondary, marginTop: 2 },
  message: {
    fontSize: typography.sizes.base,
    color: colors.neutral.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.xs,
  },
  notes: { fontSize: typography.sizes.xs, color: colors.neutral.text, marginTop: spacing.xs },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontSize: typography.sizes.xs, color: colors.primary.main, fontWeight: typography.weights.semibold },
  statusRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  statusBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
  },
  advanceBtn: { backgroundColor: colors.primary.main, flex: 1 },
  advanceText: { color: colors.neutral.white, fontWeight: typography.weights.semibold, fontSize: typography.sizes.sm },
  declineBtn: { backgroundColor: '#FFEBEE' },
  deleteBtn: { backgroundColor: '#FFEBEE' },
  declineText: { color: '#E53935', fontWeight: typography.weights.semibold, fontSize: typography.sizes.sm },
});
