import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Expo configuration for Love2Learn Tutoring App
 * Supports environment variables for different deployment environments
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Love2Learn',
  slug: 'love2learn',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FF6B6B', // Coral theme color
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.love2learn.app',
    config: {
      usesNonExemptEncryption: false,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FF6B6B', // Coral theme color
    },
    package: 'com.love2learn.app',
  },
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
  ],
  experiments: {
    typedRoutes: true,
  },
  scheme: 'love2learn',
  extra: {
    // Environment variables accessible via Constants.expoConfig.extra
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    // Support both publishable key and legacy anon key naming
    supabasePublishableKey:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    eas: {
      projectId: 'your-eas-project-id',
    },
  },
  // Disable OTA updates during development to avoid network issues
  updates: {
    enabled: false,
  },
});
