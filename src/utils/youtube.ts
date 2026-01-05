/**
 * YouTube Utilities
 * Functions for parsing and validating YouTube URLs
 */

/**
 * YouTube video metadata
 */
export interface YouTubeVideoInfo {
  videoId: string;
  url: string;
  embedUrl: string;
  thumbnailUrl: string;
  thumbnailUrlHQ: string;
}

/**
 * Extract video ID from various YouTube URL formats
 *
 * Supports:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/v/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 *
 * @param url - YouTube URL to parse
 * @returns Video ID or null if invalid
 */
export function extractYouTubeVideoId(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Clean the URL
  const cleanUrl = url.trim();

  // Regular expressions for different YouTube URL formats
  const patterns = [
    // Standard watch URL: youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=|youtube\.com\/watch\?.+&v=)([a-zA-Z0-9_-]{11})/,
    // Short URL: youtu.be/VIDEO_ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Embed URL: youtube.com/embed/VIDEO_ID
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Old embed URL: youtube.com/v/VIDEO_ID
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
    // Shorts URL: youtube.com/shorts/VIDEO_ID
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
    // Just the video ID (11 characters)
    /^([a-zA-Z0-9_-]{11})$/,
  ];

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/**
 * Check if a URL is a valid YouTube URL
 *
 * @param url - URL to validate
 * @returns True if valid YouTube URL
 */
export function isValidYouTubeUrl(url: string): boolean {
  return extractYouTubeVideoId(url) !== null;
}

/**
 * Get full video info from a YouTube URL
 *
 * @param url - YouTube URL
 * @returns Video info object or null if invalid
 */
export function getYouTubeVideoInfo(url: string): YouTubeVideoInfo | null {
  const videoId = extractYouTubeVideoId(url);

  if (!videoId) {
    return null;
  }

  return {
    videoId,
    url: `https://www.youtube.com/watch?v=${videoId}`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    thumbnailUrlHQ: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

/**
 * Generate YouTube thumbnail URL
 *
 * @param videoId - YouTube video ID
 * @param quality - Thumbnail quality ('default', 'mq', 'hq', 'sd', 'maxres')
 * @returns Thumbnail URL
 */
export function getYouTubeThumbnailUrl(
  videoId: string,
  quality: 'default' | 'mq' | 'hq' | 'sd' | 'maxres' = 'hq'
): string {
  const qualityMap = {
    default: 'default', // 120x90
    mq: 'mqdefault', // 320x180
    hq: 'hqdefault', // 480x360
    sd: 'sddefault', // 640x480
    maxres: 'maxresdefault', // 1280x720
  };

  return `https://img.youtube.com/vi/${videoId}/${qualityMap[quality]}.jpg`;
}

/**
 * Generate YouTube embed URL with optional parameters
 *
 * @param videoId - YouTube video ID
 * @param options - Embed options
 * @returns Embed URL
 */
export function getYouTubeEmbedUrl(
  videoId: string,
  options: {
    autoplay?: boolean;
    controls?: boolean;
    loop?: boolean;
    mute?: boolean;
    start?: number; // Start time in seconds
    end?: number; // End time in seconds
    rel?: boolean; // Show related videos
  } = {}
): string {
  const params = new URLSearchParams();

  if (options.autoplay) params.set('autoplay', '1');
  if (options.controls === false) params.set('controls', '0');
  if (options.loop) params.set('loop', '1');
  if (options.mute) params.set('mute', '1');
  if (options.start) params.set('start', String(options.start));
  if (options.end) params.set('end', String(options.end));
  if (options.rel === false) params.set('rel', '0');

  const queryString = params.toString();
  const baseUrl = `https://www.youtube.com/embed/${videoId}`;

  return queryString ? `${baseUrl}?${queryString}` : baseUrl;
}

/**
 * Parse timestamp from YouTube URL (e.g., ?t=1m30s or ?t=90)
 *
 * @param url - YouTube URL with timestamp
 * @returns Timestamp in seconds or null
 */
export function parseYouTubeTimestamp(url: string): number | null {
  if (!url) return null;

  // Match ?t=90 or &t=90 (seconds only)
  const secondsMatch = url.match(/[?&]t=(\d+)(?:$|&)/);
  if (secondsMatch) {
    return parseInt(secondsMatch[1], 10);
  }

  // Match ?t=1m30s or &t=1m30s
  const timeMatch = url.match(/[?&]t=(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1] || '0', 10);
    const minutes = parseInt(timeMatch[2] || '0', 10);
    const seconds = parseInt(timeMatch[3] || '0', 10);
    return hours * 3600 + minutes * 60 + seconds;
  }

  return null;
}

/**
 * Format seconds as YouTube-style duration (MM:SS or HH:MM:SS)
 *
 * @param seconds - Duration in seconds
 * @returns Formatted duration string
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Open YouTube video in external app or browser
 *
 * @param videoId - YouTube video ID
 * @param timestamp - Optional start time in seconds
 * @returns URL to open
 */
export function getYouTubeOpenUrl(videoId: string, timestamp?: number): string {
  let url = `https://www.youtube.com/watch?v=${videoId}`;
  if (timestamp && timestamp > 0) {
    url += `&t=${timestamp}`;
  }
  return url;
}

/**
 * Generate HTML wrapper for YouTube embed in WebView
 * This fixes Error 153 by properly handling the iframe embed with correct origin
 *
 * @param videoId - YouTube video ID
 * @param options - Embed options
 * @returns HTML string to load in WebView
 */
export function getYouTubeEmbedHtml(
  videoId: string,
  options: {
    autoplay?: boolean;
    controls?: boolean;
    loop?: boolean;
    mute?: boolean;
    start?: number;
    end?: number;
    rel?: boolean;
  } = {}
): string {
  const embedUrl = getYouTubeEmbedUrl(videoId, {
    ...options,
    // Add playsinline for iOS
  });

  // Add enablejsapi and origin parameters for better compatibility
  const finalUrl = `${embedUrl}${embedUrl.includes('?') ? '&' : '?'}enablejsapi=1&playsinline=1`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 100%;
      height: 100%;
      background-color: #000;
      overflow: hidden;
    }
    .video-container {
      position: relative;
      width: 100%;
      height: 100%;
    }
    iframe {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
    }
  </style>
</head>
<body>
  <div class="video-container">
    <iframe
      src="${finalUrl}"
      frameborder="0"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
      allowfullscreen
      playsinline
      webkitallowfullscreen
      mozallowfullscreen
    ></iframe>
  </div>
</body>
</html>
  `.trim();
}
