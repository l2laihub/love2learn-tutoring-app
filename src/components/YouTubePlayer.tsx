/**
 * YouTubePlayer
 * Cross-platform YouTube player component
 * - Uses iframe on web for embedded playback
 * - Uses thumbnail + "Watch on YouTube" button on mobile (cleaner experience, no embedded ads)
 */

import React from 'react';
import { View, StyleSheet, Platform, Image, Pressable, Text, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { borderRadius, colors, spacing, typography } from '../theme';
import { getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from '../utils/youtube';

export interface YouTubePlayerProps {
  videoId: string;
  width: number;
  height: number;
  title?: string;
}

export function YouTubePlayer({ videoId, width, height, title }: YouTubePlayerProps) {
  // Handle opening YouTube
  const handleOpenYouTube = async () => {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    try {
      await Linking.openURL(url);
    } catch (err) {
      console.error('Error opening YouTube URL:', err);
    }
  };

  if (Platform.OS === 'web') {
    // Web: Use embedded iframe player
    const embedUrl = getYouTubeEmbedUrl(videoId, { rel: false });
    return (
      <View style={[styles.container, { width, height }]}>
        <iframe
          src={embedUrl}
          width="100%"
          height="100%"
          style={{ border: 'none', borderRadius: borderRadius.md }}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title={title || 'YouTube Video'}
        />
      </View>
    );
  }

  // Mobile: Show thumbnail with "Watch on YouTube" button (no embedded ads)
  const thumbnailUrl = getYouTubeThumbnailUrl(videoId, 'hq');

  return (
    <View style={[styles.container, { width, height }]}>
      <Image
        source={{ uri: thumbnailUrl }}
        style={styles.thumbnail}
        resizeMode="cover"
      />
      {/* Play button overlay */}
      <Pressable style={styles.playOverlay} onPress={handleOpenYouTube}>
        <View style={styles.playButton}>
          <Ionicons name="logo-youtube" size={48} color="#FF0000" />
        </View>
        <Text style={styles.watchText}>Tap to watch on YouTube</Text>
      </Pressable>
      {/* YouTube badge */}
      <View style={styles.youtubeBadge}>
        <Ionicons name="logo-youtube" size={16} color="#FF0000" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.neutral.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  watchText: {
    marginTop: spacing.md,
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.neutral.white,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  youtubeBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: colors.neutral.white,
    borderRadius: borderRadius.sm,
    padding: spacing.xs,
  },
});

export default YouTubePlayer;
