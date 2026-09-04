import js from "@eslint/js";
import prettier from "eslint-plugin-prettier";
import globals from "globals";
// `typescript-eslint` re-exports the plugin and the parser, so they don't need
// to be declared (and kept in sync) as separate dependencies.
import tseslint from "typescript-eslint";

export default [
  js.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js,jsx}"],
    languageOptions: {
      parser: tseslint.parser,
      globals: {
        ...globals.node,
        ...globals.browser,
        React: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
      prettier: prettier,
    },
    rules: {
      "prettier/prettier": ["error", { singleQuote: false }],
      // The base rule doesn't understand type-only positions (it flags the
      // parameter names in callback type declarations), so TS files rely on
      // the typescript-eslint version instead.
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "warn",
      "no-undef": "error",
      "no-console": "off",
    },
  },
  {
    files: ["**/__tests__/**", "**/*.{test,spec}.{ts,tsx,js,jsx}"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
  {
    ignores: [
      "build/", // tsc output (see tsconfig.json `outDir`)
      "dist/",
      "coverage/",
      "node_modules/",
      "ios/",
      "android/",
      ".expo/",
      "example/.expo/",
      "src/rangy@1.3.2/", // vendored third-party, not ours to lint
    ],
  },
];
