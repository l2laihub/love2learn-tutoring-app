/**
 * Tutor Onboarding Layout
 * Love2Learn Tutoring App
 *
 * Handles the tutor onboarding flow navigation
 */

import { Stack } from 'expo-router';
import { colors } from '../../../../src/theme';

export default function TutorOnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.neutral.white,
        },
        animation: 'slide_from_right',
        gestureEnabled: false, // Prevent swiping back during onboarding
      }}
    >
      <Stack.Screen name="business" />
      <Stack.Screen name="subjects" />
      <Stack.Screen name="subscription" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
