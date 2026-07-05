const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
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
];

module.exports = config;
