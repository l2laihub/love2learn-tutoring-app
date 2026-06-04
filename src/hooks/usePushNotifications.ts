/**
 * Registers/refreshes the device push token while authenticated, and routes
 * to a notification's deep link when the user taps it.
 */

import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { registerForPushNotificationsAsync } from '../lib/push';

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
        if (url) {
          router.push(url as never);
        }
      });

    return () => {
      responseListener.current?.remove();
    };
  }, []);
}
