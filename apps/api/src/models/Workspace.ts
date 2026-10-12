import { DEFAULT_RETENTION_MONTHS } from '@audience/shared';
import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';

const memberSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['owner', 'member'], required: true },
  },
  { _id: false },
);

const workspaceSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    /** IANA timezone, e.g. "Asia/Karachi". */
    timezone: { type: String, required: true, default: 'UTC' },
    members: { type: [memberSchema], default: [] },
    /** Raw data retention; enforced by the Phase 6 retention cron (§5). */
    retentionMonths: { type: Number, default: DEFAULT_RETENTION_MONTHS, min: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

workspaceSchema.index({ 'members.userId': 1 });

export type WorkspaceDoc = InferSchemaType<typeof workspaceSchema>;
export const Workspace =
  (models['Workspace'] as Model<WorkspaceDoc> | undefined) ?? model('Workspace', workspaceSchema);
