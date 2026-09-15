const ariClient = require('ari-client');
const config = require('./config');

let clientPromise = null;

function registerWebSocketListeners(ari) {
  ari.on('WebSocketConnected', () => {
    console.log('[ari] event WebSocket connected');
  });

  ari.on('WebSocketError', (err) => {
    console.error('[ari] event WebSocket error:', err && err.message ? err.message : err);
  });

  ari.on('WebSocketReconnecting', () => {
    console.warn('[ari] event WebSocket reconnecting...');
  });

  ari.on('WebSocketMaxRetries', () => {
    console.error('[ari] event WebSocket gave up after max reconnect attempts');
  });
}

function getClient(settings = config) {
  if (!clientPromise) {
    clientPromise = ariClient
      .connect(settings.url, settings.username, settings.password)
      .then(async (ari) => {
        const systemInfo = ari.sarvpbx;
        if (systemInfo) {
          const info = await systemInfo.getInfo();
          console.log(`[ari] connected to Asterisk: ${info.system.version} ` + `(entity id ${info.system.entity_id})`);
        } else {
          console.log('[ari] connected (server exposes no sarvpbx info resource)');
        }
        return ari;
      })
      .catch((err) => {
        clientPromise = null; // allow a fresh attempt next time
        throw err;
      });

    console.log(`[ari] connecting to ${settings.url} as "${settings.username}"...`);
  }

  return clientPromise;
}

async function startApp(appName = config.appName, eventSource = config.eventSource) {
  const ari = await getClient();
  registerWebSocketListeners(ari);
  await ari.start(appName);
  console.log(`[ari] Stasis application "${appName}" registered`);

  if (eventSource) {
    const ApplicationsService = require('./services/application.service');
    const result = await ApplicationsService.create({
      body: { applicationName: appName, eventSource },
    });

    if (result && result.success) {
      console.log(`[ari] subscribed "${appName}" to event source(s): ${eventSource}`);
    } else {
      console.warn(
        `[ari] could not subscribe "${appName}" to "${eventSource}":`,
        result && result.message ? result.message : 'unknown error'
      );
    }
  }

  return ari;
}

async function disconnect() {
  if (!clientPromise) {
    return;
  }

  try {
    const ari = await clientPromise;
    await ari.stop(); // closes the WebSocket and unregisters the Stasis app
    console.log('[ari] disconnected');
  } catch (err) {
    console.error('[ari] error during disconnect:', err && err.message ? err.message : err);
  } finally {
    clientPromise = null;
  }
}

module.exports = { getClient, startApp, disconnect };
