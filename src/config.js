const packageJson = require('../package.json');

const appConfig = packageJson.orbit || {};

module.exports = {
  remoteUrl: process.env.ORBIT_REMOTE_URL || appConfig.remoteUrl,
  updates: {
    owner: process.env.ORBIT_UPDATE_OWNER || appConfig.updates?.owner || '',
    repo: process.env.ORBIT_UPDATE_REPO || appConfig.updates?.repo || ''
  }
};
