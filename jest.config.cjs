// `testRegex`/`watchPlugins` are not valid inside a `projects` entry, so strip
// them from the preset; we scope each project by extension via `testMatch`.
const {
  testRegex,
  watchPlugins,
  ...utilsPreset
} = require("expo-module-scripts/jest-preset-utils");

/** @type {import('jest').Config} */
module.exports = {
  // Avoid depending on a running watchman daemon (also more reliable in CI).
  watchman: false,
  projects: [
    {
      ...utilsPreset,
      displayName: "utils",
      roots: ["<rootDir>/src"],
      testMatch: ["<rootDir>/src/**/*.test.ts"],
    },
    {
      preset: "jest-expo",
      displayName: "native",
      roots: ["<rootDir>/src"],
      testMatch: ["<rootDir>/src/**/*.test.tsx"],
    },
  ],
};
