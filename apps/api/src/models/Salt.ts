import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';

const saltSchema = new Schema(
  {
    /** UTC day, 'YYYY-MM-DD'. */
    day: { type: String, required: true },
    /** 32 random bytes, hex. Deleted after 2 days by the cleanup-salts cron. */
    value: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

saltSchema.index({ day: 1 }, { unique: true });

export type SaltDoc = InferSchemaType<typeof saltSchema>;
export const Salt = (models['Salt'] as Model<SaltDoc> | undefined) ?? model('Salt', saltSchema);
