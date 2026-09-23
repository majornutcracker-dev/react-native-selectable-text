// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const root = path.resolve(__dirname, "..");
const { peerDependencies } = require(path.join(root, "package.json"));
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The library's peer dependencies are also installed in ../node_modules as dev dependencies.
// ../src must resolve them to this app's copies, otherwise Metro bundles them twice. A second
// `expo` is the worst case: its Expo.fx re-registers "main" as AppEntryNotFound once the library
// loads, so the next Activity recreation (e.g. a font size change) renders that error screen.
config.resolver.blockList = [
  ...Array.from(config.resolver.blockList ?? []),
  ...Object.keys(peerDependencies).map(
    (name) =>
      new RegExp(
        `^${escapeRegExp(path.join(root, "node_modules", name))}[\\\\/]`
      )
  ),
];

config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "./node_modules"),
  path.resolve(__dirname, "../node_modules"),
];

config.resolver.extraNodeModules = {
  "@majornutcracker/react-native-selectable-text": "..",
};

config.watchFolders = [path.resolve(__dirname, "..")];

config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;
