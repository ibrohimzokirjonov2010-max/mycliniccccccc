const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const defaultResolveRequest = config.resolver.resolveRequest;

// bcryptjs imports Node's crypto only for salt generation. Password checks
// do not need it, and React Native has no Node crypto module.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromBcrypt = context.originModulePath?.includes(`${path.sep}bcryptjs${path.sep}`);
  if (fromBcrypt && (moduleName === 'crypto' || moduleName === 'node:crypto')) {
    return { type: 'empty' };
  }
  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
