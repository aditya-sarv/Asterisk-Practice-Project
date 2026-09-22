const fs = require('fs');
const path = require('path');
const config = require('../config');
const { getClient } = require('../ariConnection');

let ari;

async function connect() {
  ari = await getClient();
}

const RECORDINGS_DIR = path.resolve(__dirname, '../../storage/recordings');

function toPlainRecording(recording) {
  return {
    name: recording.name,
    format: recording.format,
    state: recording.state,
    target_uri: recording.target_uri,
    duration: recording.duration,
    talking_duration: recording.talking_duration,
    silence_duration: recording.silence_duration,
    cause: recording.cause,
  };
}

async function downloadStoredFile(recordingName) {
  const recording = await ari.recordings.getStored({ recordingName });
  const format = recording.format || 'wav';

  const auth = Buffer.from(`${config.username}:${config.password}`).toString('base64');
  const response = await fetch(`${config.url}/ari/recordings/stored/${encodeURIComponent(recordingName)}/file`, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!response.ok) {
    const err = new Error(`Failed to fetch recording file (HTTP ${response.status}).`);
    err.status = response.status === 404 ? 404 : 500;
    throw err;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

  const fileName = `${recordingName}.${format}`;
  const filePath = path.join(RECORDINGS_DIR, fileName);
  fs.writeFileSync(filePath, buffer);

  return { filePath, fileName };
}

const liveActions = {
  stop: ({ recordingName }) => ari.recordings.stop({ recordingName }),
  pause: ({ recordingName }) => ari.recordings.pause({ recordingName }),
  unpause: ({ recordingName }) => ari.recordings.unpause({ recordingName }),
  mute: ({ recordingName }) => ari.recordings.mute({ recordingName }),
  unmute: ({ recordingName }) => ari.recordings.unmute({ recordingName }),
  cancel: ({ recordingName }) => ari.recordings.cancel({ recordingName }),
};

const RecordingsService = {

  async getAll() {
    try {
      const recordings = await ari.recordings.listStored();
      return { success: true, message: recordings.map(toPlainRecording), statusCode: 200 };
    } catch (err) {
      return { success: false, message: err.message, statusCode: 500 };
    }
  },

  async getOne(req) {
    try {
      const recordingName = req.query.recordingName;
      if (!recordingName) return { success: false, message: 'recordingName is mandatory.', statusCode: 400 };

      if (req.query.type === 'live') {
        const recording = await ari.recordings.getLive({ recordingName });
        return { success: true, message: toPlainRecording(recording), statusCode: 200 };
      }

      const recording = await ari.recordings.getStored({ recordingName });
      return { success: true, message: toPlainRecording(recording), statusCode: 200 };
    } catch (err) {
      return { success: false, message: err.message, statusCode: err.status || 500 };
    }
  },

  async download(req) {
    try {
      const recordingName = req.query.recordingName;
      if (!recordingName) return { success: false, message: 'recordingName is mandatory.', statusCode: 400 };

      const { filePath, fileName } = await downloadStoredFile(recordingName);
      return { success: true, filePath, fileName, statusCode: 200 };
    } catch (err) {
      return { success: false, message: err.message, statusCode: err.status || 500 };
    }
  },

  async update(req) {
    const recordingName = req.query.recordingName;
    if (!recordingName) return { success: false, message: 'recordingName is mandatory.', statusCode: 400 };

    const body = req.body || {};
    const action = body.action;

    try {
      if (action === 'copy') {
        if (!body.destinationRecordingName) return { success: false, message: 'destinationRecordingName is mandatory for "copy".', statusCode: 400 };
        const copy = await ari.recordings.copyStored({ recordingName, destinationRecordingName: body.destinationRecordingName });
        return { success: true, message: toPlainRecording(copy), statusCode: 201 };
      }

      const handler = liveActions[action];
      if (!handler) return { success: false, message: `Unknown action "${action}". Expected one of: ${Object.keys(liveActions).join(', ')}, copy`, statusCode: 400 };

      await handler({ recordingName });
      return { success: true, message: `Recording ${recordingName}: ${action} applied.`, statusCode: 200 };
    } catch (err) {
      return { success: false, message: err.message, statusCode: 500 };
    }
  },

  async remove(req) {
    try {
      const recordingName = req.query.recordingName;
      if (!recordingName) return { success: false, message: 'recordingName is mandatory.', statusCode: 400 };

      if (req.query.type === 'live') {
        await ari.recordings.cancel({ recordingName });
        return { success: true, message: `Live recording ${recordingName} cancelled.`, statusCode: 200 };
      }

      await ari.recordings.deleteStored({ recordingName });
      return { success: true, message: `Stored recording ${recordingName} deleted.`, statusCode: 200 };
    } catch (err) {
      return { success: false, message: err.message, statusCode: 500 };
    }
  },

};

connect().then(r => ({}));

module.exports = RecordingsService;
