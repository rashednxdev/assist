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
config.server.unstable_serverRoot = projectRoot;
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /\.expo-test-bundle\/.*/,
];

module.exports = config;
