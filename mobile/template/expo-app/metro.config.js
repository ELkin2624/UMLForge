const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch the entire monorepo (packages + apps) so Metro sees workspace changes
config.watchFolders = [monorepoRoot];

// 2. Resolve packages: project node_modules first (so react-native is unique),
//    then monorepo root for shared workspace packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Force single React and React Native from project (prevents "two copies" errors)
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  '@expo/metro-runtime': path.resolve(projectRoot, 'node_modules/@expo/metro-runtime'),
  'expo-router': path.resolve(projectRoot, 'node_modules/expo-router'),
};

module.exports = config;
