/**
 * NotificationBell Component
 * A bell icon with badge that shows unread notification count
 * Provides quick access to notifications
 */

import React from 'react';
import { View, Pressable, StyleSheet, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUnreadNotificationCount } from '../hooks/useNotifications';
import { colors, spacing } from '../theme';

interface NotificationBellProps {
  size?: number;
  color?: string;
  onPress?: () => void;
}

export function NotificationBell({
  size = 24,
  color = colors.neutral.text,
  onPress,
}: NotificationBellProps) {
  const router = useRouter();
  const { count, loading } = useUnreadNotificationCount();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/notifications');
    }
  };

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.container,
        pressed && styles.pressed,
      ]}
      accessibilityLabel={`Notifications${count > 0 ? `, ${count} unread` : ''}`}
      accessibilityRole="button"
    >
      <Ionicons
        name={count > 0 ? 'notifications' : 'notifications-outline'}
        size={size}
        color={color}
      />
      {!loading && count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.xs,
    position: 'relative',
  },
  pressed: {
    opacity: 0.7,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent.main,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.neutral.white,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral.textInverse,
    textAlign: 'center',
  },
});
