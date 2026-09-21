const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function fromEnv(key, fallback= "") {
  const value = process.env[key];
  return value && value.trim() !== '' ? value : fallback;
}

const config = {
  url: fromEnv('ARI_URL'),
  username: fromEnv('ARI_USERNAME'),
  password: fromEnv('ARI_PASSWORD'),
  appName: fromEnv('ARI_APP_NAME'),
  port: Number(fromEnv('PORT')),
  eventSource: fromEnv('ARI_EVENT_SOURCE', 'channel:'),
  trunkName: fromEnv('TRUNK_NAME'),
  trunkCli: fromEnv('TRUNK_CLI'),
  trunkTech: fromEnv('TRUNK_TECH'),
};

module.exports = config;
