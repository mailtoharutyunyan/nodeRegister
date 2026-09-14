import { Schema, model, type InferSchemaType } from 'mongoose';

/**
 * The 2019 schema signed `{ role: user.role }` into every JWT, but had no
 * `role` field — so it was always `undefined` and the RBAC branch in the auth
 * middleware was dead code. `role` is a real, defaulted, enumerated field now.
 */
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },

    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 32,
    },

    email: {
      type: String,
      required: true,
      unique: true, // was neither unique nor required in 2019
      lowercase: true,
      trim: true,
    },

    // `select: false` keeps the hash out of every query result unless asked for
    // explicitly, so it can never be serialised into a response by accident.
    password: { type: String, required: true, select: false },

    role: { type: String, enum: ['user', 'admin'], default: 'user', required: true },

    profilePicture: { type: String },
    phone: { type: String },
    address: { type: String },

    isDisabled: { type: Boolean, default: false },
    lastLoginAt: { type: Date },
  },
  {
    versionKey: false,
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, unknown>) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.password;
        return ret;
      },
    },
  },
);

export type User = InferSchemaType<typeof UserSchema>;

export const UserModel = model('User', UserSchema);

// Derived from the model rather than hand-built with HydratedDocument<> so it
// stays exactly what `findOne`/`create` actually return.
export type UserDocument = InstanceType<typeof UserModel>;

/** The shape the API is allowed to return. Built explicitly, never spread from the document. */
export interface PublicUser {
  id: string;
  name: string;
  username: string;
  email: string;
  role: 'user' | 'admin';
}

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user._id.toString(),
    name: user.name,
    username: user.username,
    email: user.email,
    role: user.role as 'user' | 'admin',
  };
}
