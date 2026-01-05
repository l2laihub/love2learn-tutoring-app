/**
 * AdminSidebar Component
 *
 * A sidebar navigation component for the admin panel on desktop screens.
 * Features a dark theme to distinguish from the main app.
 */

import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../../theme';
import { useAuthContext } from '../../contexts/AuthContext';

type IoniconsName = keyof typeof Ionicons.glyphMap;

interface NavItem {
  name: string;
  href: string;
  icon: IoniconsName;
  iconActive: IoniconsName;
}

const navItems: NavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { name: 'Agreements', href: '/admin/agreements', icon: 'document-text-outline', iconActive: 'document-text' },
  { name: 'Parents', href: '/admin/parents', icon: 'people-outline', iconActive: 'people' },
  { name: 'Templates', href: '/admin/templates', icon: 'create-outline', iconActive: 'create' },
];

interface AdminSidebarProps {
  children: React.ReactNode;
}

export function AdminSidebar({ children }: AdminSidebarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const { parent, user, signOut } = useAuthContext();

  const isActive = (href: string) => {
    if (href === '/admin') {
      return pathname === '/admin' || pathname === '/admin/index';
    }
    return pathname.startsWith(href);
  };

  const handleBackToApp = () => {
    router.push('/(tabs)');
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
            <Ionicons name="shield-checkmark" size={24} color={colors.accent.main} />
          </View>
          <View>
            <Text style={styles.brandText}>Admin Panel</Text>
            <Text style={styles.brandSubtext}>Love2Learn</Text>
          </View>
        </View>

        {/* Back to App Button */}
        <Pressable style={styles.backButton} onPress={handleBackToApp}>
          <Ionicons name="arrow-back" size={18} color={colors.primary.light} />
          <Text style={styles.backButtonText}>Back to App</Text>
        </Pressable>

        {/* Navigation */}
        <View style={styles.navSection}>
          <Text style={styles.navLabel}>MANAGEMENT</Text>
          {navItems.map((item) => {
            const active = isActive(item.href);
            return (
              <Pressable
                key={item.href}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => router.push(item.href as any)}
              >
                <Ionicons
                  name={active ? item.iconActive : item.icon}
                  size={20}
                  color={active ? colors.accent.main : '#8A9BA8'}
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
              <Ionicons name="shield" size={18} color={colors.accent.main} />
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName} numberOfLines={1}>
                {parent?.name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Admin'}
              </Text>
              <Text style={styles.userRole}>Administrator</Text>
            </View>
          </View>
          <Pressable style={styles.signOutButton} onPress={handleSignOut}>
            <Ionicons name="log-out-outline" size={18} color="#8A9BA8" />
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
    backgroundColor: '#1B3A4B', // Dark navy
    paddingHorizontal: spacing.md,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  logoContainer: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  brandText: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.neutral.white,
  },
  brandSubtext: {
    fontSize: typography.sizes.xs,
    color: '#8A9BA8',
    marginTop: 2,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(61, 156, 168, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(61, 156, 168, 0.3)',
  },
  backButtonText: {
    fontSize: typography.sizes.sm,
    color: colors.primary.light,
    fontWeight: typography.weights.medium,
  },
  navSection: {
    gap: spacing.xs,
  },
  navLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: '#5A6B78',
    letterSpacing: 1,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.md,
  },
  navItemActive: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  navItemText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: '#8A9BA8',
  },
  navItemTextActive: {
    color: colors.accent.main,
    fontWeight: typography.weights.semibold,
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
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 107, 107, 0.15)',
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
    color: colors.neutral.white,
  },
  userRole: {
    fontSize: typography.sizes.xs,
    color: '#8A9BA8',
  },
  signOutButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  mainContent: {
    flex: 1,
  },
});

export default AdminSidebar;
