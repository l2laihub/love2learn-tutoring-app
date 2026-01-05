/**
 * YouTubeEmbed
 * Component for displaying YouTube video thumbnails and opening videos
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Pressable,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography, borderRadius, shadows } from '../theme';
import { getYouTubeVideoInfo, getYouTubeOpenUrl, YouTubeVideoInfo } from '../utils/youtube';

export interface YouTubeEmbedProps {
  url: string;
  title?: string;
  description?: string;
  showTitle?: boolean;
  compact?: boolean;
  onPress?: () => void;
}

export function YouTubeEmbed({
  url,
  title,
  description,
  showTitle = true,
  compact = false,
  onPress,
}: YouTubeEmbedProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const videoInfo = getYouTubeVideoInfo(url);

  // Reset state when URL changes
  React.useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [url]);

  const handlePress = async () => {
    if (onPress) {
      onPress();
      return;
    }

    if (videoInfo) {
      const openUrl = getYouTubeOpenUrl(videoInfo.videoId);
      const canOpen = await Linking.canOpenURL(openUrl);
      if (canOpen) {
        await Linking.openURL(openUrl);
      }
    }
  };

  if (!videoInfo) {
    return (
      <View style={[styles.container, compact && styles.containerCompact, styles.errorContainer]}>
        <Ionicons name="alert-circle" size={24} color={colors.status.error} />
        <Text style={styles.errorText}>Invalid YouTube URL</Text>
      </View>
    );
  }

  if (compact) {
    return (
      <Pressable style={styles.compactContainer} onPress={handlePress}>
        <View style={styles.compactThumbnailContainer}>
          {!imageError ? (
            <>
              <Image
                source={{ uri: videoInfo.thumbnailUrl }}
                style={styles.compactThumbnail}
                resizeMode="cover"
                onLoad={() => setImageLoaded(true)}
                onError={() => {
                  setImageLoaded(true);
                  setImageError(true);
                }}
              />
              {!imageLoaded && (
                <View style={styles.thumbnailLoading}>
                  <ActivityIndicator size="small" color={colors.neutral.white} />
                </View>
              )}
            </>
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Ionicons name="logo-youtube" size={24} color="#FF0000" />
            </View>
          )}
          <View style={styles.playButtonSmall}>
            <Ionicons name="play" size={16} color={colors.neutral.white} />
          </View>
        </View>
        {showTitle && (
          <View style={styles.compactInfo}>
            <Text style={styles.compactTitle} numberOfLines={2}>
              {title || 'YouTube Video'}
            </Text>
            <Text style={styles.compactLabel}>Tap to watch</Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable style={styles.container} onPress={handlePress}>
      <View style={styles.thumbnailContainer}>
        {!imageError ? (
          <>
            <Image
              source={{ uri: videoInfo.thumbnailUrlHQ }}
              style={styles.thumbnail}
              resizeMode="cover"
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageLoaded(true);
                setImageError(true);
              }}
            />
            {!imageLoaded && (
              <View style={styles.thumbnailLoading}>
                <ActivityIndicator size="large" color={colors.neutral.white} />
              </View>
            )}
          </>
        ) : (
          <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
            <Ionicons name="logo-youtube" size={48} color="#FF0000" />
          </View>
        )}

        {/* Play Button Overlay */}
        <View style={styles.playButtonContainer}>
          <View style={styles.playButton}>
            <Ionicons name="play" size={32} color={colors.neutral.white} />
          </View>
        </View>

        {/* YouTube Logo */}
        <View style={styles.youtubeLogoBadge}>
          <Ionicons name="logo-youtube" size={20} color="#FF0000" />
        </View>
      </View>

      {showTitle && (title || description) && (
        <View style={styles.infoContainer}>
          {title && (
            <Text style={styles.title} numberOfLines={2}>
              {title}
            </Text>
          )}
          {description && (
            <Text style={styles.description} numberOfLines={2}>
              {description}
            </Text>
          )}
          <View style={styles.actionRow}>
            <Ionicons name="open-outline" size={14} color={colors.neutral.textMuted} />
            <Text style={styles.actionText}>Tap to watch on YouTube</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

/**
 * Mini YouTube thumbnail for list views
 */
export interface YouTubeThumbnailProps {
  url: string;
  size?: number;
  onPress?: () => void;
}

export function YouTubeThumbnail({ url, size = 60, onPress }: YouTubeThumbnailProps) {
  const [imageError, setImageError] = useState(false);
  const videoInfo = getYouTubeVideoInfo(url);

  const handlePress = async () => {
    if (onPress) {
      onPress();
      return;
    }

    if (videoInfo) {
      const openUrl = getYouTubeOpenUrl(videoInfo.videoId);
      await Linking.openURL(openUrl);
    }
  };

  if (!videoInfo) {
    return (
      <View style={[styles.miniThumbnail, { width: size, height: size }]}>
        <Ionicons name="videocam-off" size={size / 3} color={colors.neutral.textMuted} />
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.miniThumbnail, { width: size, height: size }]}
      onPress={handlePress}
    >
      {!imageError ? (
        <Image
          source={{ uri: videoInfo.thumbnailUrl }}
          style={styles.miniThumbnailImage}
          resizeMode="cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <Ionicons name="logo-youtube" size={size / 3} color="#FF0000" />
      )}
      <View style={styles.miniPlayIcon}>
        <Ionicons name="play" size={size / 4} color={colors.neutral.white} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    ...shadows.sm,
  },
  containerCompact: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorContainer: {
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  errorText: {
    fontSize: typography.sizes.sm,
    color: colors.status.error,
  },
  thumbnailContainer: {
    position: 'relative',
    aspectRatio: 16 / 9,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    backgroundColor: colors.neutral.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbnailLoading: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButtonContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4, // Optical centering for play icon
  },
  playButtonSmall: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
  youtubeLogoBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.sm,
    padding: 4,
  },
  infoContainer: {
    padding: spacing.md,
  },
  title: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
    marginBottom: spacing.xs,
  },
  description: {
    fontSize: typography.sizes.sm,
    color: colors.neutral.textSecondary,
    marginBottom: spacing.sm,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  actionText: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
  },
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    ...shadows.sm,
  },
  compactThumbnailContainer: {
    position: 'relative',
    width: 80,
    height: 45,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginRight: spacing.sm,
  },
  compactThumbnail: {
    width: '100%',
    height: '100%',
  },
  compactInfo: {
    flex: 1,
  },
  compactTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.neutral.text,
  },
  compactLabel: {
    fontSize: typography.sizes.xs,
    color: colors.neutral.textMuted,
    marginTop: 2,
  },
  // Mini thumbnail styles
  miniThumbnail: {
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    backgroundColor: colors.neutral.surfaceHover,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniThumbnailImage: {
    width: '100%',
    height: '100%',
  },
  miniPlayIcon: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});

export default YouTubeEmbed;
