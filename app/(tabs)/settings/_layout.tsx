/**
 * Settings Layout
 * Stack navigation for settings screens
 */

import { Stack, Redirect } from 'expo-router';
import { colors } from '../../../src/theme';
import { useAuthContext } from '../../../src/contexts/AuthContext';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

export default function SettingsLayout() {
  const { isTutor, isLoading, isAuthenticated } = useAuthContext();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Redirect non-tutors away from settings (subscription is tutor-only)
  if (!isTutor) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary.main,
        },
        headerTintColor: colors.neutral.textInverse,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerBackTitle: 'Back',
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Settings',
          headerTitle: 'Settings',
        }}
      />
      <Stack.Screen
        name="subscription"
        options={{
          title: 'Subscription',
          headerTitle: 'Manage Subscription',
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.neutral.background,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: colors.neutral.textSecondary,
  },
});
