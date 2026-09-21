const config = require('../config');
const { getClient } = require('../ariConnection');

let ari;

async function connect() {
  ari = await getClient();
}

function toPlainChannel(channel) {
  return {
    id: channel.id,
    name: channel.name,
    state: channel.state,
    caller: channel.caller,
    connected: channel.connected,
    dialplan: channel.dialplan,
    creationTime: channel.creationtime,
  };
}

function buildTrunkEndpoint(destination) {
  return `${config.trunkTech}/${config.trunkName}/${destination}`;
}

async function answerChannel({ channelId }) {
  await ari.channels.answer({ channelId });
  return { success: true, message: `Channel ${channelId} answered.`, statusCode: 200 };
}

async function holdChannel({ channelId }) {
  await ari.channels.hold({ channelId });
  return { success: true, message: `Channel ${channelId} placed on hold.`, statusCode: 200 };
}

async function unholdChannel({ channelId }) {
  await ari.channels.unhold({ channelId });
  return { success: true, message: `Channel ${channelId} taken off hold.`, statusCode: 200 };
}

async function muteChannel({ channelId, direction }) {
  const dir = direction || 'both';
  await ari.channels.mute({ channelId, direction: dir });
  return { success: true, message: `Channel ${channelId} muted (${dir}).`, statusCode: 200 };
}

async function unmuteChannel({ channelId, direction }) {
  const dir = direction || 'both';
  await ari.channels.unmute({ channelId, direction: dir });
  return { success: true, message: `Channel ${channelId} unmuted (${dir}).`, statusCode: 200 };
}

async function startMohChannel({ channelId, mohClass }) {
  await ari.channels.startMoh({ channelId, mohClass });
  return { success: true, message: `Music on hold started on channel ${channelId}.`, statusCode: 200 };
}

async function stopMohChannel({ channelId }) {
  await ari.channels.stopMoh({ channelId });
  return { success: true, message: `Music on hold stopped on channel ${channelId}.`, statusCode: 200 };
}

// Pull the channel out of its current bridge and, if a target bridge is given, drop it into that one else hang it up.
async function transferChannel({ channelId, fromBridgeId, toBridgeId }) {
  if (!fromBridgeId && !toBridgeId) {
    return { success: false, message: 'At least one of fromBridgeId or toBridgeId is required.', statusCode: 400 };
  }

  if (fromBridgeId) {
    await ari.bridges.removeChannel({ bridgeId: fromBridgeId, channel: channelId });
  }

  if (toBridgeId) {
    await ari.bridges.addChannel({ bridgeId: toBridgeId, channel: channelId });
    return {
      success: true,
      message: `Channel ${channelId} transferred${fromBridgeId ? ` from bridge ${fromBridgeId}` : ''} to bridge ${toBridgeId}.`,
      statusCode: 200,
    };
  }

  await ari.channels.hangup({ channelId });
  return {
    success: true,
    message: `Channel ${channelId} removed from bridge ${fromBridgeId} and hung up (no transfer target given).`,
    statusCode: 200,
  };
}

const updateActions = {
  answer: answerChannel,
  hold: holdChannel,
  unhold: unholdChannel,
  mute: muteChannel,
  unmute: unmuteChannel,
  startMoh: startMohChannel,
  stopMoh: stopMohChannel,
  transfer: transferChannel,
};

const ChannelsService = {

  async getAll() {
    try {
      const channels = await ari.channels.list();
      return { success: true, message: channels.map(toPlainChannel), statusCode: 200 };
    } catch (error) {
      return { success: false, message: error.message, statusCode: 500 };
    }
  },

  async getOne(req) {
    try {
      const channelId = req.query.channelId;
      if (!channelId) return { success: false, message: 'channelId is mandatory.', statusCode: 400 };
      const channel = await ari.channels.get({ channelId });
      return { success: true, message: toPlainChannel(channel), statusCode: 200 };
    } catch (err) {
      return { success: false, message: err.message, statusCode: 500 };
    }
  },

  async create(req) {
    try {
      const body = req.body || {};
      const destination = body.destination;

      if (!destination) return { success: false, message: 'destination is mandatory.', statusCode: 400 };

      const channel = await ari.channels.originate({
        endpoint: buildTrunkEndpoint(destination),
        app: config.appName,
        callerId: body.callerId || config.trunkCli,
        timeout: body.timeout || 30,
      });

      return { success: true, message: toPlainChannel(channel), statusCode: 201 };
    } catch (e) {
      return { success: false, message: e.message, statusCode: 500 };
    }
  },

  async update(req) {
    const channelId = req.query.channelId;
    if (!channelId) return { success: false, message: 'Channel ID is mandatory.', statusCode: 400 };

    const body = req.body || {};
    const action = body.action;
    const handler = updateActions[action];

    if (!handler) return { success: false, message: `Unknown action "${action}". Expected one of: ${Object.keys(updateActions).join(', ')}`, statusCode: 400 };
    try {
      return await handler({ ...body, channelId });
    } catch (err) {
      return { success: false, message: err.message, statusCode: 500 };
    }
  },

  async remove(req) {
    try {
      const channelId = req.query.channelId || (req.body && req.body.channelId);
      if (!channelId) return { success: false, message: 'channelId is mandatory.', statusCode: 400 };
      await ari.channels.hangup({ channelId });
      return { success: true, message: `Channel ${channelId} hung up.`, statusCode: 200 };
    } catch (err) {
      return { success: false, message: err.message, statusCode: 500 };
    }
  },

};

connect().then(r => ({}));

module.exports = ChannelsService;