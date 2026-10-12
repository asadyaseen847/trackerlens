import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';
import { CHANNEL_VALUES, DEVICE_VALUES } from './Session.js';

/** Time-series collection: timeField 'ts', metaField 'meta' (§5). */
const pageviewSchema = new Schema(
  {
    ts: { type: Date, required: true },
    meta: {
      siteId: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
    },
    sessionId: { type: Schema.Types.ObjectId, ref: 'Session', required: true },
    path: { type: String, required: true },
    channel: { type: String, enum: CHANNEL_VALUES, required: true },
    platform: { type: String, required: true },
    country: { type: String, required: true },
    device: { type: String, enum: DEVICE_VALUES, required: true },
  },
  {
    versionKey: false,
    timeseries: { timeField: 'ts', metaField: 'meta', granularity: 'minutes' },
    autoCreate: true,
  },
);

pageviewSchema.index({ 'meta.siteId': 1, ts: 1 });

export type PageviewDoc = InferSchemaType<typeof pageviewSchema>;
export const Pageview =
  (models['Pageview'] as Model<PageviewDoc> | undefined) ?? model('Pageview', pageviewSchema);
