/**
 * Messages Stack Layout (inside tabs)
 * Provides stack navigation for message threads while keeping bottom tabs visible
 */

import { View } from 'react-native';
import { Stack } from 'expo-router';
import { colors, spacing } from '../../../src/theme';
import { NotificationBell } from '../../../src/components/NotificationBell';

function HeaderRight() {
  return (
    <View style={{ marginRight: spacing.md }}>
      <NotificationBell color={colors.neutral.textInverse} />
    </View>
  );
}

export default function MessagesLayout() {
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
        headerRight: () => <HeaderRight />,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: 'Messages',
          headerTitle: 'Messages',
        }}
      />
      <Stack.Screen
        name="[id]"
        options={{
          headerBackTitle: 'Messages',
        }}
      />
    </Stack>
  );
}
