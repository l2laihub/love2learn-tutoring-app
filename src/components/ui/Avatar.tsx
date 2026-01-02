import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, borderRadius, typography } from '../../theme';

type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: AvatarSize;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
}

const sizeMap = {
  sm: 32,
  md: 44,
  lg: 56,
  xl: 80,
};

const fontSizeMap = {
  sm: typography.sizes.xs,
  md: typography.sizes.base,
  lg: typography.sizes.lg,
  xl: typography.sizes['2xl'],
};

function getInitials(name: string): string {
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getColorFromName(name: string): string {
  // Generate a consistent color based on the name
  const colorPalette = [
    colors.piano.primary,
    colors.math.primary,
    '#9C27B0', // Purple
    '#FF9800', // Orange
    '#00BCD4', // Cyan
    '#795548', // Brown
    '#607D8B', // Blue Grey
    '#E91E63', // Pink
  ];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colorPalette[Math.abs(hash) % colorPalette.length];
}

export function Avatar({
  name,
  imageUrl,
  size = 'md',
  style,
  backgroundColor,
}: AvatarProps) {
  const dimension = sizeMap[size];
  const fontSize = fontSizeMap[size];
  const bgColor = backgroundColor || getColorFromName(name);

  const containerStyle = [
    styles.container,
    {
      width: dimension,
      height: dimension,
      borderRadius: dimension / 2,
      backgroundColor: bgColor,
    },
    style,
  ];

  if (imageUrl) {
    return (
      <View style={containerStyle}>
        <Image
          source={{ uri: imageUrl }}
          style={[styles.image, { width: dimension, height: dimension, borderRadius: dimension / 2 }]}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text style={[styles.initials, { fontSize }]}>{getInitials(name)}</Text>
    </View>
  );
}

// Group of avatars with overlap
interface AvatarGroupProps {
  names: string[];
  size?: AvatarSize;
  max?: number;
}

export function AvatarGroup({ names, size = 'sm', max = 4 }: AvatarGroupProps) {
  const dimension = sizeMap[size];
  const displayNames = names.slice(0, max);
  const remaining = names.length - max;

  return (
    <View style={styles.group}>
      {displayNames.map((name, index) => (
        <View
          key={index}
          style={[
            styles.groupItem,
            {
              marginLeft: index === 0 ? 0 : -(dimension * 0.3),
              zIndex: displayNames.length - index,
            },
          ]}
        >
          <Avatar name={name} size={size} style={styles.groupAvatar} />
        </View>
      ))}
      {remaining > 0 && (
        <View
          style={[
            styles.groupItem,
            styles.remainingContainer,
            {
              width: dimension,
              height: dimension,
              borderRadius: dimension / 2,
              marginLeft: -(dimension * 0.3),
            },
          ]}
        >
          <Text style={[styles.remainingText, { fontSize: fontSizeMap[size] - 2 }]}>
            +{remaining}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  initials: {
    color: colors.neutral.textInverse,
    fontWeight: typography.weights.semibold,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  groupItem: {
    borderWidth: 2,
    borderColor: colors.neutral.surface,
    borderRadius: 100,
  },
  groupAvatar: {
    borderWidth: 0,
  },
  remainingContainer: {
    backgroundColor: colors.neutral.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingText: {
    color: colors.neutral.textSecondary,
    fontWeight: typography.weights.medium,
  },
});

export default Avatar;
