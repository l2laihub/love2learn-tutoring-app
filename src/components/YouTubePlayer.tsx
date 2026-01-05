/**
 * YouTubePlayer
 * Cross-platform YouTube player component
 * - Uses iframe on web
 * - Uses react-native-youtube-iframe on native (iOS/Android)
 */

import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { borderRadius } from '../theme';
import { getYouTubeEmbedUrl } from '../utils/youtube';

export interface YouTubePlayerProps {
  videoId: string;
  width: number;
  height: number;
  title?: string;
}

// Conditionally import YoutubePlayer only on native platforms
let NativeYoutubePlayer: React.ComponentType<any> | null = null;
if (Platform.OS !== 'web') {
  // Dynamic import for native only
  NativeYoutubePlayer = require('react-native-youtube-iframe').default;
}

export function YouTubePlayer({ videoId, width, height, title }: YouTubePlayerProps) {
  if (Platform.OS === 'web') {
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

  // Native: Use react-native-youtube-iframe
  if (NativeYoutubePlayer) {
    return (
      <View style={[styles.container, { width, height }]}>
        <NativeYoutubePlayer
          height={height}
          width={width}
          videoId={videoId}
          play={false}
          webViewProps={{
            allowsInlineMediaPlayback: true,
            mediaPlaybackRequiresUserAction: false,
          }}
        />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
});

export default YouTubePlayer;
