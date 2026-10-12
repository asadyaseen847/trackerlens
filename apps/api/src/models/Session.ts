import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';

export const CHANNEL_VALUES = ['social', 'search', 'email', 'ai', 'direct', 'other'] as const;
export const DEVICE_VALUES = ['phone', 'tablet', 'desktop'] as const;

/** One visit: 30 minutes without activity ends it (§9). Never stores the IP or full user agent. */
const sessionSchema = new Schema(
  {
    siteId: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
    visitorHash: { type: String, required: true },
    startedAt: { type: Date, required: true },
    lastSeenAt: { type: Date, required: true },
    pageviews: { type: Number, required: true, default: 1 },
    entryPath: { type: String, required: true },
    exitPath: { type: String, required: true },
    channel: { type: String, enum: CHANNEL_VALUES, required: true },
    /** e.g. 'instagram', 'google', or a referrer host. */
    platform: { type: String, required: true },
    isPaid: { type: Boolean, default: false },
    referrerHost: { type: String },
    utm: {
      source: { type: String },
      medium: { type: String },
      campaign: { type: String },
      term: { type: String },
      content: { type: String },
    },
    /** ISO-2 or 'XX'. */
    country: { type: String, required: true, default: 'XX' },
    device: { type: String, enum: DEVICE_VALUES, required: true },
    browser: { type: String },
    os: { type: String },
  },
  { versionKey: false },
);

sessionSchema.index({ siteId: 1, startedAt: 1 });
sessionSchema.index({ siteId: 1, visitorHash: 1, lastSeenAt: -1 });
sessionSchema.index({ siteId: 1, lastSeenAt: -1 });

export type SessionDoc = InferSchemaType<typeof sessionSchema>;
export const Session =
  (models['Session'] as Model<SessionDoc> | undefined) ?? model('Session', sessionSchema);
