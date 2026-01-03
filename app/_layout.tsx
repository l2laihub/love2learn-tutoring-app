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
  const { isAuthenticated, isLoading } = useAuthContext();
  const segments = useSegments();
  const navigationState = useRootNavigationState();

  useEffect(() => {
    // Wait for navigation to be ready
    if (!navigationState?.key) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (isLoading) {
      // Still loading auth state, don't navigate yet
      return;
    }

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to login if not authenticated and not already on auth screens
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to main app if authenticated and on auth screens
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isLoading, segments, navigationState?.key]);

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
