import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../src/theme';
import { useAuthContext } from '../../src/contexts/AuthContext';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useUnreadMessageCount } from '../../src/hooks/useMessages';
import { DesktopSidebar } from '../../src/components/layout/DesktopSidebar';
import { NotificationBell } from '../../src/components/NotificationBell';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface TabIconProps {
  name: IoniconsName;
  color: string;
  size: number;
}

function TabIcon({ name, color, size }: TabIconProps) {
  return <Ionicons name={name} size={size} color={color} />;
}

// Messages tab icon with unread badge
function MessagesTabIcon({ color, size }: { color: string; size: number }) {
  const { count } = useUnreadMessageCount();

  return (
    <View style={tabStyles.iconContainer}>
      <Ionicons name="chatbubbles" size={size} color={color} />
      {count > 0 && (
        <View style={tabStyles.badge}>
          <Text style={tabStyles.badgeText}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </View>
  );
}

// Header right component with notification bell
function HeaderRight() {
  return (
    <View style={{ marginRight: spacing.md }}>
      <NotificationBell color={colors.neutral.textInverse} />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const { isTutor, isParent } = useAuthContext();
  const { isDesktop } = useResponsive();

  // On desktop, use sidebar layout instead of bottom tabs
  if (isDesktop) {
    return (
      <DesktopSidebar>
        <Tabs
          screenOptions={{
            tabBarStyle: { display: 'none' }, // Hide bottom tabs on desktop
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
          <Tabs.Screen
            name="index"
            options={{
              title: 'Home',
              headerTitle: isParent ? 'Parent Dashboard' : 'Love2Learn Tutoring',
            }}
          />
          <Tabs.Screen
            name="calendar"
            options={{
              title: isParent ? 'Schedule' : 'Calendar',
              headerTitle: isParent ? 'Lesson Schedule' : 'Lesson Calendar',
            }}
          />
          <Tabs.Screen
            name="messages"
            options={{
              title: 'Messages',
              headerShown: false, // Stack inside handles its own header
            }}
          />
          <Tabs.Screen
            name="students"
            options={{
              title: 'Students',
              headerTitle: 'Students & Parents',
              href: isParent ? null : undefined,
            }}
          />
          <Tabs.Screen
            name="worksheets"
            options={{
              title: 'Worksheets',
              headerTitle: isParent ? 'My Worksheets' : 'AI Worksheets',
            }}
          />
          <Tabs.Screen
            name="payments"
            options={{
              title: 'Payments',
              headerTitle: 'Payment Tracking',
              href: isParent ? null : undefined,
            }}
          />
          <Tabs.Screen
            name="resources"
            options={{
              title: 'Resources',
              headerTitle: 'Shared Resources',
              // Show Resources tab for parents only (tutors see Library in Worksheets)
              href: isParent ? undefined : null,
            }}
          />
          <Tabs.Screen
            name="profile"
            options={{
              title: 'Profile',
              headerTitle: 'My Profile',
              // Only show Profile tab for parents
              href: isParent ? undefined : null,
            }}
          />
          <Tabs.Screen
            name="more"
            options={{
              title: 'More',
              headerTitle: 'More',
              // Hide on desktop - sidebar has all items
              href: null,
            }}
          />
          <Tabs.Screen
            name="library"
            options={{
              title: 'Library',
              headerTitle: 'Resource Library',
              // Library is now integrated into Worksheets tab - hide for all users
              href: null,
            }}
          />
        </Tabs>
      </DesktopSidebar>
    );
  }

  // Mobile/tablet: use bottom tabs
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary.main,
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
          backgroundColor: colors.primary.main,
        },
        headerTintColor: colors.neutral.textInverse,
        headerTitleStyle: {
          fontWeight: '600',
        },
        headerRight: () => <HeaderRight />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: isParent ? 'Parent Dashboard' : 'Love2Learn Tutoring',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="home" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: isParent ? 'Schedule' : 'Calendar',
          headerTitle: isParent ? 'Lesson Schedule' : 'Lesson Calendar',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="calendar" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="messages"
        options={{
          title: 'Messages',
          headerShown: false, // Stack inside handles its own header
          tabBarIcon: ({ color, size }) => (
            <MessagesTabIcon color={color} size={size} />
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
          // Hide Payments tab for parents
          href: isParent ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: 'More',
          headerTitle: 'More',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="ellipsis-horizontal" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="worksheets"
        options={{
          title: 'Worksheets',
          headerTitle: isParent ? 'My Worksheets' : 'AI Worksheets',
          tabBarActiveTintColor: colors.secondary.main,
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="document-text" color={color} size={size} />
          ),
          // Hide from bottom nav - accessible via More menu
          href: null,
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
          // Hide from bottom nav - accessible via More menu
          href: null,
        }}
      />
      <Tabs.Screen
        name="resources"
        options={{
          title: 'Resources',
          headerTitle: 'Shared Resources',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="folder-open" color={color} size={size} />
          ),
          // Hide from bottom nav - accessible via More menu
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerTitle: 'My Profile',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person" color={color} size={size} />
          ),
          // Hide from bottom nav - accessible via More menu
          href: null,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Library',
          headerTitle: 'Resource Library',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="library" color={color} size={size} />
          ),
          // Library is now integrated into Worksheets tab - hide for all users
          href: null,
        }}
      />
    </Tabs>
  );
}

// Styles for tab badge
const tabStyles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.accent.main,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.neutral.white,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.neutral.textInverse,
    textAlign: 'center',
  },
});
