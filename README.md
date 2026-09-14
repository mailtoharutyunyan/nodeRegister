# nodeRegister

A JWT authentication service in TypeScript — Express 5, Mongoose 9, argon2id, refresh-token rotation.

Originally written in 2019 as an intern project. Rebuilt in 2026 against the same feature set, so the two versions can be read side by side. The `master` history before this rewrite is the original.

## Stack

| | |
|---|---|
| Runtime | Node 22+ |
| Language | TypeScript 6 (ESM, strict) |
| HTTP | Express 5 |
| Database | MongoDB via Mongoose 9 |
| Passwords | argon2id |
| Tokens | JWT access (15 min) + rotating opaque refresh (7 days) |
| Validation | Zod 4 |
| Tests | Vitest + supertest + mongodb-memory-server |

## Running it

```bash
npm install
cp .env.example .env      # then fill in the secrets
openssl rand -hex 32      # run twice, one per JWT secret
npm run dev
```

```bash
npm test          # 36 tests, real in-memory MongoDB
npm run typecheck
npm run lint
npm run build && npm start
```

Docker:

```bash
docker build -t node-register . && docker run -p 3002:3002 --env-file .env node-register
```

## API

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `POST` | `/auth/register` | — | Create account, returns token pair |
| `POST` | `/auth/login` | — | Returns token pair |
| `POST` | `/auth/refresh` | refresh token | Rotate: old token is revoked, new pair issued |
| `POST` | `/auth/logout` | refresh token | Revoke that refresh token |
| `POST` | `/auth/logout-all` | bearer | Revoke every session for the user |
| `GET` | `/auth/me` | bearer | Current profile |
| `GET` | `/health` | — | Liveness + DB state |

Success is `{ "data": ... }`; failure is `{ "error": { "code", "message", "details?" } }`.

Access tokens go in `Authorization: Bearer <token>`. Header only — never a query parameter.

## Layout

```
src/
  config/env.ts            Zod-validated environment, parsed once at boot
  app.ts                   Builds the app (no listen — so tests can drive it)
  server.ts                Listen, DB connect, graceful shutdown
  lib/                     AppError, argon2 wrapper, JWT + refresh tokens, logger
  middleware/              validate, authenticate, rateLimit, errorHandler
  modules/auth/            routes → controller → service, schema, refresh model
  modules/user/            user model
tests/                     End-to-end through supertest
```

The rule the layout enforces: **services return values or throw `AppError`; only `errorHandler` turns anything into an HTTP response.** The 2019 version passed a response handler down into the service layer, which is why nothing there could be tested in isolation.

## What changed from 2019, and why

Every item below was a real defect in the original, not a style preference.

### Bugs

- **Login was impossible with an uppercase password.** Register hashed `password.toLowerCase()`; login compared the raw input. Passwords are now byte-for-byte — normalising one breaks comparison and discards entropy.
- **The duplicate-username check never ran.** Its async validator returned `false`, but express-validator 5 only fails on a *rejected* promise, so it always passed. The raw Mongo `E11000` then escaped to the client as a 500. Uniqueness is a DB index now, mapped to a 409.
- **`/auth/login` had no validation at all.** `ValidationResult` was mounted with no `check()` chain before it, so it was a no-op — `{"username":{"$ne":null}}` reached `.toLowerCase()` and threw a 500.
- **Logout hung the request** when the user was not found: no branch sent a response, so the socket stayed open until timeout.
- **`role` did not exist.** Every JWT was signed with `role: undefined`, making the RBAC branch in the auth middleware dead code. `role` is a real enumerated field with a working `requireRole` guard.

### Security

- Secrets were committed: a live MongoDB password in `config/keys.js` and the JWT signing secret in `config/auth.js`. All config is environment-only, validated at boot, and `.env` is gitignored.
- Error messages `'Wrong username or password1'` and `'...password2'` let anyone enumerate valid usernames. One generic 401 now, with a dummy argon2 verify so the timing matches too.
- `bcrypt-nodejs` was abandoned by its author in 2017 → argon2id.
- `jwt.verify` was called with `null` options → `algorithms` is pinned.
- Tokens were accepted from `req.query.token`, which writes credentials into access and proxy logs → `Authorization` header only.
- `new User(req.body)` was mass assignment → Zod strips unknown keys and the service lists fields explicitly.
- No rate limiting on login → global limiter plus a stricter one on `/auth/register` and `/auth/login`.
- No `helmet`, no CORS policy, no body size limit → all present.
- Logout revoked nothing; the 24-hour JWT stayed valid. Access tokens are 15 minutes, and refresh tokens are revocable, rotating, and stored only as SHA-256 hashes. Replaying a used one revokes the whole family.

### Correctness

- Failed auth returned 404 and validation errors returned 403. Now 401 and 422.
- Four body parsers were registered (`express.json` + `bodyParser.json`, and both urlencoded). Express has had these built in since 4.16.
- `UserService` swallowed errors into `console.log` and returned `undefined`, so callers could not distinguish "not found" from "database down".
- No 404 handler and no error middleware, so anything thrown outside a `try` hit Express's default HTML stack-trace page.
- Port was hardcoded; no `process.env.PORT`, no graceful shutdown, no `unhandledRejection` handler.

### Tooling

- CI ran `npm test` with no `test` script, so it could only ever fail — and there were no tests. 36 now, covering each bug above as a regression test.
- CI targeted Node 8/10/12, all EOL, on deprecated action versions. Now Node 22/24 with lint, typecheck, test, build, and `npm audit`.
- `npm start` called `nodemon`, which was not in `devDependencies`.
- `"body-parser": "latest"` made builds non-reproducible.
- No `.gitignore`, no linter, no `engines`, no Dockerfile, no health check.

## Note on history

The 2019 credentials are still reachable in commits before this rewrite. The mLab cluster they pointed at was shut down in 2020, and the password has been rotated. Left in place deliberately rather than rewriting public history.

## Licence

ISC
