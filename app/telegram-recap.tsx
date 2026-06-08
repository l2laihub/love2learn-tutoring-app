/**
 * Weekly Telegram Recap settings (tutor-only).
 * Connect/disconnect Telegram, toggle the recap, and send a preview.
 */

import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Switch, Linking, Alert, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTutorTelegram } from '../src/hooks/useTutorTelegram';
import { colors, spacing, typography, borderRadius, shadows } from '../src/theme';

export default function TelegramRecapScreen() {
  const { status, loading, refetch, getLinkUrl, sendPreview, setEnabled, disconnect } = useTutorTelegram();
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch]),
  );

  const handleConnect = async () => {
    setBusy(true);
    try {
      const url = await getLinkUrl();
      await Linking.openURL(url);
    } catch (e) {
      Alert.alert('Could not start linking', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handlePreview = async () => {
    setBusy(true);
    try {
      await sendPreview();
      Alert.alert('Sent', 'A preview recap was sent to your Telegram.');
    } catch (e) {
      Alert.alert('Could not send preview', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleToggle = async (next: boolean) => {
    setBusy(true);
    try {
      await setEnabled(next);
    } catch (e) {
      Alert.alert('Could not update setting', e instanceof Error ? e.message : 'Try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = () => {
    Alert.alert('Disconnect Telegram?', 'You will stop receiving weekly recaps.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await disconnect();
          } catch (e) {
            Alert.alert('Could not disconnect', e instanceof Error ? e.message : 'Try again.');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.center]} edges={['bottom']}>
        <ActivityIndicator color={colors.primary.main} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <Ionicons name="paper-plane" size={24} color={colors.primary.main} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.rowTitle}>Weekly Telegram Recap</Text>
          <Text style={styles.rowDescription}>
            Every Saturday morning, get last week&apos;s classes (Sun–Fri) and a
            payment summary delivered to Telegram.
          </Text>
        </View>
      </View>

      {!status?.linked ? (
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={handleConnect}
          disabled={busy}
        >
          <Ionicons name="link" size={18} color={colors.neutral.white} />
          <Text style={styles.primaryBtnText}>{busy ? 'Opening…' : 'Connect Telegram'}</Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.card}>
            <View style={styles.textContainer}>
              <Text style={styles.rowTitle}>Connected</Text>
              <Text style={styles.rowDescription}>
                {status.username ? `@${status.username}` : 'Your Telegram is linked.'}
              </Text>
            </View>
            <Switch
              value={status.enabled}
              onValueChange={handleToggle}
              disabled={busy}
              trackColor={{ false: colors.neutral.border, true: colors.primary.main }}
              thumbColor={colors.neutral.white}
              ios_backgroundColor={colors.neutral.border}
            />
          </View>

          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={handlePreview}
            disabled={busy}
          >
            <Ionicons name="send" size={18} color={colors.primary.main} />
            <Text style={styles.secondaryBtnText}>{busy ? 'Sending…' : 'Send preview now'}</Text>
          </Pressable>

          <Pressable onPress={handleDisconnect} disabled={busy} style={styles.disconnect}>
            <Text style={styles.disconnectText}>Disconnect</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.neutral.background, padding: spacing.lg },
  center: { justifyContent: 'center', alignItems: 'center' },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
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
  textContainer: { flex: 1, marginRight: spacing.md },
  rowTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: 2,
  },
  rowDescription: { fontSize: typography.sizes.sm, color: colors.neutral.textSecondary, lineHeight: 18 },
  primaryBtn: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.main,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  primaryBtnText: { color: colors.neutral.white, fontWeight: typography.weights.semibold, fontSize: typography.sizes.md },
  secondaryBtn: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.subtle,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  secondaryBtnText: { color: colors.primary.main, fontWeight: typography.weights.semibold, fontSize: typography.sizes.md },
  pressed: { opacity: 0.85 },
  disconnect: { padding: spacing.md, alignItems: 'center', marginTop: spacing.sm },
  disconnectText: { color: colors.status.error, fontWeight: typography.weights.medium },
});
