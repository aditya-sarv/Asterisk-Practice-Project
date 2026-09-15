const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

function fromEnv(key, fallback= "") {
  const value = process.env[key];
  return value && value.trim() !== '' ? value : fallback;
}

const config = {
  url: fromEnv('ARI_URL'), // base URL of the Asterisk HTTP Server (http.conf)
  username: fromEnv('ARI_USERNAME'),
  password: fromEnv('ARI_PASSWORD'),
  appName: fromEnv('ARI_APP_NAME'),
  port: Number(fromEnv('PORT')),
  eventSource: fromEnv('ARI_EVENT_SOURCE', 'channel:'),
};

module.exports = config;
