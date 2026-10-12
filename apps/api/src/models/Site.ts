import { model, models, Schema, type InferSchemaType, type Model } from 'mongoose';

const siteSchema = new Schema(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    /** "shop.example.com": no protocol, no www. */
    domain: { type: String, required: true, lowercase: true, trim: true },
    /** Public id used in the snippet, e.g. "ws_7Q2K9X". */
    siteKey: { type: String, required: true },
    settings: {
      includeSubdomains: { type: Boolean, default: false },
      paused: { type: Boolean, default: false },
      allowLocalhost: { type: Boolean, default: false },
    },
    firstEventAt: { type: Date },
    lastEventAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

siteSchema.index({ siteKey: 1 }, { unique: true });
siteSchema.index({ workspaceId: 1, domain: 1 }, { unique: true });

export type SiteDoc = InferSchemaType<typeof siteSchema>;
export const Site = (models['Site'] as Model<SiteDoc> | undefined) ?? model('Site', siteSchema);
