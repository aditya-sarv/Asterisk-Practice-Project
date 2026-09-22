const express = require('express');
const config = require('./src/config');
const { getClient, startApp, disconnect } = require('./src/ariConnection');
const { router } = require('./src/routes');
const ChannelsService = require('./src/services/channels.service');

async function main() {
  await getClient();
  const ari = await startApp();

  ari.on('StasisStart', async (event, channel) => {
    console.log(`[ari] StasisStart: channel ${channel.name} (${channel.id}), state=${channel.state}`);
    if (channel.state === 'Down') {
      console.log(`[ari] channel ${channel.id} is Down (not dialed yet) - skipping auto-answer`);
      return;
    }

    try {
      await channel.answer();
      console.log(`[ari] channel ${channel.id} answered`);
    } catch (err) {
      console.error(`[ari] failed to answer channel ${channel.id}:`, err && err.message ? err.message : err);
    }
  });

  ari.on('ChannelDtmfReceived', async (event, channel) => {
    const digit = event.digit;
    console.log(`[ari] ChannelDtmfReceived: channel ${channel.id} pressed "${digit}"`);

    const result = await ChannelsService.handleDtmf({ channelId: channel.id, digit });
    if (result.success) {
      console.log(`[ari] DTMF "${digit}" on channel ${channel.id}: ${JSON.stringify(result.message)}`);
    } else {
      console.warn(`[ari] DTMF "${digit}" on channel ${channel.id} failed:`, result.message);
    }
  });

  const app = express();
  app.use(express.json());
  app.use('/api', router);

  app.use((err, req, res, next) => {
    if (err && err.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Request body is not valid JSON' });
    }
    return next(err);
  });

  const server = app.listen(config.port, () => {
    console.log(`[api] HTTP API listening on http://localhost:${config.port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[api] port ${config.port} is already in use — change PORT in .env`);
    } else {
      console.error('[api] HTTP server error:', err.message);
    }
    process.exit(1);
  });

  let closing = false;
  const shutdown = async (signal) => {
    if (closing) {
      return;
    }
    closing = true;
    console.log(`\n[ari] received ${signal}, shutting down...`);
    server.close();
    await disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('[ari] fatal:', err && err.message ? err.message : err);
  process.exit(1);
});
