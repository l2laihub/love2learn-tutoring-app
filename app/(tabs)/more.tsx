import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../src/theme';
import { useAuthContext } from '../../src/contexts/AuthContext';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface MenuItem {
  key: string;
  label: string;
  icon: IoniconsName;
  href: string;
  description?: string;
  tutorOnly?: boolean;
  parentOnly?: boolean;
}

const menuItems: MenuItem[] = [
  {
    key: 'students',
    label: 'Students',
    icon: 'people',
    href: '/students',
    description: 'Manage students and parents',
    tutorOnly: true,
  },
  {
    key: 'worksheets',
    label: 'Worksheets',
    icon: 'document-text',
    href: '/worksheets',
    description: 'AI-generated worksheets and assignments',
  },
  {
    key: 'resources',
    label: 'Resources',
    icon: 'folder-open',
    href: '/resources',
    description: 'Shared learning materials',
    parentOnly: true,
  },
  {
    key: 'payments',
    label: 'Payments',
    icon: 'card',
    href: '/payments',
    description: 'View payment history and invoices',
    parentOnly: true,
  },
  {
    key: 'availability',
    label: 'My Availability',
    icon: 'time',
    href: '/availability',
    description: 'Set your available time slots',
    tutorOnly: true,
  },
  {
    key: 'requests',
    label: 'Lesson Requests',
    icon: 'git-pull-request',
    href: '/requests',
    description: 'Manage lesson requests from parents',
    tutorOnly: true,
  },
  {
    key: 'admin',
    label: 'Admin',
    icon: 'settings',
    href: '/admin',
    description: 'Manage parents, agreements, and settings',
    tutorOnly: true,
  },
  {
    key: 'profile',
    label: 'Profile',
    icon: 'person',
    href: '/profile',
    description: 'View and edit your profile',
  },
];

function MenuItemRow({ item, onPress }: { item: MenuItem; onPress: () => void }) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.menuItem,
        pressed && styles.menuItemPressed,
      ]}
      onPress={onPress}
    >
      <View style={styles.menuIconContainer}>
        <Ionicons name={item.icon} size={24} color={colors.primary.main} />
      </View>
      <View style={styles.menuTextContainer}>
        <Text style={styles.menuLabel}>{item.label}</Text>
        {item.description && (
          <Text style={styles.menuDescription}>{item.description}</Text>
        )}
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={colors.neutral.textMuted}
      />
    </Pressable>
  );
}

export default function MoreScreen() {
  const insets = useSafeAreaInsets();
  const { isTutor, isParent } = useAuthContext();

  const filteredItems = menuItems.filter((item) => {
    if (item.tutorOnly && !isTutor) return false;
    if (item.parentOnly && !isParent) return false;
    return true;
  });

  const handleItemPress = (href: string) => {
    router.push(href as any);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.section}>
          {filteredItems.map((item, index) => (
            <View key={item.key}>
              <MenuItemRow
                item={item}
                onPress={() => handleItemPress(item.href)}
              />
              {index < filteredItems.length - 1 && (
                <View style={styles.divider} />
              )}
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  section: {
    backgroundColor: colors.neutral.white,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: colors.shadow.color,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.neutral.white,
  },
  menuItemPressed: {
    backgroundColor: colors.neutral.background,
  },
  menuIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: colors.primary.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  menuTextContainer: {
    flex: 1,
  },
  menuLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.neutral.text,
    marginBottom: 2,
  },
  menuDescription: {
    fontSize: 13,
    color: colors.neutral.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginLeft: 44 + spacing.md + spacing.md,
  },
});
