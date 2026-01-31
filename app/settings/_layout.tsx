/**
 * Settings Layout
 * Stack navigation for tutor business settings
 */

import { Stack, Redirect } from 'expo-router';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { colors, spacing } from '../../src/theme';
import { useAuthContext } from '../../src/contexts/AuthContext';

export default function SettingsLayout() {
  const { isTutor, isLoading, isAuthenticated, parentQueryError } = useAuthContext();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // If there's a query error and we're authenticated, show loading
  if (isAuthenticated && !isTutor && (parentQueryError === 'timeout' || parentQueryError === 'query_error')) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Verifying access...</Text>
      </View>
    );
  }

  // Redirect non-tutors away from settings
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
        name="business"
        options={{
          title: 'Business Profile',
          headerTitle: 'Business Profile',
        }}
      />
      <Stack.Screen
        name="subjects"
        options={{
          title: 'Subjects & Rates',
          headerTitle: 'Subjects & Rates',
        }}
      />
      <Stack.Screen
        name="subscription"
        options={{
          title: 'Subscription',
          headerTitle: 'Subscription',
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
    marginTop: spacing.md,
    fontSize: 16,
    color: colors.neutral.textSecondary,
  },
});
