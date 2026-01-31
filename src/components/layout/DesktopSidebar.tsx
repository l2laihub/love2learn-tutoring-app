/**
 * DesktopSidebar Component
 *
 * A sidebar navigation component for desktop screens.
 * Replaces bottom tabs with a left sidebar on larger screens.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius, shadows } from '../../theme';
import { useAuthContext } from '../../contexts/AuthContext';
import { useUnreadMessageCount } from '../../hooks/useMessages';
import { useTutorBranding } from '../../hooks/useTutorBranding';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface NavItem {
  name: string;
  href: string;
  icon: IoniconsName;
  iconActive: IoniconsName;
  tutorOnly?: boolean;
  parentOnly?: boolean;
  hasBadge?: boolean; // For items that show badge (e.g., Messages)
}

const navItems: NavItem[] = [
  { name: 'Home', href: '/(tabs)', icon: 'home-outline', iconActive: 'home' },
  { name: 'Calendar', href: '/(tabs)/calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { name: 'Messages', href: '/(tabs)/messages', icon: 'chatbubbles-outline', iconActive: 'chatbubbles', hasBadge: true },
  { name: 'Students', href: '/(tabs)/students', icon: 'people-outline', iconActive: 'people', tutorOnly: true },
  { name: 'Worksheets', href: '/(tabs)/worksheets', icon: 'document-text-outline', iconActive: 'document-text' },
  { name: 'Resources', href: '/(tabs)/resources', icon: 'folder-open-outline', iconActive: 'folder-open', parentOnly: true },
  { name: 'Payments', href: '/(tabs)/payments', icon: 'card-outline', iconActive: 'card', tutorOnly: true },
];

const secondaryNavItems: NavItem[] = [
  { name: 'Profile', href: '/profile', icon: 'person-outline', iconActive: 'person' },
  { name: 'My Availability', href: '/availability', icon: 'time-outline', iconActive: 'time', tutorOnly: true },
  { name: 'Lesson Requests', href: '/requests', icon: 'git-pull-request-outline', iconActive: 'git-pull-request', tutorOnly: true },
  { name: 'Admin', href: '/admin', icon: 'settings-outline', iconActive: 'settings', tutorOnly: true },
];

interface DesktopSidebarProps {
  children: React.ReactNode;
}

export function DesktopSidebar({ children }: DesktopSidebarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { isTutor, isParent, parent, user, signOut } = useAuthContext();
  const { count: unreadMessageCount } = useUnreadMessageCount();

  // Get tutor branding for business name
  const { data: tutorBranding } = useTutorBranding();
  const brandName = tutorBranding?.businessName || 'Love2Learn';

  const filteredNavItems = navItems.filter(item => {
    if (item.tutorOnly && !isTutor) return false;
    if (item.parentOnly && !isParent) return false;
    return true;
  });

  const filteredSecondaryItems = secondaryNavItems.filter(item => {
    if (item.tutorOnly && !isTutor) return false;
    if (item.parentOnly && !isParent) return false;
    return true;
  });

  const isActive = (href: string) => {
    if (href === '/(tabs)') {
      return pathname === '/' || pathname === '/(tabs)' || pathname === '/index';
    }
    return pathname.startsWith(href.replace('/(tabs)', ''));
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      {/* Sidebar */}
      <View style={[styles.sidebar, { paddingTop: insets.top + spacing.md }]}>
        {/* Logo/Brand */}
        <View style={styles.brand}>
          <View style={styles.logoContainer}>
            <Ionicons name="school" size={28} color={colors.primary.main} />
          </View>
          <Text style={styles.brandText} numberOfLines={1}>{brandName}</Text>
        </View>

        {/* Primary Navigation */}
        <View style={styles.navSection}>
          {filteredNavItems.map((item) => {
            const active = isActive(item.href);
            const showBadge = item.hasBadge && unreadMessageCount > 0;
            return (
              <Pressable
                key={item.href}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => router.push(item.href as any)}
              >
                <View style={styles.navIconContainer}>
                  <Ionicons
                    name={active ? item.iconActive : item.icon}
                    size={22}
                    color={active ? colors.primary.main : colors.neutral.textSecondary}
                  />
                  {showBadge && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>
                        {unreadMessageCount > 99 ? '99+' : unreadMessageCount}
                      </Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.navItemText, active && styles.navItemTextActive]}>
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Secondary Navigation */}
        <View style={styles.navSection}>
          {filteredSecondaryItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Pressable
                key={item.href}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => router.push(item.href as any)}
              >
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={22}
                  color={active ? colors.primary.main : colors.neutral.textSecondary}
                />
                <Text style={[styles.navItemText, active && styles.navItemTextActive]}>
                  {item.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Spacer */}
        <View style={styles.spacer} />

        {/* User Section */}
        <View style={[styles.userSection, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <Ionicons
                name={isTutor ? 'school' : 'person'}
                size={20}
                color={colors.primary.main}
              />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName} numberOfLines={1}>
                {parent?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'}
              </Text>
              <Text style={styles.userRole}>
                {isTutor ? 'Tutor' : 'Parent'}
              </Text>
            </View>
          </View>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={20} color={colors.neutral.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {children}
      </View>
    </View>
  );
}

const SIDEBAR_WIDTH = 260;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.neutral.background,
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    backgroundColor: colors.neutral.white,
    borderRightWidth: 1,
    borderRightColor: colors.neutral.border,
    paddingHorizontal: spacing.md,
    ...shadows.sm,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.lg,
    marginBottom: spacing.md,
  },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  brandText: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    color: colors.neutral.text,
  },
  navSection: {
    gap: spacing.xs,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  navIconContainer: {
    position: 'relative',
    width: 22,
    height: 22,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
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
    fontWeight: typography.weights.bold,
    color: colors.neutral.textInverse,
    textAlign: 'center',
  },
  navItemActive: {
    backgroundColor: colors.primary.subtle,
  },
  navItemText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.medium,
    color: colors.neutral.textSecondary,
  },
  navItemTextActive: {
    color: colors.primary.main,
    fontWeight: typography.weights.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.neutral.border,
    marginVertical: spacing.lg,
  },
  spacer: {
    flex: 1,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.neutral.border,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary.subtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  userRole: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textSecondary,
  },
  signOutButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral.background,
  },
  mainContent: {
    flex: 1,
  },
});

export default DesktopSidebar;
