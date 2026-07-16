const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Watch only what Metro needs — not apps/web (.next cache crashes the watcher on Windows).
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;
// Expo's default monorepo support moves the Metro server root up to the
// monorepo root, which breaks the React Native Gradle plugin's entryFile
// resolution (it computes paths relative to this project's root instead).
// Keep the server root here so native release builds (./gradlew assembleRelease)
// can resolve the entry file correctly.
// Pair with EXPO_NO_METRO_WORKSPACE_ROOT=1 in the dev script so Expo's bundle
// URL rewrite uses the same root (otherwise /.expo/.virtual-metro-entry 404s).
config.server.unstable_serverRoot = projectRoot;
// Monorepo: Expo Go may request /apps/mobile/... while Metro serves from projectRoot.
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    if (req.url?.startsWith('/apps/mobile/')) {
      req.url = req.url.slice('/apps/mobile'.length) || '/';
    }
    return middleware(req, res, next);
  };
};
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /\.expo-test-bundle\/.*/,
  /[/\\]android[/\\]app[/\\]build[/\\].*/,
  /[/\\]android[/\\]build[/\\].*/,
  /[/\\]android[/\\]\.cxx[/\\].*/,
  /[/\\]\.cxx[/\\].*/,
  /datetimepicker_tmp[^/\\]*[/\\].*/,
  /[/\\]apps[/\\]web[/\\]\.next[/\\].*/,
  /[/\\]apps[/\\]api[/\\]dist[/\\].*/,
  // @react-native/gradle-plugin ships its own prebuilt Gradle `build/tmp` dir;
  // Metro's Windows FallbackWatcher crashes lstat-ing it (ENOENT/UNKNOWN races
  // on the transient tmp/jar contents) — same class of bug as the .cxx/android
  // build exclusions above, just a different package.
  /[/\\]gradle-plugin[/\\]shared[/\\]build[/\\].*/,
];

module.exports = config;
