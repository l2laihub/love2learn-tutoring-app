/**
 * ParentViewPreviewModal
 * Modal that shows tutors what the parent sees for their prepaid payment status
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Pressable,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { PrepaidStatusCompact } from './PrepaidStatusCard';

interface ParentViewPreviewModalProps {
  visible: boolean;
  onClose: () => void;
  // Parent info
  parentName: string;
  studentNames: string[];
  // Month info
  monthDisplay: string;
  // Prepaid status
  sessionsTotal: number;
  sessionsUsed: number;
  sessionsRemaining: number;
  sessionsRolledOver?: number;
  // Payment info
  amountDue: number;
  isPaid: boolean;
  paidAt?: string;
  notes?: string;
}

export function ParentViewPreviewModal({
  visible,
  onClose,
  parentName,
  studentNames,
  monthDisplay,
  sessionsTotal,
  sessionsUsed,
  sessionsRemaining,
  sessionsRolledOver = 0,
  amountDue,
  isPaid,
  paidAt,
  notes,
}: ParentViewPreviewModalProps) {
  const usagePercent = sessionsTotal > 0 ? (sessionsUsed / sessionsTotal) * 100 : 0;

  let progressColor: string = colors.piano.primary;
  if (usagePercent >= 100) {
    progressColor = colors.status.error;
  } else if (usagePercent >= 75) {
    progressColor = colors.status.warning;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="eye-outline" size={24} color={colors.piano.primary} />
              <View style={styles.headerText}>
                <Text style={styles.title}>Parent View Preview</Text>
                <Text style={styles.subtitle}>What {parentName} sees</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.neutral.text} />
            </Pressable>
          </View>

          {/* Preview Badge */}
          <View style={styles.previewBadge}>
            <Ionicons name="information-circle" size={16} color={colors.piano.primary} />
            <Text style={styles.previewBadgeText}>
              This is a preview of the parent's payment dashboard
            </Text>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Simulated Parent Dashboard Header */}
            <View style={styles.dashboardHeader}>
              <Text style={styles.dashboardTitle}>My Payments</Text>
              <Text style={styles.dashboardSubtitle}>{monthDisplay}</Text>
            </View>

            {/* Prepaid Status Card (Parent View) */}
            <View style={styles.cardContainer}>
              <View style={styles.parentCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>{monthDisplay} Sessions</Text>
                    <View style={[styles.badge, isPaid ? styles.badgePaid : styles.badgeUnpaid]}>
                      <Text style={[styles.badgeText, isPaid ? styles.badgeTextPaid : styles.badgeTextUnpaid]}>
                        {isPaid ? 'Prepaid' : 'Payment Due'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.sessionCounter}>
                    <Text style={styles.sessionCountLarge}>
                      {sessionsUsed}/{sessionsTotal}
                    </Text>
                    <Text style={styles.sessionLabel}>used</Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressContainer}>
                  <View style={styles.progressTrack}>
                    <View
                      style={[
                        styles.progressFill,
                        {
                          width: `${Math.min(usagePercent, 100)}%`,
                          backgroundColor: progressColor,
                        },
                      ]}
                    />
                  </View>
                </View>

                <Text style={styles.remainingText}>
                  {sessionsRemaining} session{sessionsRemaining !== 1 ? 's' : ''} remaining
                </Text>

                {/* Session details */}
                <View style={styles.detailsRow}>
                  <View style={styles.detailItem}>
                    <Ionicons name="checkmark-circle" size={14} color={colors.math.primary} />
                    <Text style={styles.detailText}>{sessionsUsed} used</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="time-outline" size={14} color={colors.piano.primary} />
                    <Text style={styles.detailText}>{sessionsRemaining} remaining</Text>
                  </View>
                  {sessionsRolledOver > 0 && (
                    <View style={styles.detailItem}>
                      <Ionicons name="refresh" size={14} color={colors.neutral.textSecondary} />
                      <Text style={styles.detailText}>{sessionsRolledOver} rolled over</Text>
                    </View>
                  )}
                </View>

                {/* Payment status */}
                <View style={styles.paymentInfo}>
                  <View style={styles.paymentRow}>
                    <Text style={styles.paymentLabel}>Prepaid Amount</Text>
                    <Text style={styles.paymentAmount}>${amountDue.toFixed(2)}</Text>
                  </View>
                  {isPaid && paidAt && (
                    <View style={styles.paidStatus}>
                      <Ionicons name="checkmark-circle" size={14} color={colors.math.primary} />
                      <Text style={styles.paidText}>Paid on {paidAt}</Text>
                    </View>
                  )}
                  {!isPaid && (
                    <View style={styles.unpaidStatus}>
                      <Ionicons name="alert-circle" size={14} color={colors.status.warning} />
                      <Text style={styles.unpaidText}>Payment pending</Text>
                    </View>
                  )}
                </View>

                {notes && (
                  <Text style={styles.notes} numberOfLines={2}>{notes}</Text>
                )}
              </View>
            </View>

            {/* Student info (if available) */}
            {studentNames.length > 0 && (
              <View style={styles.studentsSection}>
                <Text style={styles.studentsLabel}>Students</Text>
                <Text style={styles.studentsNames}>{studentNames.join(', ')}</Text>
              </View>
            )}
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <Pressable onPress={onClose} style={styles.doneButton}>
              <Text style={styles.doneButtonText}>Close Preview</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: colors.neutral.background,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '90%',
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: {
    gap: 2,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  subtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  previewBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.piano.subtle,
    padding: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.md,
  },
  previewBadgeText: {
    fontSize: typography.sizes.sm,
    color: colors.piano.primary,
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  dashboardHeader: {
    marginBottom: spacing.md,
  },
  dashboardTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  dashboardSubtitle: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  cardContainer: {
    marginBottom: spacing.lg,
  },
  parentCard: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    alignSelf: 'flex-start',
  },
  badgePaid: {
    backgroundColor: colors.math.subtle,
  },
  badgeUnpaid: {
    backgroundColor: colors.status.warningBg,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
  },
  badgeTextPaid: {
    color: colors.math.primary,
  },
  badgeTextUnpaid: {
    color: colors.status.warning,
  },
  sessionCounter: {
    alignItems: 'flex-end',
  },
  sessionCountLarge: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  sessionLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  progressContainer: {
    marginBottom: spacing.sm,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.neutral.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  remainingText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  detailsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.borderLight,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  paymentInfo: {
    backgroundColor: colors.neutral.background,
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
  },
  paymentAmount: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  paidStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  paidText: {
    fontSize: typography.sizes.xs,
    color: colors.math.primary,
  },
  unpaidStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  unpaidText: {
    fontSize: typography.sizes.xs,
    color: colors.status.warning,
  },
  notes: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  studentsSection: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  studentsLabel: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.xs,
  },
  studentsNames: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.text,
  },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
    backgroundColor: colors.neutral.white,
  },
  doneButton: {
    backgroundColor: colors.piano.primary,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  doneButtonText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

export default ParentViewPreviewModal;
