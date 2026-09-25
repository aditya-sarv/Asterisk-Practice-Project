const { connectElasticsearch } = require('./connect-es');
const channelsIndex = require('./indexes/channels.index');

const INDEX = channelsIndex.name;
const { CHANNEL_TYPES } = channelsIndex;
const REQUIRED_FIELDS = ['channelId', 'type', 'time', 'trunk', 'state'];

function toEpochMillis(value) {
  const ms = typeof value === 'number' ? value : Date.parse(value);
  return Number.isNaN(ms) ? null : ms;
}

function trunkFromChannelName(name) {
  const resource = (name || '').split('/')[1] || '';
  return resource.replace(/-[0-9a-f]+$/i, '') || null;
}

function validate(doc) {
  const missing = REQUIRED_FIELDS.filter((field) => doc[field] === undefined || doc[field] === null || doc[field] === '');
  if (missing.length) return `missing mandatory field(s): ${missing.join(', ')}`;
  if (!CHANNEL_TYPES.includes(doc.type)) return `type must be one of ${CHANNEL_TYPES.join(', ')}`;
  return null;
}

// Writes for the same channel are chained so a late "Ringing" can never overwrite an earlier-applied "Up".
const queues = new Map();

function enqueue(channelId, task) {
  const previous = queues.get(channelId) || Promise.resolve();
  const next = previous.then(task, task);
  queues.set(channelId, next);
  next.finally(() => {
    if (queues.get(channelId) === next) queues.delete(channelId);
  });
  return next;
}

async function findDocId(channelId) {
  const es = await connectElasticsearch();
  const result = await es.search({
    index: INDEX,
    size: 1,
    _source: false,
    query: { term: { channelId } },
  });
  const hit = result.hits.hits[0];
  return hit ? hit._id : null;
}

async function exists(channelId) {
  return enqueue(channelId, async () => Boolean(await findDocId(channelId)));
}

async function insertChannel({ channel, type, trunk, destination = null, createdBy = null }) {
  const doc = {
    channelId: channel.id,
    type,
    time: toEpochMillis(channel.creationtime),
    createdBy,
    trunk: trunk || trunkFromChannelName(channel.name),
    state: channel.state,
    name: channel.name,
    destination: destination || (channel.dialplan && channel.dialplan.exten) || null,
    caller: (channel.caller && channel.caller.number) || null,
    updatedAt: Date.now(),
  };

  const error = validate(doc);
  if (error) throw new Error(`[es] channel ${channel.id} not saved: ${error}`);

  return enqueue(channel.id, async () => (await connectElasticsearch()).index({
    index: INDEX,
    document: doc,
    refresh: 'wait_for', // make it searchable before the next event for this channel looks it up
  }));
}

async function updateChannel(channelId, fields) {
  return enqueue(channelId, async () => {
    const id = await findDocId(channelId);
    if (!id) {
      console.warn(`[es] no document for channel ${channelId}; update skipped.`);
      return null;
    }
    return (await connectElasticsearch()).update({
      index: INDEX,
      id,
      doc: { ...fields, updatedAt: Date.now() },
      retry_on_conflict: 3,
    });
  });
}

module.exports = {
  CHANNEL_TYPES,
  toEpochMillis,
  exists,
  insertChannel,
  updateChannel,
};
