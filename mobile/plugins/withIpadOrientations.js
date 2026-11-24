const { withInfoPlist } = require('expo/config-plugins');

/** Phone stays portrait via app.json orientation. iPad supports every orientation. */
module.exports = function withIpadOrientations(config) {
  return withInfoPlist(config, (config) => {
    config.modResults['UISupportedInterfaceOrientations~ipad'] = [
      'UIInterfaceOrientationPortrait',
      'UIInterfaceOrientationPortraitUpsideDown',
      'UIInterfaceOrientationLandscapeLeft',
      'UIInterfaceOrientationLandscapeRight',
    ];
    return config;
  });
};
