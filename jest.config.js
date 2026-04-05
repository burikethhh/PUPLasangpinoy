/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFiles: ["./jest.setup.ts"],
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],

  // Extend the preset's transformIgnorePatterns to also transform firebase packages.
  // The preset covers expo, react-native, etc. but not firebase (which ships ESM).
  // We mock all firebase modules in jest.setup.ts so transformation is optional,
  // but listing them here avoids import-syntax errors if mocks are incomplete.
  transformIgnorePatterns: [
    "/node_modules/(?!(.pnpm|react-native|@react-native|@react-native-community|expo|expo-modules-core|@expo|@expo-google-fonts|react-navigation|@react-navigation|@sentry/react-native|native-base|firebase|@firebase)/)",
    "/node_modules/react-native-reanimated/plugin/",
  ],

  moduleNameMapper: {
    // expo/virtual/env: babel-preset-expo transforms process.env.EXPO_PUBLIC_*
    // into `import { env } from 'expo/virtual/env'` in dev mode.
    "^expo/virtual/env$": "<rootDir>/__mocks__/expo-virtual-env.js",
    // Prevent the Expo winter runtime polyfills from installing lazy getters
    // that trigger dynamic import() in the Jest environment.
    "^expo/src/winter$": "<rootDir>/__mocks__/expo-winter.js",
    "^expo/src/winter/(.*)$": "<rootDir>/__mocks__/expo-winter.js",
    "^expo/virtual/(.*)$": "<rootDir>/__mocks__/expo-winter.js",
    "^expo/build/winter/(.*)$": "<rootDir>/__mocks__/expo-winter.js",
    // Path alias from tsconfig
    "^@/(.*)$": "<rootDir>/$1",
  },

  collectCoverageFrom: [
    "lib/**/*.{ts,tsx}",
    "!lib/**/*.d.ts",
  ],

  coverageThreshold: {
    global: {
      lines: 60,
    },
  },
};
