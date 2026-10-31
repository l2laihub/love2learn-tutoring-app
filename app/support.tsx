/**
 * Help & Support (public)
 * Served in the app and at https://dalesson.app/support. This is the App
 * Store "Support URL", and /support#delete-account is the account deletion
 * web link that Google Play asks for.
 */
import React, { useEffect, useRef } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LegalPage } from '../src/components/LegalPage';
import { colors, spacing, typography, borderRadius } from '../src/theme';

const SUPPORT_EMAIL = 'support@dalesson.app';
const PRIVACY_EMAIL = 'privacy@dalesson.app';

type IoniconName = keyof typeof Ionicons.glyphMap;

function Row({ icon, title, detail, onPress }: { icon: IoniconName; title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.rowPressed]} onPress={onPress} accessibilityRole="link">
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={20} color={colors.primary.main} />
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowDetail}>{detail}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.neutral.textMuted} />
    </Pressable>
  );
}

export default function SupportScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const deleteY = useRef(0);

  // Honour https://dalesson.app/support#delete-account on the web.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    if (window.location.hash === '#delete-account') {
      const t = setTimeout(() => scrollRef.current?.scrollTo({ y: deleteY.current, animated: false }), 300);
      return () => clearTimeout(t);
    }
  }, []);

  const mail = (to: string, subject: string) =>
    Linking.openURL(`mailto:${to}?subject=${encodeURIComponent(subject)}`).catch(() => undefined);

  return (
    <LegalPage ref={scrollRef}>
      <Text style={styles.title} accessibilityRole="header">Help & Support</Text>
      <Text style={styles.lead}>
        Questions about DaLesson, your account, or your data? We read every message.
      </Text>

      <Text style={styles.section} accessibilityRole="header">Contact us</Text>
      <View style={styles.card}>
        <Row icon="mail" title="Email support" detail={SUPPORT_EMAIL} onPress={() => mail(SUPPORT_EMAIL, 'DaLesson support')} />
        <View style={styles.divider} />
        <Row icon="shield-checkmark" title="Privacy questions" detail={PRIVACY_EMAIL} onPress={() => mail(PRIVACY_EMAIL, 'DaLesson privacy request')} />
      </View>
      <Text style={styles.note}>
        Tip: include the email address you use to sign in, and whether you are a tutor or a parent.
      </Text>

      <View nativeID="delete-account" onLayout={(e) => (deleteY.current = e.nativeEvent.layout.y)}>
        <Text style={styles.section} accessibilityRole="header">Delete your account</Text>
        <Text style={styles.body}>You can delete your account yourself in the app:</Text>
        <View style={styles.steps}>
          {['Sign in to DaLesson.', 'Open More, then Profile.', 'Scroll to the bottom and tap Delete Account.', 'Type DELETE to confirm.'].map((step, i) => (
            <View key={step} style={styles.step}>
              <Text style={styles.stepNum}>{i + 1}</Text>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.body}>
          <Text style={styles.bold}>Tutors:</Text> this deletes your account and your business data (students, lessons,
          notes, payment records, worksheets and messages), and cancels any active subscription.
        </Text>
        <Text style={styles.body}>
          <Text style={styles.bold}>Parents:</Text> this deletes your login and personal settings. Your tutor keeps their
          lesson and payment records for your family. Ask your tutor, or email us, to have those removed too.
        </Text>
        <Text style={styles.body}>
          Can't sign in? Email{' '}
          <Text style={styles.link} onPress={() => mail(PRIVACY_EMAIL, 'Delete my DaLesson account')}>{PRIVACY_EMAIL}</Text>
          {' '}from the address on your account and ask us to delete it. We will confirm once it is done.
        </Text>
      </View>

      <Text style={styles.section} accessibilityRole="header">Policies</Text>
      <View style={styles.card}>
        <Row icon="document-text" title="Privacy Policy" detail="How we handle your data" onPress={() => router.push('/privacy')} />
        <View style={styles.divider} />
        <Row icon="reader" title="Terms of Service" detail="The rules for using DaLesson" onPress={() => router.push('/terms')} />
      </View>
    </LegalPage>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginBottom: spacing.sm,
  },
  lead: {
    fontSize: typography.sizes.base,
    lineHeight: 23,
    color: colors.neutral.textSecondary,
  },
  section: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
    marginTop: spacing['2xl'],
    marginBottom: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.base,
    gap: spacing.md,
    backgroundColor: colors.neutral.white,
  },
  rowPressed: { backgroundColor: colors.neutral.background },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1 },
  rowTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  rowDetail: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginTop: 2,
  },
  divider: { height: 1, backgroundColor: colors.neutral.border, marginLeft: 64 },
  note: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
    marginTop: spacing.sm,
  },
  body: {
    fontSize: typography.sizes.base,
    lineHeight: 23,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.md,
  },
  bold: { fontWeight: typography.weights.semibold, color: colors.neutral.text },
  link: { color: colors.primary.main, textDecorationLine: 'underline' },
  steps: { marginBottom: spacing.md },
  step: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: spacing.sm },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.accent.main,
    color: colors.neutral.white,
    textAlign: 'center',
    lineHeight: 24,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    marginRight: spacing.md,
    overflow: 'hidden',
  },
  stepText: {
    flex: 1,
    fontSize: typography.sizes.base,
    lineHeight: 24,
    color: colors.neutral.text,
  },
});
