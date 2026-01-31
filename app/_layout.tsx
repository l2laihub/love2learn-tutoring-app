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
  const { isAuthenticated, isLoading, isParent, isTutor, parent } = useAuthContext();
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
    const inTutorOnboarding = segments[2] === 'tutor';
    const inResetPassword = segments[1] === 'reset-password';

    if (isLoading) {
      // Still loading auth state, don't navigate yet
      return;
    }

    // Don't redirect if user is on reset-password page (they have a valid recovery session)
    if (inResetPassword) {
      return;
    }

    const inLanding = segments[0] === 'landing';

    // Helper to check if user needs onboarding
    const needsOnboarding = parent && !parent.onboarding_completed_at;
    const tutorNeedsOnboarding = isTutor && needsOnboarding;
    const parentNeedsOnboarding = isParent && needsOnboarding;

    if (!isAuthenticated && !inAuthGroup && !inLanding) {
      // Redirect to landing page if not authenticated and not already on auth/landing screens
      router.replace('/landing');
    } else if (isAuthenticated && inAuthGroup && !inOnboarding) {
      // Check if user needs onboarding
      if (tutorNeedsOnboarding) {
        // Redirect to tutor onboarding flow
        router.replace('/(auth)/onboarding/tutor/business');
      } else if (parentNeedsOnboarding) {
        // Redirect to parent onboarding flow
        router.replace('/(auth)/onboarding/welcome');
      } else {
        // Redirect to main app if authenticated and on auth screens (not onboarding)
        router.replace('/(tabs)');
      }
    } else if (isAuthenticated && inLanding) {
      // Authenticated user on landing page - redirect to app
      if (tutorNeedsOnboarding) {
        router.replace('/(auth)/onboarding/tutor/business');
      } else if (parentNeedsOnboarding) {
        router.replace('/(auth)/onboarding/welcome');
      } else {
        router.replace('/(tabs)');
      }
    } else if (isAuthenticated && !inAuthGroup && !inLanding) {
      // User is authenticated and in main app - check if they need onboarding
      if (tutorNeedsOnboarding) {
        router.replace('/(auth)/onboarding/tutor/business');
      } else if (parentNeedsOnboarding) {
        router.replace('/(auth)/onboarding/welcome');
      }
    } else if (isAuthenticated && inOnboarding) {
      // User is in onboarding - make sure they're in the right flow
      if (isTutor && !inTutorOnboarding && needsOnboarding) {
        // Tutor in parent onboarding - redirect to tutor onboarding
        router.replace('/(auth)/onboarding/tutor/business');
      } else if (isParent && inTutorOnboarding) {
        // Parent in tutor onboarding - redirect to parent onboarding
        router.replace('/(auth)/onboarding/welcome');
      }
    }
  }, [isAuthenticated, isLoading, isParent, isTutor, parent, segments, navigationState?.key]);

  // Show loading screen while checking auth
  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="landing" options={{ headerShown: false }} />
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
