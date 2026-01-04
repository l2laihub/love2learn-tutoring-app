import { useEffect } from 'react';
import { Stack, router, useSegments, useRootNavigationState } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuthContext } from '../src/contexts/AuthContext';

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#FF6B6B" />
    </View>
  );
}

function RootLayoutNav() {
  const { isAuthenticated, isLoading, isParent, parent } = useAuthContext();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for navigation to be ready
    if (!navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[1] === 'onboarding';

    if (isLoading) {
      // Still loading auth state, don't navigate yet
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
    backgroundColor: '#FFFFFF',
  },
});
