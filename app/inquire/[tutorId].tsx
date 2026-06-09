/**
 * Public Inquiry Form (unauthenticated)
 * Prospective parents submit here via a tutor's share link: /inquire/<tutorId>.
 * Posts to the submit-inquiry edge function. No session required.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { submitInquiry } from '../../src/hooks/useWaitingList';
import { colors, spacing, typography, borderRadius } from '../../src/theme';

const SUBJECT_OPTIONS = ['Piano', 'Math', 'Reading', 'Speech', 'English'];

export default function InquireScreen() {
  const { tutorId } = useLocalSearchParams<{ tutorId: string }>();

  const [parentName, setParentName] = useState('');
  const [parentEmail, setParentEmail] = useState('');
  const [parentPhone, setParentPhone] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentAge, setStudentAge] = useState('');
  const [studentGrade, setStudentGrade] = useState('');
  const [subjects, setSubjects] = useState<string[]>([]);
  const [availability, setAvailability] = useState('');
  const [message, setMessage] = useState('');
  const [referral, setReferral] = useState('');
  // Honeypot — hidden from humans; bots tend to fill it.
  const [company, setCompany] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const toggleSubject = (s: string) =>
    setSubjects((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]));

  const canSubmit =
    parentName.trim().length > 0 &&
    (parentEmail.trim().length > 0 || parentPhone.trim().length > 0) &&
    !submitting;

  const onSubmit = async () => {
    setErrorMsg(null);
    if (!tutorId) {
      setErrorMsg('This link is invalid.');
      return;
    }
    setSubmitting(true);
    const res = await submitInquiry({
      tutor_id: String(tutorId),
      parent_name: parentName,
      parent_email: parentEmail || null,
      parent_phone: parentPhone || null,
      student_name: studentName || null,
      student_age: studentAge ? parseInt(studentAge, 10) : null,
      student_grade: studentGrade || null,
      subjects,
      preferred_availability: availability || null,
      message: message || null,
      referral_source: referral || null,
      // Honeypot travels in the body; the edge function validates it.
      ...(company ? { company } : {}),
    });
    setSubmitting(false);
    if (res.success) {
      setDone(true);
    } else {
      setErrorMsg("Sorry, we couldn't submit your inquiry. Please try again.");
    }
  };

  if (done) {
    return (
      <View style={styles.centered}>
        <Ionicons name="checkmark-circle" size={64} color={colors.secondary.main} />
        <Text style={styles.thanksTitle}>Thank you!</Text>
        <Text style={styles.thanksBody}>
          Your inquiry has been sent. The tutor will reach out to you soon.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Tutoring Inquiry</Text>
      <Text style={styles.subtitle}>
        Tell us a little about your needs and we'll be in touch.
      </Text>

      <Field label="Your name *">
        <TextInput style={styles.input} value={parentName} onChangeText={setParentName} placeholder="Parent/guardian name" />
      </Field>
      <Field label="Email">
        <TextInput style={styles.input} value={parentEmail} onChangeText={setParentEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
      </Field>
      <Field label="Phone">
        <TextInput style={styles.input} value={parentPhone} onChangeText={setParentPhone} placeholder="(555) 123-4567" keyboardType="phone-pad" />
      </Field>
      <Text style={styles.hint}>Provide at least an email or a phone number.</Text>

      <Field label="Student name">
        <TextInput style={styles.input} value={studentName} onChangeText={setStudentName} placeholder="Child's name" />
      </Field>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Field label="Age">
            <TextInput style={styles.input} value={studentAge} onChangeText={setStudentAge} placeholder="Age" keyboardType="number-pad" />
          </Field>
        </View>
        <View style={{ flex: 1 }}>
          <Field label="Grade">
            <TextInput style={styles.input} value={studentGrade} onChangeText={setStudentGrade} placeholder="Grade" />
          </Field>
        </View>
      </View>

      <Field label="Subjects of interest">
        <View style={styles.chips}>
          {SUBJECT_OPTIONS.map((s) => {
            const active = subjects.includes(s);
            return (
              <Pressable key={s} style={[styles.chip, active && styles.chipActive]} onPress={() => toggleSubject(s)}>
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="Preferred days/times">
        <TextInput style={styles.input} value={availability} onChangeText={setAvailability} placeholder="e.g. weekday afternoons" />
      </Field>
      <Field label="Tell us about your needs">
        <TextInput style={[styles.input, styles.multiline]} value={message} onChangeText={setMessage} placeholder="Goals, level, anything else" multiline />
      </Field>
      <Field label="How did you hear about us?">
        <TextInput style={styles.input} value={referral} onChangeText={setReferral} placeholder="Referral, search, social…" />
      </Field>

      {/* Honeypot field: visually hidden, off-screen. Real users won't fill it. */}
      <TextInput
        value={company}
        onChangeText={setCompany}
        style={styles.honeypot}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      />

      {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

      <Pressable style={[styles.submit, !canSubmit && styles.submitDisabled]} onPress={onSubmit} disabled={!canSubmit}>
        {submitting ? (
          <ActivityIndicator color={colors.neutral.white} />
        ) : (
          <Text style={styles.submitText}>Send inquiry</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.background },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, maxWidth: 640, width: '100%', alignSelf: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.md, backgroundColor: colors.neutral.background },
  title: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.neutral.text },
  subtitle: { fontSize: typography.sizes.base, color: colors.neutral.textSecondary, marginBottom: spacing.lg },
  thanksTitle: { fontSize: typography.sizes.xl, fontWeight: typography.weights.bold, color: colors.neutral.text },
  thanksBody: { fontSize: typography.sizes.base, color: colors.neutral.textSecondary, textAlign: 'center' },
  field: { marginBottom: spacing.md },
  label: { fontSize: typography.sizes.xs, color: colors.neutral.textSecondary, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: colors.neutral.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
    color: colors.neutral.text,
  },
  multiline: { minHeight: 90, textAlignVertical: 'top' },
  hint: { fontSize: typography.sizes.xs, color: colors.neutral.textSecondary, marginBottom: spacing.md },
  row: { flexDirection: 'row', gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.white,
  },
  chipActive: { backgroundColor: colors.primary.main, borderColor: colors.primary.main },
  chipText: { color: colors.neutral.text },
  chipTextActive: { color: colors.neutral.white, fontWeight: typography.weights.semibold },
  honeypot: { position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 },
  error: { color: '#E53935', marginBottom: spacing.md },
  submit: {
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.neutral.white, fontWeight: typography.weights.bold, fontSize: typography.sizes.md },
});
