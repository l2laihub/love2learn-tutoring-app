/**
 * LegalLinks
 * DaLesson Tutoring App
 *
 * Privacy Policy · Terms · Help links shown on the Profile screen.
 * App Store Guideline 5.1.1(i) requires the privacy policy to be easy to
 * reach from inside the app, not only from the store listing.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, typography } from '../theme';

const LINKS = [
  { label: 'Privacy Policy', href: '/privacy' },
  { label: 'Terms of Service', href: '/terms' },
  { label: 'Help & Support', href: '/support' },
] as const;

export function LegalLinks() {
  return (
    <View style={styles.row}>
      {LINKS.map((link, i) => (
        <React.Fragment key={link.href}>
          {i > 0 && <Text style={styles.dot}>{'·'}</Text>}
          <Pressable onPress={() => router.push(link.href)} accessibilityRole="link" hitSlop={8}>
            <Text style={styles.link}>{link.label}</Text>
          </Pressable>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  link: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    textDecorationLine: 'underline',
  },
  dot: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textMuted,
  },
});

export default LegalLinks;
