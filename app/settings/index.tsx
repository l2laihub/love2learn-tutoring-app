/**
 * Settings Index Screen
 * Navigation hub for tutor settings
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface SettingsItem {
  key: string;
  title: string;
  description: string;
  icon: IoniconsName;
  iconColor: string;
  iconBg: string;
  href: string;
}

const settingsItems: SettingsItem[] = [
  {
    key: 'business',
    title: 'Business Profile',
    description: 'Business name, contact info, logo, and timezone',
    icon: 'briefcase',
    iconColor: colors.primary.main,
    iconBg: colors.primary.subtle,
    href: '/settings/business',
  },
  {
    key: 'subjects',
    title: 'Subjects & Rates',
    description: 'Manage subjects, custom subjects, and pricing',
    icon: 'school',
    iconColor: colors.secondary.main,
    iconBg: colors.secondary.subtle,
    href: '/settings/subjects',
  },
  {
    key: 'subscription',
    title: 'Subscription',
    description: 'View plan details and billing information',
    icon: 'card',
    iconColor: colors.accent.main,
    iconBg: colors.accent.subtle,
    href: '/settings/subscription',
  },
];

function SettingsRow({ item, onPress }: { item: SettingsItem; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.settingsRow,
        pressed && styles.settingsRowPressed,
      ]}
      onPress={onPress}
    >
      <View style={[styles.iconContainer, { backgroundColor: item.iconBg }]}>
        <Ionicons name={item.icon} size={24} color={item.iconColor} />
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.rowTitle}>{item.title}</Text>
        <Text style={styles.rowDescription}>{item.description}</Text>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={colors.neutral.textMuted}
      />
    </Pressable>
  );
}

export default function SettingsIndexScreen() {
  const handlePress = (href: string) => {
    router.push(href as any);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Settings List */}
        <View style={styles.section}>
          {settingsItems.map((item, index) => (
            <View key={item.key}>
              <SettingsRow
                item={item}
                onPress={() => handlePress(item.href)}
              />
              {index < settingsItems.length - 1 && (
                <View style={styles.divider} />
              )}
            </View>
          ))}
        </View>

        {/* Back to App Link */}
        <Pressable
          style={styles.backButton}
          onPress={() => router.push('/(tabs)')}
        >
          <Ionicons name="arrow-back" size={20} color={colors.primary.main} />
          <Text style={styles.backButtonText}>Back to App</Text>
        </Pressable>

        {/* Info Note */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color={colors.primary.main} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Tutor Settings</Text>
            <Text style={styles.infoText}>
              Configure your business profile, manage subjects and rates, and view your subscription details.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
  section: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
    marginBottom: spacing.xl,
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
  },
  settingsRowPressed: {
    backgroundColor: colors.neutral.background,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  rowTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  rowDescription: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginLeft: 48 + spacing.md + spacing.md,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.xl,
    ...shadows.sm,
  },
  backButtonText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.primary.main,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.primary.subtle,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary.main,
  },
  infoContent: {
    flex: 1,
    marginLeft: spacing.md,
  },
  infoTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.primary.dark,
    marginBottom: spacing.xs,
  },
  infoText: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
  },
});
