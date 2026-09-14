import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { UserModel } from '../src/modules/user/user.model.js';
import { RefreshTokenModel } from '../src/modules/auth/refreshToken.model.js';

const app = createApp();

const VALID_USER = {
  name: 'Arayik Harutyunyan',
  email: 'Arayik@Example.COM',
  username: 'Arayik',
  password: 'CorrectHorseBatteryStaple9',
};

async function registerUser(overrides: Partial<typeof VALID_USER> = {}) {
  return request(app).post('/auth/register').send({ ...VALID_USER, ...overrides });
}

describe('POST /auth/register', () => {
  it('creates a user and returns tokens', async () => {
    const res = await registerUser();

    expect(res.status).toBe(201);
    expect(res.body.data.user).toMatchObject({
      name: VALID_USER.name,
      username: 'arayik',
      email: 'arayik@example.com',
      role: 'user',
    });
    expect(res.body.data.accessToken).toEqual(expect.any(String));
    expect(res.body.data.refreshToken).toEqual(expect.any(String));
  });

  it('never returns the password hash', async () => {
    const res = await registerUser();
    expect(JSON.stringify(res.body)).not.toContain('$argon2');
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('stores an argon2id hash, not the plaintext', async () => {
    await registerUser();
    const user = await UserModel.findOne({ username: 'arayik' }).select('+password');
    expect(user!.password).toMatch(/^\$argon2id\$/);
    expect(user!.password).not.toContain(VALID_USER.password);
  });

  // 2019 bug: the duplicate-username validator resolved `false`, which
  // express-validator 5 read as a pass, so the raw Mongo E11000 escaped as a 500.
  it('rejects a duplicate username with 409, not 500', async () => {
    await registerUser();
    const res = await registerUser({ email: 'other@example.com' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
    expect(JSON.stringify(res.body)).not.toMatch(/E11000|duplicate key/i);
  });

  it('rejects a duplicate email with 409', async () => {
    await registerUser();
    const res = await registerUser({ username: 'different' });
    expect(res.status).toBe(409);
  });

  it.each([
    ['missing name', { name: '' }],
    ['invalid email', { email: 'not-an-email' }],
    ['short password', { password: 'short' }],
    ['short username', { username: 'ab' }],
    ['username with spaces', { username: 'has spaces' }],
  ])('rejects %s with 422', async (_label, override) => {
    const res = await registerUser(override as Partial<typeof VALID_USER>);
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // 2019 bug: `new User(req.body)` let the caller set any schema field.
  it('ignores role and isDisabled in the request body', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ ...VALID_USER, role: 'admin', isDisabled: true });

    expect(res.status).toBe(201);
    expect(res.body.data.user.role).toBe('user');

    const user = await UserModel.findOne({ username: 'arayik' });
    expect(user!.role).toBe('user');
    expect(user!.isDisabled).toBe(false);
  });
});

describe('POST /auth/login', () => {
  // The headline 2019 bug: register hashed `password.toLowerCase()` while login
  // compared the raw input, so any uppercase letter made login impossible.
  it('logs in with a password containing uppercase characters', async () => {
    await registerUser();

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'arayik', password: VALID_USER.password });

    expect(res.status).toBe(200);
    expect(res.body.data.accessToken).toEqual(expect.any(String));
  });

  it('rejects the lowercased form of a correct password', async () => {
    await registerUser();

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'arayik', password: VALID_USER.password.toLowerCase() });

    expect(res.status).toBe(401);
  });

  it('accepts the username case-insensitively', async () => {
    await registerUser();
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'ARAYIK', password: VALID_USER.password });
    expect(res.status).toBe(200);
  });

  // 2019 bug: 'Wrong username or password1' vs '...password2' leaked which
  // usernames existed, and both used 404 instead of 401.
  it('returns an identical 401 for unknown user and wrong password', async () => {
    await registerUser();

    const unknownUser = await request(app)
      .post('/auth/login')
      .send({ username: 'nobody', password: VALID_USER.password });

    const wrongPassword = await request(app)
      .post('/auth/login')
      .send({ username: 'arayik', password: 'WrongPassword123456' });

    expect(unknownUser.status).toBe(401);
    expect(wrongPassword.status).toBe(401);
    expect(unknownUser.body).toEqual(wrongPassword.body);
  });

  it('refuses a disabled account with the same generic 401', async () => {
    await registerUser();
    await UserModel.updateOne({ username: 'arayik' }, { isDisabled: true });

    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'arayik', password: VALID_USER.password });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe('Invalid username or password');
  });

  // 2019 bug: no validators on /auth/login, so an operator object reached
  // `username.toLowerCase()` and threw a 500.
  it('rejects an operator object in the username field with 422, not 500', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({ username: { $ne: null }, password: { $ne: null } });

    expect(res.status).toBe(422);
  });

  it('rejects a missing body with 422', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(422);
  });
});

