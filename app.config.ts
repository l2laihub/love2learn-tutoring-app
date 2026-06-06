import { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Expo configuration for Love2Learn Tutoring App
 * Supports environment variables for different deployment environments
 *
 * Version Scheme:
 * - version: Semantic version (major.minor.patch) displayed to users
 * - iOS buildNumber: Incremented for each build (managed by EAS with autoIncrement)
 * - Android versionCode: Incremented for each build (managed by EAS with autoIncrement)
 *
 * runtimeVersion policy is `appVersion`, so the runtime is derived from `version`
 * above. OTA updates (`eas update`) only reach installs whose runtime matches the
 * published update's runtime. Bumping `version` 1.0.0 -> 1.1.0 means updates
 * published after this bump target the 1.1.0 build; existing 1.0.0 installs only
 * get the rebrand via the new store build (or a separate update published while
 * the config still reads 1.0.0).
 */
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'DaLesson',
  slug: 'love2learn',
  version: '1.1.0',
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
    bundleIdentifier: 'app.huybuilds.dalesson',
    buildNumber: '2',
    config: {
      usesNonExemptEncryption: false,
    },
    infoPlist: {
      // Camera and Photo Library permissions for image picker
      NSCameraUsageDescription:
        'DaLesson needs camera access to take photos for student profiles and learning materials.',
      NSPhotoLibraryUsageDescription:
        'DaLesson needs photo library access to upload images for student profiles and learning materials.',
      NSPhotoLibraryAddUsageDescription:
        'DaLesson needs permission to save images to your photo library.',
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
      foregroundImage: './assets/adaptive-icon-foreground.png',
      backgroundColor: '#FF6B6B',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
    },
    package: 'app.huybuilds.dalesson',
    versionCode: 2,
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
            scheme: 'dalesson',
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
    name: 'DaLesson Tutoring',
    shortName: 'DaLesson',
    description: 'All-in-one tutoring management for independent tutors',
    themeColor: '#FF6B6B',
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
          'DaLesson needs access to your photos to upload images for student profiles and materials.',
        cameraPermission:
          'DaLesson needs camera access to take photos for student profiles and materials.',
      },
    ],
    [
      'expo-document-picker',
      {
        iCloudContainerEnvironment: 'Production',
      },
    ],
    [
      'expo-notifications',
      {
        color: '#FF6B6B',
      },
    ],
  ],

  experiments: {
    typedRoutes: true,
  },

  // URL scheme for deep linking
  scheme: 'dalesson',

  // Extra configuration accessible via Constants.expoConfig.extra
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabasePublishableKey:
      process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    openaiApiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
    eas: {
      projectId: '80057121-e849-408e-bd31-10d40bb4934f',
    },
  },

  // EAS Update configuration (OTA). Channels are set per build profile in eas.json.
  updates: {
    enabled: true,
    url: 'https://u.expo.dev/80057121-e849-408e-bd31-10d40bb4934f',
    fallbackToCacheTimeout: 0,
  },

  // Runtime version for OTA updates (uses native version by default)
  runtimeVersion: {
    policy: 'appVersion',
  },

  // Owner for EAS (Expo account/organization)
  owner: 'huybuilds',
});
