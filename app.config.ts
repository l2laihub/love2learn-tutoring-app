import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Expo configuration for Love2Learn Tutoring App
 * Supports environment variables for different deployment environments
 *
 * Version Scheme:
 * - version: Semantic version (major.minor.patch) displayed to users
 * - iOS buildNumber: Incremented for each build (managed by EAS with autoIncrement)
 * - Android versionCode: Incremented for each build (managed by EAS with autoIncrement)
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Love2Learn',
  slug: 'love2learn',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'automatic',

  // Splash screen configuration
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#FFFFFF',
  },

  assetBundlePatterns: ['**/*'],

  // iOS-specific configuration
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.love2learn.app',
    buildNumber: '1',
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      // Camera and Photo Library permissions for image picker
      NSCameraUsageDescription:
        'Love2Learn needs camera access to take photos for student profiles and learning materials.',
      NSPhotoLibraryUsageDescription:
        'Love2Learn needs photo library access to upload images for student profiles and learning materials.',
      NSPhotoLibraryAddUsageDescription:
        'Love2Learn needs permission to save images to your photo library.',
      // Document picker permissions
      UISupportsDocumentBrowser: true,
      LSSupportsOpeningDocumentsInPlace: true,
      // Background modes (if needed for notifications)
      UIBackgroundModes: ['remote-notification'],
      // App Transport Security (already using HTTPS)
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: false,
      },
    },
    // Associate with your domain for universal links (update with your domain)
    associatedDomains: ['applinks:love2learn.app'],
  },

  // Android-specific configuration
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#FFFFFF',
      monochromeImage: './assets/adaptive-icon.png',
    },
    package: 'com.love2learn.app',
    versionCode: 1,
    permissions: [
      // Camera and storage for image picker
      'android.permission.CAMERA',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
      // Internet (usually automatic)
      'android.permission.INTERNET',
      'android.permission.ACCESS_NETWORK_STATE',
      // Notifications
      'android.permission.RECEIVE_BOOT_COMPLETED',
      'android.permission.VIBRATE',
    ],
    // Intent filters for deep linking
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'love2learn.app',
            pathPrefix: '/',
          },
          {
            scheme: 'love2learn',
            host: '*',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },

  // Web configuration
  web: {
    favicon: './assets/favicon.png',
    bundler: 'metro',
    name: 'Love2Learn Tutoring',
    shortName: 'Love2Learn',
    description: 'All-in-one tutoring management for independent tutors',
    themeColor: '#3D9CA8',
    backgroundColor: '#FFFFFF',
  },

  // Expo plugins
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-font',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Love2Learn needs access to your photos to upload images for student profiles and materials.',
        cameraPermission:
          'Love2Learn needs camera access to take photos for student profiles and materials.',
      },
    ],
    [
      'expo-document-picker',
      {
        iCloudContainerEnvironment: 'Production',
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  // URL scheme for deep linking
  scheme: 'love2learn',

  // Extra configuration accessible via Constants.expoConfig.extra
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    eas: {
      // Replace with your actual EAS project ID from expo.dev
      projectId: 'your-eas-project-id',
    },
  },

  // EAS Update configuration
  updates: {
    enabled: process.env.APP_ENV === 'production',
    url: 'https://u.expo.dev/your-eas-project-id',
    fallbackToCacheTimeout: 0,
  },

  // Runtime version for OTA updates (uses native version by default)
  runtimeVersion: {
    policy: 'appVersion',
  },

  // Owner for EAS (replace with your Expo username or organization)
  owner: 'your-expo-username',
});
