import { useEffect, useRef } from 'react';
import { Alert, AppState, AppStateStatus, Platform } from 'react-native';
import * as Updates from 'expo-updates';

/**
 * Checks for an EAS Update (OTA) on launch and, when one is available, downloads
 * it in the background and prompts the user to restart to apply it.
 *
 * The check is a no-op when OTA cannot apply:
 * - Web (react-native-web has no embedded bundle to swap)
 * - Development / Expo Go (`Updates.isEmbeddedLaunch` is false; the dev server
 *   serves the bundle, so there is nothing to update)
 *
 * Failures (offline, server unreachable) are swallowed: a missed update check is
 * not worth interrupting the user, and the next launch will retry.
 */
export function useOTAUpdate() {
  // Guard against overlapping checks (e.g. launch + foreground firing together)
  // and against re-prompting once the user has already been asked this session.
  const checking = useRef(false);
  const prompted = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web' || __DEV__ || !Updates.isEnabled) {
      return;
    }

    async function checkForUpdate() {
      if (checking.current || prompted.current) return;
      checking.current = true;

      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;

        await Updates.fetchUpdateAsync();

        if (prompted.current) return;
        prompted.current = true;

        Alert.alert(
          'Update Available',
          'A new version of DaLesson is ready. Restart now to get the latest improvements.',
          [
            { text: 'Later', style: 'cancel' },
            {
              text: 'Restart',
              style: 'default',
              onPress: () => {
                Updates.reloadAsync().catch((error) => {
                  console.warn('[useOTAUpdate] reload failed', error);
                });
              },
            },
          ],
        );
      } catch (error) {
        // Network/availability errors are expected and non-fatal.
        console.log('[useOTAUpdate] update check skipped', error);
      } finally {
        checking.current = false;
      }
    }

    // Check on launch...
    checkForUpdate();

    // ...and again when the app returns to the foreground, in case an update was
    // published while the app was backgrounded.
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') {
        checkForUpdate();
      }
    });

    return () => subscription.remove();
  }, []);
}
