import { Stack } from 'expo-router';
import { colors } from '../../src/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: colors.neutral.white,
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="login"
        options={{
          title: 'Login',
        }}
      />
      <Stack.Screen
        name="register"
        options={{
          title: 'Register',
        }}
      />
      <Stack.Screen
        name="register-tutor"
        options={{
          title: 'Register as Tutor',
        }}
      />
      <Stack.Screen
        name="forgot-password"
        options={{
          title: 'Forgot Password',
        }}
      />
      <Stack.Screen
        name="reset-password"
        options={{
          title: 'Reset Password',
        }}
      />
      <Stack.Screen
        name="onboarding"
        options={{
          title: 'Onboarding',
          gestureEnabled: false, // Prevent swiping back during onboarding
        }}
      />
    </Stack>
  );
}
