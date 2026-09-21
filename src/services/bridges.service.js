const { getClient } = require('../ariConnection');

let ari;

async function connect() {
  ari = await getClient();
}

function toPlainBridge(bridge) {
  return {
    id: bridge.id,
    name: bridge.name,
    technology: bridge.technology,
    bridge_type: bridge.bridge_type,
    bridge_class: bridge.bridge_class,
    channels: bridge.channels,
    creationTime: bridge.creationtime,
  };
}

async function addNewChannel({ bridgeId, channelId }) {
  if (!channelId) return { success: false, message: 'channelId is mandatory.', statusCode: 400 };
  await ari.bridges.addChannel({ bridgeId, channel: channelId });
  return { success: true, message: `Channel ${channelId} added to bridge ${bridgeId}.`, statusCode: 200 };
}

async function removeExistingChannel({ bridgeId, channelId }) {
  if (!channelId) return { success: false, message: 'channelId is mandatory.', statusCode: 400 };
  await ari.bridges.removeChannel({ bridgeId, channel: channelId });
  return { success: true, message: `Channel ${channelId} removed from bridge ${bridgeId}.`, statusCode: 200 };
}

async function startMohBridge({ bridgeId, mohClass }) {
  await ari.bridges.startMoh({ bridgeId, mohClass });
  return { success: true, message: `Music on hold started on bridge ${bridgeId}.`, statusCode: 200 };
}

async function stopMohBridge({ bridgeId }) {
  await ari.bridges.stopMoh({ bridgeId });
  return { success: true, message: `Music on hold stopped on bridge ${bridgeId}.`, statusCode: 200 };
}

const updateActions = {
  addChannel: addNewChannel,
  removeChannel: removeExistingChannel,
  startMoh: startMohBridge,
  stopMoh: stopMohBridge,
};

const BridgesService = {

  async getAll() {
    try {
      const bridges = await ari.bridges.list();
      return { success: true, message: bridges.map(toPlainBridge), statusCode: 200 };
    } catch (error) {
      return { success: false, message: error.message, statusCode: 500 };
    }
  },

  async getOne(req) {
    try {
      const bridgeId = req.query.bridgeId;
      if (!bridgeId) return { success: false, message: 'bridgeId is mandatory.', statusCode: 400 };
      const bridge = await ari.bridges.get({ bridgeId });
      return { success: true, message: toPlainBridge(bridge), statusCode: 200 };
    } catch (err) {
      return { success: false, message: err.message, statusCode: 500 };
    }
  },

  async create(req) {
    try {
      const body = req.body || {};
      const bridge = await ari.bridges.create({
        type: body.type || 'mixing',
        name: body.name,
      });

      return { success: true, message: toPlainBridge(bridge), statusCode: 201 };
    } catch (e) {
      return { success: false, message: e.message, statusCode: 500 };
    }
  },

  async update(req) {
    const bridgeId = req.query.bridgeId;
    if (!bridgeId) return { success: false, message: 'bridgeId is mandatory (pass it as a query parameter).', statusCode: 400 };

    const body = req.body || {};
    const action = body.action;
    const handler = updateActions[action];

    if (!handler) return { success: false, message: `Unknown action "${action}". Expected one of: ${Object.keys(updateActions).join(', ')}`, statusCode: 400 };
    try {
      return await handler({ ...body, bridgeId });
    } catch (err) {
      return { success: false, message: err.message, statusCode: 500 };
    }
  },

  async remove(req) {
    try {
      const bridgeId = req.query.bridgeId;
      if (!bridgeId) return { success: false, message: 'bridgeId is mandatory.', statusCode: 400 };
      await ari.bridges.destroy({ bridgeId });
      return { success: true, message: `Bridge ${bridgeId} destroyed.`, statusCode: 200 };
    } catch (err) {
      return { success: false, message: err.message, statusCode: 500 };
    }
  },

};

connect().then(r => ({}));

module.exports = BridgesService;
