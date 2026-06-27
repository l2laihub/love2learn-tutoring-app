/**
 * HelpSheet
 * Generic inline "how this works" bottom-sheet — a title plus a short list of points,
 * each an icon + heading + body. Used for the Prepaid and Invoice section explainers
 * (see PrepaidHelpSheet / InvoiceHelpSheet below). Covers only the non-obvious bits;
 * full references live in docs/PREPAID_GUIDE.md.
 */
import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';

export interface HelpPoint {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
}

interface HelpSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  points: HelpPoint[];
}

export function HelpSheet({ visible, onClose, title, points }: HelpSheetProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.neutral.text} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {points.map((p) => (
              <View key={p.title} style={styles.point}>
                <Ionicons name={p.icon} size={22} color={p.color} style={styles.pointIcon} />
                <View style={styles.pointText}>
                  <Text style={styles.pointTitle}>{p.title}</Text>
                  <Text style={styles.pointBody}>{p.body}</Text>
                </View>
              </View>
            ))}
          </ScrollView>

          <Pressable onPress={onClose} style={styles.gotItButton}>
            <Text style={styles.gotItText}>Got it</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const PREPAID_POINTS: HelpPoint[] = [
  {
    icon: 'sync-outline',
    color: colors.piano.primary,
    title: 'Sessions are counted, not tracked',
    body: 'Mark a lesson complete and it draws one session automatically. Un-complete, delete, or edit a lesson and the count fixes itself — there is no manual counter to keep in sync.',
  },
  {
    icon: 'pulse-outline',
    color: colors.status.warning,
    title: 'Read the progress bar',
    body: 'It fills as sessions are used, turns amber at 75%, and red once the bucket is empty. Tap "View sessions used" on a card to see exactly which lessons consumed the balance.',
  },
  {
    icon: 'refresh',
    color: colors.status.info,
    title: 'Rollover is automatic',
    body: "Unused sessions carry into next month's plan. When you create the next plan, last month's sessions and amount are pre-filled and leftovers are added on top.",
  },
  {
    icon: 'warning-outline',
    color: colors.status.error,
    title: 'Heed completion warnings',
    body: '"No active package" means the lesson is uncharged — create a plan for that subject/month. "Over the purchased count" means the family used more than they paid for — top up the bucket.',
  },
];

const INVOICE_POINTS: HelpPoint[] = [
  {
    icon: 'receipt-outline',
    color: colors.piano.primary,
    title: 'Billed after lessons happen',
    body: 'Invoiced families pay after the fact — the opposite of prepaid. Each completed lesson becomes a billable line for the month, priced from that student’s rate.',
  },
  {
    icon: 'document-text-outline',
    color: colors.status.info,
    title: 'Generate from completed lessons',
    body: 'Use Generate Invoice to roll a family’s completed, unbilled lessons into one invoice for the month. Only completed lessons are included.',
  },
  {
    icon: 'checkmark-circle-outline',
    color: colors.math.primary,
    title: 'Track status and mark paid',
    body: 'Invoices show pending, paid, or overdue. Tap Mark Paid when payment arrives. Overdue invoices are surfaced in the alert at the top of the list.',
  },
  {
    icon: 'notifications-outline',
    color: colors.status.warning,
    title: 'Send reminders',
    body: 'Send a reminder to nudge a family about an unpaid or overdue invoice. The card shows when the last reminder went out.',
  },
];

export function PrepaidHelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return <HelpSheet visible={visible} onClose={onClose} title="How prepaid works" points={PREPAID_POINTS} />;
}

export function InvoiceHelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return <HelpSheet visible={visible} onClose={onClose} title="How invoicing works" points={INVOICE_POINTS} />;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: colors.neutral.white,
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    maxHeight: '85%',
    ...shadows.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral.border,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  closeButton: {
    padding: spacing.xs,
  },
  body: {
    padding: spacing.lg,
  },
  point: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
  },
  pointIcon: {
    marginRight: spacing.md,
    marginTop: 2,
  },
  pointText: {
    flex: 1,
  },
  pointTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  pointBody: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
  },
  gotItButton: {
    margin: spacing.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.piano.primary,
    borderRadius: borderRadius.md,
  },
  gotItText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.white,
  },
});

export default HelpSheet;
