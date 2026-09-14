import argon2 from 'argon2';

/**
 * Password hashing.
 *
 * Two bugs from the 2019 version are fixed here by construction:
 *
 *  1. `bcrypt-nodejs` was abandoned by its author in 2017. Replaced with
 *     argon2id, the current password-hashing recommendation.
 *
 *  2. Register hashed `password.toLowerCase()` while login compared the raw
 *     password, so any password containing an uppercase letter could never log
 *     in. Passwords are byte-for-byte here — never normalise a password, it
 *     both breaks comparison and throws away entropy.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // 19 MiB — OWASP minimum for argon2id
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    // A malformed or truncated hash in the DB must read as "wrong password",
    // not as a 500 that tells the caller the record exists.
    return false;
  }
}

/**
 * A real argon2id hash of a value nobody can supply. Login verifies against
 * this when the username does not exist, so the "no such user" and "wrong
 * password" paths take roughly the same wall-clock time and cannot be
 * distinguished by timing.
 */
let dummyHashPromise: Promise<string> | null = null;

export function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword('nonexistent-user-timing-equaliser');
  return dummyHashPromise;
}
