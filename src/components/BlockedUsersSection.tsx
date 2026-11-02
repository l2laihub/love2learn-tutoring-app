/**
 * BlockedUsersSection
 * Lists the people the user has blocked in messages, with Unblock.
 * App Store Guideline 1.2 (User-Generated Content).
 */

import React from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useBlockedUsers } from '../hooks/useModeration';
import { colors, spacing, typography, borderRadius } from '../theme';

export function BlockedUsersSection() {
  const { blocked, loading, unblockUser } = useBlockedUsers();

  const confirmUnblock = (blockedId: string, name: string) => {
    const message = `Unblock ${name}? You'll see their messages again.`;
    if (Platform.OS === 'web') {
      if (window.confirm(message)) unblockUser(blockedId);
      return;
    }
    Alert.alert('Unblock', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Unblock', onPress: () => unblockUser(blockedId) },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="hand-left-outline" size={18} color={colors.neutral.text} />
        <Text style={styles.title}>Blocked people</Text>
      </View>
      {loading && blocked.length === 0 ? (
        <ActivityIndicator color={colors.primary.main} />
      ) : blocked.length === 0 ? (
        <Text style={styles.empty}>
          You haven&apos;t blocked anyone. To block someone, long-press one of their messages and tap
          the flag.
        </Text>
      ) : (
        blocked.map((b) => {
          const name = b.blocked_name || 'Unknown';
          return (
            <View key={b.id} style={styles.row}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Pressable
                onPress={() => confirmUnblock(b.blocked_id, name)}
                style={styles.unblock}
                accessibilityRole="button"
                accessibilityLabel={`Unblock ${name}`}
              >
                <Text style={styles.unblockText}>Unblock</Text>
              </Pressable>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral.border,
    backgroundColor: colors.neutral.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  empty: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.borderLight,
  },
  name: {
    flex: 1,
    fontSize: typography.sizes.base,
    color: colors.neutral.text,
    marginRight: spacing.md,
  },
  unblock: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.primary.main,
  },
  unblockText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary.main,
  },
});

export default BlockedUsersSection;