describe('GET /auth/me', () => {
  it('returns the profile for a valid bearer token', async () => {
    const registered = await registerUser();

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${registered.body.data.accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.username).toBe('arayik');
  });

  it('rejects a missing token with 401', async () => {
    const res = await request(app).get('/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a tampered token with 401', async () => {
    const registered = await registerUser();
    const tampered = `${registered.body.data.accessToken.slice(0, -3)}aaa`;

    const res = await request(app).get('/auth/me').set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  // 2019 accepted `?token=`, which writes credentials into every access log.
  it('ignores a token supplied in the query string', async () => {
    const registered = await registerUser();
    const res = await request(app).get(`/auth/me?token=${registered.body.data.accessToken}`);
    expect(res.status).toBe(401);
  });

  it('rejects an alg=none token', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: '507f1f77bcf86cd799439011', role: 'admin' })).toString('base64url');

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${header}.${payload}.`);

    expect(res.status).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('exchanges a refresh token for a new pair', async () => {
    const registered = await registerUser();
    const original = registered.body.data.refreshToken;

    const res = await request(app).post('/auth/refresh').send({ refreshToken: original });

    expect(res.status).toBe(200);
    expect(res.body.data.refreshToken).not.toBe(original);
  });

  it('revokes the old token on rotation', async () => {
    const registered = await registerUser();
    const original = registered.body.data.refreshToken;

    await request(app).post('/auth/refresh').send({ refreshToken: original });
    const replay = await request(app).post('/auth/refresh').send({ refreshToken: original });

    expect(replay.status).toBe(401);
  });

  it('revokes every session when a used token is replayed', async () => {
    const registered = await registerUser();
    const original = registered.body.data.refreshToken;

    const rotated = await request(app).post('/auth/refresh').send({ refreshToken: original });
    await request(app).post('/auth/refresh').send({ refreshToken: original }); // replay

    const afterBreach = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: rotated.body.data.refreshToken });

    expect(afterBreach.status).toBe(401);
  });

  it('rejects an unknown refresh token with 401', async () => {
    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'not-a-real-token' });
    expect(res.status).toBe(401);
  });
});

describe('POST /auth/logout', () => {
  // 2019 logout set `status: 0` and the 24h JWT stayed fully valid. Here the
  // refresh token is actually dead afterwards.
  it('makes the refresh token unusable', async () => {
    const registered = await registerUser();
    const token = registered.body.data.refreshToken;

    const logout = await request(app).post('/auth/logout').send({ refreshToken: token });
    expect(logout.status).toBe(204);

    const afterLogout = await request(app).post('/auth/refresh').send({ refreshToken: token });
    expect(afterLogout.status).toBe(401);
  });

  it('is idempotent and does not leak whether the token existed', async () => {
    const first = await request(app).post('/auth/logout').send({ refreshToken: 'never-existed' });
    expect(first.status).toBe(204);
  });

  // 2019 bug: when the user was not found, logout sent no response at all and
  // the request hung until the socket timed out.
  it('always responds, even for an unknown token', async () => {
    const res = await request(app).post('/auth/logout').send({ refreshToken: 'unknown' });
    expect(res.status).toBe(204);
  });

  it('logout-all revokes every outstanding refresh token', async () => {
    const registered = await registerUser();
    const second = await request(app)
      .post('/auth/login')
      .send({ username: 'arayik', password: VALID_USER.password });

    const res = await request(app)
      .post('/auth/logout-all')
      .set('Authorization', `Bearer ${registered.body.data.accessToken}`);

    expect(res.status).toBe(204);

    const outstanding = await RefreshTokenModel.countDocuments({ revokedAt: null });
    expect(outstanding).toBe(0);

    const reuse = await request(app)
      .post('/auth/refresh')
      .send({ refreshToken: second.body.data.refreshToken });
    expect(reuse.status).toBe(401);
  });
});

describe('infrastructure', () => {
  it('reports health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.db).toBe('connected');
  });

  it('returns a structured 404 for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for malformed JSON', async () => {
    const res = await request(app)
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username": ');

    expect(res.status).toBe(400);
  });

  it('does not advertise Express via x-powered-by', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('sets helmet security headers', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
