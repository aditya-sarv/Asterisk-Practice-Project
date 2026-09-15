const { getClient } = require('../ariConnection');

let ari;

async function connect() {
  ari = await getClient();
}

function toPlainApplication(app) {
  return {
    name: app.name,
    channel_ids: app.channel_ids,
    bridge_ids: app.bridge_ids,
    endpoint_ids: app.endpoint_ids,
    device_names: app.device_names,
    events_allowed: app.events_allowed,
    events_disallowed: app.events_disallowed,
  };
}

const ApplicationsService = {

  async getAll() {
    try {
      const apps = await ari.applications.list();
      return { success: true, message: apps.map(toPlainApplication), statusCode: 200 };
    } catch (error) {
      return { success: false, message: error.message, statusCode: 500 };
    }
  },

  async getOne(req) {
    try {
      const name = req.query.name;
      const app = await ari.applications.get({ applicationName: name });
      return { success: true, message: toPlainApplication(app), statusCode: 200 };
    } catch (err) {
      return { success: false, message: err.message, statusCode: 500 };
    }
  },

  async create(req) {
    try {
      const body = req.body || {};
      const applicationName = body.applicationName;
      const eventSource = body.eventSource;

      if (!applicationName && !eventSource) return { success: false, message: `Application Name and Event Source are mandatory.`, statusCode: 404 };

      const app = await ari.applications.subscribe({ applicationName: applicationName, eventSource });
      return { success: true, message: toPlainApplication(app), statusCode: 201 };
    } catch (e) {
      return { success: false, message: e.message, statusCode: 500 };
    }
  }

};

connect().then(r => ({}));

module.exports = ApplicationsService;