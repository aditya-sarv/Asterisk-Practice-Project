const express = require('express');

const services = {
  applications: require('../services/application.service'),
  channels: require('../services/channels.service'),
  bridges: require('../services/bridges.service'),
};

const requestMethods = {
  'get-all': require('./request-methods/get-all'),
  'get-one': require('./request-methods/get-one'),
  'create': require('./request-methods/create'),
  'update': require('./request-methods/update'),
  'delete': require('./request-methods/delete'),
};

function describeError(err) {
  if (err && err.type === 'entity.parse.failed') {
    return { status: 400, message: 'Request body is not valid JSON' };
  }
  if (err && Number.isInteger(err.status)) {
    return { status: err.status, message: err.message };
  }

  let message = err && err.message ? err.message : String(err);
  try {
    const parsed = JSON.parse(message);
    if (parsed && typeof parsed.message === 'string') {
      message = parsed.message;
    }
  } catch (err) {
    console.log('Error : ', err);
  }

  let status = 500;
  if (/not found|does not exist|not subscribed/i.test(message)) {
    status = 404;
  } else if (/not implemented/i.test(message)) {
    status = 501;
  }
  return { status, message };
}

const router = express.Router();

router.all('/:module/:type', (req, res, next) => {
  const { module, type } = req.params;

  const service = services[module];
  if (!service) {
    return res.status(404).json({ success: false, message: `Unknown module "${module}"` });
  }

  const handler = requestMethods[type];
  if (!handler) {
    return res.status(404).json({ success: false, message: `Unknown route type "${type}"` });
  }

  req.service = service;
  req.route_info = `${module}/${type}`;
  handler(req, res, next);
});

router.use((req, res) => {
  res.status(404).json({ success: false, message: `Not found: ${req.method} ${req.baseUrl}${req.path}` });
});

router.use((err, req, res, next) => {
  const { status, message } = describeError(err);
  if (status >= 500) {
    console.error(`[api] ${req.route_info || req.path} failed:`, message);
  }
  res.status(status).json({ success: false, message: message });
});

module.exports = { router, requestMethods };
