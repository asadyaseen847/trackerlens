import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';

export const SOCIAL_PLATFORM_VALUES = [
  'instagram',
  'facebook',
  'youtube',
  'linkedin',
  'tiktok',
  'x',
] as const;

const socialAccountSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    platform: { type: String, enum: SOCIAL_PLATFORM_VALUES, required: true },
    externalId: { type: String, required: true },
    handle: { type: String, required: true },
    name: { type: String, required: true },
    avatarUrl: { type: String },
    /** Encrypted with AES-256-GCM using ENCRYPTION_KEY (§13). */
    tokens: {
      accessTokenEnc: { type: String, required: true },
      refreshTokenEnc: { type: String },
      expiresAt: { type: Date },
    },
    scopes: { type: [String], default: [] },
    status: {
      type: String,
      enum: ['connected', 'needs_reconnect', 'disconnected'],
      required: true,
      default: 'connected',
    },
    lastSyncedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

socialAccountSchema.index({ workspaceId: 1, platform: 1, externalId: 1 }, { unique: true });

export type SocialAccountDoc = InferSchemaType<typeof socialAccountSchema>;
export const SocialAccount =
  (models['SocialAccount'] as Model<SocialAccountDoc> | undefined) ??
  model('SocialAccount', socialAccountSchema);
