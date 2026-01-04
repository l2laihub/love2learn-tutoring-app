/**
 * Admin Layout
 * Navigation layout for admin panel with tab-based navigation
 */

import { Tabs, Redirect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  name: IoniconsName;
  color: string;
  size: number;
}

function TabIcon({ name, color, size }: TabIconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function AdminLayout() {
  const insets = useSafeAreaInsets();
  const { isTutor, isLoading } = useAuthContext();

  // Show loading while checking auth
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.main} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  // Redirect non-tutors away from admin
  if (!isTutor) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.accent.main,
        tabBarInactiveTintColor: colors.neutral.textMuted,
        tabBarStyle: {
          backgroundColor: colors.neutral.white,
          borderTopWidth: 1,
          borderTopColor: colors.neutral.border,
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
          height: 60 + Math.max(insets.bottom, 10),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: '#1B3A4B', // Dark navy for admin
        },
        headerTintColor: colors.neutral.textInverse,
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          headerTitle: 'Admin Dashboard',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="stats-chart" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="agreements"
        options={{
          title: 'Agreements',
          headerTitle: 'Parent Agreements',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="document-text" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="parents"
        options={{
          title: 'Parents',
          headerTitle: 'Parent Management',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="templates"
        options={{
          title: 'Templates',
          headerTitle: 'Agreement Templates',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="create" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
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
