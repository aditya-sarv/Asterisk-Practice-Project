const CHANNEL_TYPES = ['Created', 'Originated', 'Inbound'];
const TYPE_PIPELINE = 'channels-type-validation';

// Rejects any document whose "type" is not one of CHANNEL_TYPES, even when written directly to ES (Kibana, curl...).
const pipeline = {
  id: TYPE_PIPELINE,
  description: `Reject channel documents whose type is not one of: ${CHANNEL_TYPES.join(', ')}`,
  processors: [
    {
      fail: {
        if: `ctx.type == null || !${JSON.stringify(CHANNEL_TYPES)}.contains(ctx.type)`,
        message: `type must be one of ${CHANNEL_TYPES.join(', ')} (got "{{{type}}}")`,
      },
    },
  ],
};

module.exports = {
  name: 'channels',
  CHANNEL_TYPES,
  pipeline,
  settings: { default_pipeline: TYPE_PIPELINE },
  mappings: {
    dynamic: 'strict',
    properties: {
      channelId: { type: 'keyword' },
      type: { type: 'keyword' },
      time: { type: 'date', format: 'epoch_millis', index: false },
      createdBy: { type: 'keyword', index: false },
      trunk: { type: 'keyword', index: false },
      state: { type: 'keyword' },
      name: { type: 'keyword' },
      destination: { type: 'keyword' },
      caller: { type: 'keyword' },
      hangupCause: { type: 'keyword' },
      updatedAt: { type: 'date', format: 'epoch_millis', index: false },
      endTime: { type: 'date', format: 'epoch_millis', index: false },
    },
  },
};
