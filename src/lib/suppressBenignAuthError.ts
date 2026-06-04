/**
 * Suppresses a single benign, self-healing auth log from @supabase/auth-js.
 *
 * On startup, auth-js's `_recoverAndRefresh()` tries to refresh a persisted
 * session whose refresh token is no longer valid server-side (e.g. after a
 * `supabase db reset`, a project change, or a JWT-secret rotation). The library
 * handles this correctly — it sees the error is non-retryable, calls
 * `_removeSession()`, clears the stale session, and emits `SIGNED_OUT` — but it
 * also logs the rejection via a hardcoded `console.error(error)`
 * (GoTrueClient.js, `_recoverAndRefresh`). In dev, that turns into a red LogBox
 * overlay that blocks the UI even though auth is working as intended.
 *
 * This filters ONLY that exact message so it stops adding noise. Every other
 * error — including any genuine refresh failure with a different message —
 * passes through untouched. Guarded by `__DEV__`, so production behavior is
 * never patched.
 *
 * Imported for its side effect at the top of the root layout so the console
 * wrapper is installed before the async refresh rejection fires.
 */
import { LogBox } from 'react-native';

const BENIGN_REFRESH_TOKEN_MESSAGE = 'Invalid Refresh Token: Refresh Token Not Found';

function isBenignRefreshTokenError(arg: unknown): boolean {
  if (typeof arg === 'string') {
    return arg.includes(BENIGN_REFRESH_TOKEN_MESSAGE);
  }
  if (arg instanceof Error) {
    return arg.message.includes(BENIGN_REFRESH_TOKEN_MESSAGE);
  }
  return false;
}

if (__DEV__) {
  // Suppress the red LogBox overlay for this specific message (native dev only).
  LogBox.ignoreLogs([BENIGN_REFRESH_TOKEN_MESSAGE]);

  // Also drop the matching terminal console.error so it doesn't add noise.
  const originalConsoleError = console.error.bind(console);
  // eslint-disable-next-line no-console
  console.error = (...args: unknown[]) => {
    if (args.some(isBenignRefreshTokenError)) {
      return;
    }
    originalConsoleError(...args);
  };
}
