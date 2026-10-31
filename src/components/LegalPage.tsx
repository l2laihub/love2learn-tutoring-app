/**
 * LegalPage
 * DaLesson Tutoring App
 *
 * Shared, centred, scrollable shell for the public Privacy, Terms and
 * Support pages. These routes work signed in or out, in the app and on the
 * web (https://dalesson.app/privacy, /terms, /support).
 */

import React, { forwardRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export const LegalPage = forwardRef<ScrollView, { children: React.ReactNode }>(function LegalPage(
  { children },
  ref
) {
  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView ref={ref} contentContainerStyle={styles.scroll}>
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.white,
  },
  scroll: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
});

export default LegalPage;
