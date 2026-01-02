import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

// Simplified layout - no splash screen management for now
function RootLayoutNav() {
  // Always show authenticated routes for development
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
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <RootLayoutNav />
    </SafeAreaProvider>
  );
}
