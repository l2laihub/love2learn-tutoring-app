/**
 * Device push notification helpers.
 *
 * Registration stores the device's Expo token in `push_tokens` via a
 * SECURITY DEFINER RPC. Unregister removes it (call before sign-out).
 * All functions no-op on web / non-device and swallow errors so push
 * setup never breaks app flow.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Show banners/sound while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function getProjectId(): string | undefined {
  // easConfig is populated in built apps but isn't always in the typings;
  // cast to read it without depending on the SDK's type surface.
  return (
    Constants?.expoConfig?.extra?.eas?.projectId ??
    (Constants as { easConfig?: { projectId?: string } })?.easConfig?.projectId
  );
}

export async function getPushPermissionStatus(): Promise<
  'granted' | 'denied' | 'undetermined'
> {
  if (Platform.OS === 'web' || !Device.isDevice) return 'denied';
  const { status } = await Notifications.getPermissionsAsync();
  return status as 'granted' | 'denied' | 'undetermined';
}

export async function requestPushPermission(): Promise<boolean> {
  if (Platform.OS === 'web' || !Device.isDevice) return false;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Register (or refresh) this device's Expo token for the signed-in user.
 * Returns the token on success, or null if unsupported / not granted / error.
 * Does NOT prompt — only registers when permission is already granted.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return null;

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: getProjectId(),
    });

    await supabase.rpc('upsert_push_token', {
      p_token: token,
      p_platform: Platform.OS,
    });

    return token;
  } catch (e) {
    console.warn('[push] register failed', e);
    return null;
  }
}

/**
 * Remove this device's token. Call BEFORE sign-out, while still
 * authenticated, so the RLS delete policy still applies.
 */
export async function unregisterPushToken(): Promise<void> {
  try {
    if (Platform.OS === 'web' || !Device.isDevice) return;

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: getProjectId(),
    });
    if (token) {
      await supabase.from('push_tokens').delete().eq('token', token);
    }
  } catch (e) {
    console.warn('[push] unregister failed', e);
  }
}
