import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PrepaidStatusCompact } from './PrepaidStatusCard';
import { usePrepaidPayments, usePrepaidUsage } from '../hooks/usePayments';
import { colors, spacing, typography } from '../theme';
import type { PaymentWithParent } from '../types/database';

/**
 * Current-month prepaid status for a student's family, shown on the student detail screen
 * so a tutor can see remaining sessions in context. Renders one compact card per prepaid
 * package (a hybrid family can have several per-subject packages). sessionsUsed is derived
 * from completed lessons. Renders nothing when the family has no prepaid package this month.
 */
export function StudentPrepaidSection({ parentId }: { parentId: string }) {
  const month = useMemo(() => new Date(), []);
  const { data: prepaidPayments, loading } = usePrepaidPayments(month);
  const packages = prepaidPayments.filter((p) => p.parent_id === parentId);

  if (loading || packages.length === 0) return null;

  const monthDisplay = month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Prepaid Sessions</Text>
      {packages.map((p) => (
        <ConnectedCompact key={p.id} parentId={parentId} month={month} monthDisplay={monthDisplay} payment={p} />
      ))}
    </View>
  );
}

function ConnectedCompact({
  parentId,
  month,
  monthDisplay,
  payment,
}: {
  parentId: string;
  month: Date;
  monthDisplay: string;
  payment: PaymentWithParent;
}) {
  const { usage } = usePrepaidUsage(parentId, month, payment.subject);
  const used = usage?.count ?? 0;
  const total = payment.sessions_prepaid || 0;
  const label = payment.subject
    ? `${payment.subject.charAt(0).toUpperCase()}${payment.subject.slice(1)} · ${monthDisplay}`
    : monthDisplay;

  return (
    <PrepaidStatusCompact
      sessionsTotal={total}
      sessionsUsed={used}
      sessionsRemaining={Math.max(0, total - used)}
      isPaid={payment.status === 'paid'}
      monthDisplay={label}
    />
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.md,
  },
});

export default StudentPrepaidSection;
