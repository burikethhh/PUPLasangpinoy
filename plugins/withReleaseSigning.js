const { withAppBuildGradle } = require('@expo/config-plugins');

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.contents) {
      config.modResults.contents = config.modResults.contents.replace(
        /(release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug/,
        '$1signingConfigs.release'
      );
    }
    return config;
  });
};
