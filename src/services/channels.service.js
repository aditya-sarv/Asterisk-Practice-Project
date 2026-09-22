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

const VALID_RECORDING_NAME = /^[A-Za-z0-9_.-]+$/;

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

async function progressChannel({ channelId }) {
  await ari.channels.ring({ channelId });
  return { success: true, message: `Ringing indication started on channel ${channelId}.`, statusCode: 200 };
}

async function ringStopChannel({ channelId }) {
  await ari.channels.ringStop({ channelId });
  return { success: true, message: `Ringing indication stopped on channel ${channelId}.`, statusCode: 200 };
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

async function playChannel({ channelId, media, lang }) {
  if (!media) return { success: false, message: 'media is mandatory (e.g. "sound:hello-world", "digits:1234", "tone:ring").', statusCode: 400 };
  const playback = await ari.channels.play({ channelId, media, lang });
  return { success: true, message: { playbackId: playback.id, media }, statusCode: 201 };
}

async function fetchRtpStats(channelId) {
  const rtpDetails = await ari.channels.rtpstatistics({ channelId: channelId });
  return { success: true, message: rtpDetails, statusCode: 200 };
}

async function recordChannel({ channelId, name, format, maxDurationSeconds, maxSilenceSeconds, ifExists, beep, terminateOn }) {
  if (!name) return { success: false, message: 'name is mandatory (the recording filename).', statusCode: 400 };
  if (!VALID_RECORDING_NAME.test(name)) return { success: false, message: 'name may only contain letters, numbers, ".", "_" and "-" (no spaces or other symbols).', statusCode: 400 };
  if (!['wav', 'ulaw', 'gsm'].includes(format)) return { success: false, message: 'Invalid format to record audio.', statusCode: 404 };
  if (!format) return { success: false, message: 'format is mandatory (e.g. "wav", "ulaw", "gsm").', statusCode: 400 };

  const recording = await ari.channels.record({
    channelId,
    name,
    format,
    maxDurationSeconds,
    maxSilenceSeconds,
    ifExists,
    beep,
    terminateOn,
  });

  return { success: true, message: { name: recording.name, format: recording.format, target_uri: recording.target_uri, state: recording.state }, statusCode: 201 };
}

async function reserveChannel({ appArgs } = {}) {
  const channel = await ari.channels.create({
    endpoint: `${config.trunkTech}/${config.trunkName}`,
    app: config.appName,
    appArgs,
  });
  return { success: true, message: toPlainChannel(channel), statusCode: 201 };
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
  progress: progressChannel,
  ringStop: ringStopChannel,
  hold: holdChannel,
  unhold: unholdChannel,
  mute: muteChannel,
  unmute: unmuteChannel,
  startMoh: startMohChannel,
  stopMoh: stopMohChannel,
  play: playChannel,
  record: recordChannel,
  transfer: transferChannel,
};

const dtmfResponses = {
  '1': 'sound:hello-world',
  '2': 'digits:2',
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
      const rtpStatistics = req.query.rtpStatistics || false;
      if (rtpStatistics) return fetchRtpStats(channelId);
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

      if (body.mode === 'reserve') {
        return await reserveChannel(body);
      }

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

  async handleDtmf({ channelId, digit }) {
    if (digit === '#') {
      try {
        await ari.channels.hangup({ channelId });
        return { success: true, message: `Channel ${channelId} hung up ("#" pressed).`, statusCode: 200 };
      } catch (err) {
        return { success: false, message: err.message, statusCode: 500 };
      }
    }

    const media = dtmfResponses[digit];
    if (!media) {
      return { success: false, message: `No response mapped to digit "${digit}".`, statusCode: 400 };
    }

    try {
      return await playChannel({ channelId, media });
    } catch (err) {
      return { success: false, message: err.message, statusCode: 500 };
    }
  },

};

connect().then(r => ({}));

module.exports = ChannelsService;