import type { Request, Response } from 'express';
import * as authService from './auth.service.js';
import type { LoginInput, RefreshInput, RegisterInput } from './auth.schema.js';

/**
 * Controllers do one job: call the service and shape the HTTP response.
 *
 * No try/catch. Express 5 forwards a rejected promise from an async handler to
 * the error middleware automatically, so `errorHandler` is the single place
 * errors become responses.
 */

export async function register(req: Request, res: Response): Promise<void> {
  const result = await authService.register(req.body as RegisterInput);
  res.status(201).json({ data: result });
}

export async function login(req: Request, res: Response): Promise<void> {
  const result = await authService.login(req.body as LoginInput);
  res.status(200).json({ data: result });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as RefreshInput;
  const result = await authService.refresh(refreshToken);
  res.status(200).json({ data: result });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const { refreshToken } = req.body as RefreshInput;
  await authService.logout(refreshToken);
  res.status(204).send();
}

export async function logoutAll(req: Request, res: Response): Promise<void> {
  await authService.logoutAll(req.user!.id);
  res.status(204).send();
}

export async function me(req: Request, res: Response): Promise<void> {
  const user = await authService.getProfile(req.user!.id);
  res.status(200).json({ data: user });
}
