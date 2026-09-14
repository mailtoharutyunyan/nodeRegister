import { z } from 'zod';

/**
 * Request validation.
 *
 * Three 2019 problems are closed here:
 *
 *  1. The register validator's async uniqueness check returned `false` instead
 *     of throwing, and express-validator 5 treated a resolved promise as a
 *     pass — so the duplicate-username check silently never ran. Uniqueness is
 *     enforced by the database's unique index now, and the service maps the
 *     resulting E11000 to a 409. Validation that fails open is worse than none.
 *
 *  2. `/auth/login` had no validators at all. Posting `{"username":{"$ne":null}}`
 *     made `username.toLowerCase()` throw and returned a 500.
 *
 *  3. `new User(req.body)` was mass assignment. These schemas strip unknown
 *     keys, so the request body cannot reach `role` or `isDisabled`.
 */

const username = z
  .string()
  .trim()
  .min(3, 'Username must be at least 3 characters')
  .max(32, 'Username must be at most 32 characters')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'Username may only contain letters, numbers, dot, dash, underscore')
  .toLowerCase();

// The 2019 message said "at least 6 characters" while the code checked `> 3`.
// One source of truth now.
const password = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .max(128, 'Password must be at most 128 characters');

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120),
  email: z.email('Invalid email address').toLowerCase(),
  username,
  password,
});

export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required').toLowerCase(),
  password: z.string().min(1, 'Password is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1, 'refreshToken is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
