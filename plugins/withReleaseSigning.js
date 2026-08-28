const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withReleaseSigning(config) {
  const appVersion = config.version || '4.0.0';
  const androidConfig = config.android || {};
  const versionCode = androidConfig.versionCode || 40;

  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents) {
      let contents = config.modResults.contents;

      // Fix signingConfig from debug to release
      contents = contents.replace(
        /(release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug/,
        '$1signingConfigs.release'
      );

      // Update versionCode
      contents = contents.replace(
        /(versionCode\s+)\d+/,
        `$1${versionCode}`
      );

      // Update versionName
      contents = contents.replace(
        /(versionName\s+)"[^"]+"/,
        `$1"${appVersion}"`
      );

      config.modResults.contents = contents;
    }
    return config;
  });
};
