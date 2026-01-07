import { useEffect } from 'react';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuthContext } from '../src/contexts/AuthContext';
import { supabase } from '../src/lib/supabase';
import { colors } from '../src/theme';

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color={colors.primary.main} />
    </View>
  );
}

function RootLayoutNav() {
  const { isAuthenticated, isLoading, isParent, parent } = useAuthContext();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  // Handle PASSWORD_RECOVERY event from Supabase auth
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        console.log('[RootLayout] PASSWORD_RECOVERY event detected, redirecting to reset-password');
        // Redirect to reset password page when recovery link is clicked
        router.replace('/(auth)/reset-password');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    // Wait for navigation to be ready
    if (!navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[1] === 'onboarding';
    const inResetPassword = segments[1] === 'reset-password';

    if (isLoading) {
      // Still loading auth state, don't navigate yet
      return;
    }

    // Don't redirect if user is on reset-password page (they have a valid recovery session)
    if (inResetPassword) {
      return;
    }

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated and not already on auth screens
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup && !inOnboarding) {
      // Check if parent needs onboarding
      if (isParent && parent && !parent.onboarding_completed_at) {
        // Redirect to onboarding flow
        router.replace('/(auth)/onboarding/welcome');
      } else {
        // Redirect to main app if authenticated and on auth screens (not onboarding)
        router.replace('/(tabs)');
      }
    } else if (isAuthenticated && !inAuthGroup) {
      // User is authenticated and in main app - check if parent needs onboarding
      if (isParent && parent && !parent.onboarding_completed_at) {
        router.replace('/(auth)/onboarding/welcome');
      }
    }
  }, [isAuthenticated, isLoading, isParent, parent, segments, navigationState?.key]);

  // Show loading screen while checking auth
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="student/[id]"
        options={{
          headerShown: true,
          headerTitle: 'Student Details',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="parent/[id]"
        options={{
          headerShown: true,
          headerTitle: 'Parent Details',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="agreement"
        options={{
          headerShown: true,
          headerTitle: 'Service Agreement',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="profile"
        options={{
          headerShown: true,
          headerTitle: 'My Profile',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="availability"
        options={{
          headerShown: true,
          headerTitle: 'My Availability',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="requests"
        options={{
          headerShown: true,
          headerTitle: 'Lesson Requests',
          headerBackTitle: 'Back',
        }}
      />
      <Stack.Screen
        name="notifications"
        options={{
          headerShown: true,
          headerTitle: 'Notifications',
          headerBackTitle: 'Back',
          headerStyle: { backgroundColor: colors.primary.main },
          headerTintColor: colors.neutral.textInverse,
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
      <Stack.Screen
        name="admin"
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <RootLayoutNav />
      </SafeAreaProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
  },
});
