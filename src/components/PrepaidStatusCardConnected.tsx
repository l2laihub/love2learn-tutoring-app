import React from 'react';
import { PrepaidStatusCard } from './PrepaidStatusCard';
import { usePrepaidUsage } from '../hooks/usePayments';

/**
 * PrepaidStatusCard with `sessionsUsed` / `sessionsRemaining` derived from completed
 * lessons (the single source of truth) rather than the deprecated stored counter, plus
 * the backing lessons for the auditable breakdown. Use this anywhere a prepaid payment
 * row is displayed so the count can't drift.
 */
interface Props {
  parentId: string;
  month: Date;
  paymentSubject: string | null;
  parentName: string;
  studentNames: string[];
  monthDisplay: string;
  sessionsTotal: number;
  sessionsRolledOver?: number;
  amountDue: number;
  isPaid: boolean;
  paidAt?: string;
  notes?: string;
  subject?: string;
  subjectLabel?: string;
  onMarkPaid?: () => void;
  onPreviewParentView?: () => void;
  onSwitchToInvoice?: () => void;
}

export function PrepaidStatusCardConnected({
  parentId,
  month,
  paymentSubject,
  sessionsTotal,
  ...rest
}: Props) {
  const { usage } = usePrepaidUsage(parentId, month, paymentSubject);
  const sessionsUsed = usage?.count ?? 0;

  return (
    <PrepaidStatusCard
      {...rest}
      month={month.toISOString().split('T')[0]}
      sessionsTotal={sessionsTotal}
      sessionsUsed={sessionsUsed}
      sessionsRemaining={Math.max(0, sessionsTotal - sessionsUsed)}
      usageLessons={usage?.lessons}
    />
  );
}

export default PrepaidStatusCardConnected;
