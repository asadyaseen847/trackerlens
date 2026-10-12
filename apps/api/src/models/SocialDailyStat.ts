import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';

const socialDailyStatSchema = new Schema(
  {
    socialAccountId: { type: Schema.Types.ObjectId, ref: 'SocialAccount', required: true },
    /** 'YYYY-MM-DD' in the platform's reporting day. */
    day: { type: String, required: true },
    followers: { type: Number },
    views: { type: Number },
    engagements: { type: Number },
    linkClicks: { type: Number },
  },
  { versionKey: false },
);

socialDailyStatSchema.index({ socialAccountId: 1, day: 1 }, { unique: true });

export type SocialDailyStatDoc = InferSchemaType<typeof socialDailyStatSchema>;
export const SocialDailyStat =
  (models['SocialDailyStat'] as Model<SocialDailyStatDoc> | undefined) ??
  model('SocialDailyStat', socialDailyStatSchema);
