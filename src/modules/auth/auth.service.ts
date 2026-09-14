import { ConflictError, NotFoundError, UnauthorizedError } from '../../lib/AppError.js';
import { getDummyHash, hashPassword, verifyPassword } from '../../lib/password.js';
import {
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
  type UserRole,
} from '../../lib/tokens.js';
import { toPublicUser, UserModel, type PublicUser } from '../user/user.model.js';
import { RefreshTokenModel } from './refreshToken.model.js';
import type { LoginInput, RegisterInput } from './auth.schema.js';

/**
 * The service layer returns values or throws AppError. It knows nothing about
 * Express.
 *
 * The 2019 version passed a `responseHandler` down from the controller into
 * every service method, so the service called `callback.onSuccess(...)` and
 * chose HTTP status codes itself. That made services impossible to unit test
 * without faking a response object, impossible to reuse from a job or a CLI,
 * and meant errors were handled twice — the controller's catch block was
 * unreachable because `register` swallowed its own errors first.
 */

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends AuthTokens {
  user: PublicUser;
}

/** Mongo's duplicate-key error, which we map to a 409 instead of leaking a 500. */
function isDuplicateKeyError(error: unknown): error is { code: number; keyPattern?: Record<string, unknown> } {
  return typeof error === 'object' && error !== null && 'code' in error && (error as { code: unknown }).code === 11000;
}

async function issueTokens(userId: string, role: UserRole): Promise<AuthTokens> {
  const accessToken = signAccessToken({ sub: userId, role });
  const refreshToken = generateRefreshToken();

  await RefreshTokenModel.create({
    userId,
    tokenHash: hashRefreshToken(refreshToken),
    expiresAt: refreshTokenExpiry(),
  });

  return { accessToken, refreshToken };
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const password = await hashPassword(input.password);

  try {
    // Fields are listed explicitly. `input` is already stripped by zod, but
    // being explicit here means adding a schema field can never silently
    // become writable through the API.
    const user = await UserModel.create({
      name: input.name,
      email: input.email,
      username: input.username,
      password,
    });

    const tokens = await issueTokens(user._id.toString(), user.role as UserRole);
    return { user: toPublicUser(user), ...tokens };
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      const field = Object.keys(error.keyPattern ?? {})[0] ?? 'field';
      throw new ConflictError(`That ${field} is already taken`);
    }
    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  // `password` is `select: false` on the schema, so ask for it explicitly.
  const user = await UserModel.findOne({ username: input.username }).select('+password');

  // One message, one status code, for every failure reason. The 2019 code
  // returned 'Wrong username or password1' when the user did not exist and
  // '...password2' when the password was wrong, which let anyone enumerate
  // valid usernames. The dummy verify keeps the timing even too.
  const invalid = new UnauthorizedError('Invalid username or password');

  if (!user) {
    await verifyPassword(await getDummyHash(), input.password);
    throw invalid;
  }

  const passwordMatches = await verifyPassword(user.password, input.password);
  if (!passwordMatches || user.isDisabled) {
    throw invalid;
  }

  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokens(user._id.toString(), user.role as UserRole);
  return { user: toPublicUser(user), ...tokens };
}

/**
 * Rotating refresh: the presented token is revoked and a new one issued.
 * If a token that was already used shows up again, that is a replay — every
 * token for the user is revoked and they have to log in again.
 */
export async function refresh(presentedToken: string): Promise<AuthResult> {
  const tokenHash = hashRefreshToken(presentedToken);
  const stored = await RefreshTokenModel.findOne({ tokenHash });

  if (!stored) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  if (stored.revokedAt) {
    await RefreshTokenModel.updateMany(
      { userId: stored.userId, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    throw new UnauthorizedError('Refresh token has been revoked');
  }

  if (stored.expiresAt.getTime() <= Date.now()) {
    throw new UnauthorizedError('Refresh token has expired');
  }

  const user = await UserModel.findById(stored.userId);
  if (!user || user.isDisabled) {
    throw new UnauthorizedError('Invalid refresh token');
  }

  const tokens = await issueTokens(user._id.toString(), user.role as UserRole);

  stored.revokedAt = new Date();
  stored.replacedByHash = hashRefreshToken(tokens.refreshToken);
  await stored.save();

  return { user: toPublicUser(user), ...tokens };
}

/**
 * Real logout: the refresh token is revoked server-side, so it cannot mint new
 * access tokens. The current access token still works until it expires — that
 * is why the access TTL is 15 minutes rather than the 2019 value of 24 hours.
 */
export async function logout(presentedToken: string): Promise<void> {
  await RefreshTokenModel.updateOne(
    { tokenHash: hashRefreshToken(presentedToken), revokedAt: null },
    { $set: { revokedAt: new Date() } },
  );
  // Deliberately no error when the token is unknown — logout is idempotent and
  // must not become another way to probe which tokens exist.
}

export async function logoutAll(userId: string): Promise<void> {
  await RefreshTokenModel.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await UserModel.findById(userId);
  if (!user || user.isDisabled) {
    throw new NotFoundError('User not found');
  }
  return toPublicUser(user);
}
