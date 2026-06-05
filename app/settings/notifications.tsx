/**
 * Notification Settings
 * Toggle device push notifications on/off for this device.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getPushPermissionStatus,
  requestPushPermission,
  registerForPushNotificationsAsync,
  unregisterPushToken,
} from '../../src/lib/push';
import { colors, spacing, typography, borderRadius, shadows } from '../../src/theme';

export default function NotificationSettingsScreen() {
  const [enabled, setEnabled] = useState(false);
  const [permanentlyDenied, setPermanentlyDenied] = useState(false);

  useEffect(() => {
    getPushPermissionStatus().then((status) => {
      setEnabled(status === 'granted');
      setPermanentlyDenied(status === 'denied');
    });
  }, []);

  const handleToggle = async (next: boolean) => {
    if (next) {
      const granted = await requestPushPermission();
      if (granted) {
        await registerForPushNotificationsAsync();
        setEnabled(true);
        setPermanentlyDenied(false);
      } else {
        // iOS only shows the native dialog once; send them to settings.
        setPermanentlyDenied(true);
        if (Platform.OS === 'ios') Linking.openURL('app-settings:');
      }
    } else {
      await unregisterPushToken();
      setEnabled(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name="notifications" size={24} color={colors.primary.main} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.rowTitle}>Push Notifications</Text>
          <Text style={styles.rowDescription}>
            Get payment, lesson, and message alerts on this device.
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.neutral.border, true: colors.primary.main }}
          thumbColor={colors.neutral.white}
          ios_backgroundColor={colors.neutral.border}
        />
      </View>

      {permanentlyDenied && (
        <Text style={styles.hint}>
          Notifications are turned off in your device settings. Enable them there
          to start receiving push alerts.
        </Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
    padding: spacing.lg,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    ...shadows.sm,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.md,
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
  hint: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    lineHeight: 20,
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
});
