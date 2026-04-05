// Empty module mock for Expo winter runtime polyfills.
// These polyfills are for the native/web runtime and are not needed in Jest tests.
module.exports = {
  installFormDataPatch: () => {},
  InstallMetaRegistry: {},
  ImportMetaRegistry: {},
};
