import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authLimiter } from '../../middleware/rateLimit.js';
import { loginSchema, refreshSchema, registerSchema } from './auth.schema.js';
import * as authController from './auth.controller.js';

export const authRouter = Router();

// Every mutating endpoint gets a schema. In 2019, `/auth/login` was wired to a
// `ValidationResult` middleware with no `check()` chain in front of it, which
// made it a no-op — the route accepted any body at all.
authRouter.post('/register', authLimiter, validate(registerSchema), authController.register);
authRouter.post('/login', authLimiter, validate(loginSchema), authController.login);
authRouter.post('/refresh', validate(refreshSchema), authController.refresh);
authRouter.post('/logout', validate(refreshSchema), authController.logout);

authRouter.post('/logout-all', authenticate, authController.logoutAll);
authRouter.get('/me', authenticate, authController.me);
