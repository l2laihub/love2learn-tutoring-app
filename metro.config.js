// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Fix for Windows file system watcher issues (EISDIR error on mapped/network drives)
// See: https://github.com/facebook/metro/issues/1071
config.watcher = {
  watchman: false,
  healthCheck: {
    enabled: false,
  },
  useNativeFind: false,
  // Use polling with longer intervals for network/mapped drives
  useWatchman: false,
};

// Force resolver to use hash-based caching
config.resolver = {
  ...config.resolver,
  unstable_enablePackageExports: true,
};

module.exports = config;
