/**
 * Registers/refreshes the device push token while authenticated, and routes
 * to a notification's deep link when the user taps it.
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { registerForPushNotificationsAsync } from '../lib/push';

// Only follow relative in-app paths from a notification's action_url. Push
// `data` is not fully trusted (Expo tokens aren't secret), so a crafted push
// must not be able to deep-link us to an absolute URL or custom scheme.
function isInAppPath(url: string): boolean {
  return url.startsWith('/') && !url.startsWith('//');
}

// Version-proof subscription type: infer it from the listener's return value
// (expo-notifications has renamed this type across SDKs).
type NotificationSubscription = ReturnType<
  typeof Notifications.addNotificationResponseReceivedListener
>;

export function usePushNotifications(isAuthenticated: boolean): void {
  const responseListener = useRef<NotificationSubscription | null>(null);

  // Silently register/refresh the token whenever the user is authenticated.
  useEffect(() => {
    if (!isAuthenticated) return;
    registerForPushNotificationsAsync();
  }, [isAuthenticated]);

  // Deep-link on notification tap.
  useEffect(() => {
    responseListener.current =
      Notifications.addNotificationResponseReceivedListener((response) => {
        const url = response.notification.request.content.data?.action_url as
          | string
          | undefined;
        if (url && isInAppPath(url)) {
          router.push(url as never);
        }
      });

    return () => {
      responseListener.current?.remove();
    };
  }, []);
}
