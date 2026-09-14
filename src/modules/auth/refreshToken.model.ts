import type { Types} from 'mongoose';
import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * One row per issued refresh token. Stores only the SHA-256 hash.
 *
 * This table is what gives the service a real logout and real revocation —
 * the thing the 2019 `status: 0` flag pretended to do.
 */
const RefreshTokenSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
  },
  { versionKey: false, timestamps: true },
);

// Mongo removes expired rows on its own; no cleanup job to forget about.
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshToken = InferSchemaType<typeof RefreshTokenSchema>;

export const RefreshTokenModel = model('RefreshToken', RefreshTokenSchema);

export type RefreshTokenDocument = InstanceType<typeof RefreshTokenModel>;

export type UserId = Types.ObjectId;
