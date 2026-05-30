/**
 * Mock for expo/virtual/env
 *
 * babel-preset-expo transforms `process.env.EXPO_PUBLIC_*` into
 * `env.EXPO_PUBLIC_*` (imported from this module) in non-production builds.
 * This mock provides the test-time values for all env vars used in lib/*.
 */
module.exports = {
  env: {
    EXPO_PUBLIC_QWEN_API_KEY: "sk-test-api-key-for-jest",
    EXPO_PUBLIC_FIREBASE_API_KEY: "test-firebase-api-key",
    EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN: "test-project.firebaseapp.com",
    EXPO_PUBLIC_FIREBASE_PROJECT_ID: "test-project",
    EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET: "test-project.appspot.com",
    EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: "123456789",
    EXPO_PUBLIC_FIREBASE_APP_ID: "1:123456789:web:test",
  },
};
