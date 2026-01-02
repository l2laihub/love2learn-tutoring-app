import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Color scheme constants
const COLORS = {
  primaryCoral: '#FF6B6B', // Piano theme
  primaryGreen: '#4CAF50', // Math theme
  inactive: '#8E8E93',
  background: '#FFFFFF',
};

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  name: IoniconsName;
  color: string;
  size: number;
}

function TabIcon({ name, color, size }: TabIconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.primaryCoral,
        tabBarInactiveTintColor: COLORS.inactive,
        tabBarStyle: {
          backgroundColor: COLORS.background,
          borderTopWidth: 1,
          borderTopColor: '#E5E5E5',
          paddingBottom: Math.max(insets.bottom, 10),
          paddingTop: 8,
          height: 60 + Math.max(insets.bottom, 10),
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: COLORS.primaryCoral,
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Love2Learn',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          headerTitle: 'Lesson Calendar',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="students"
        options={{
          title: 'Students',
          headerTitle: 'Students & Parents',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="worksheets"
        options={{
          title: 'Worksheets',
          headerTitle: 'AI Worksheets',
          tabBarActiveTintColor: COLORS.primaryGreen,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="document-text" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="payments"
        options={{
          title: 'Payments',
          headerTitle: 'Payment Tracking',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="card" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
