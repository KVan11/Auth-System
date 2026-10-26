import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getJwtSecret } from '../lib/jwtSecret.js';
import { verifyToken } from '../middlewares/auth.middleware.js';

const ORIGINAL_SECRET = process.env.JWT_SECRET;

const buildApp = () => {
  const app = express();
  app.get('/protected', verifyToken, (_req, res) => {
    res.json({ ok: true });
  });
  return app;
};

beforeEach(() => {
  process.env.JWT_SECRET = 'configured-secret';
});

afterEach(() => {
  if (ORIGINAL_SECRET === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = ORIGINAL_SECRET;
  vi.restoreAllMocks();
});

describe('getJwtSecret', () => {
  it('returns the configured secret', () => {
    expect(getJwtSecret()).toBe('configured-secret');
  });

  it.each([undefined, '', '   '])('throws instead of falling back to a default secret (%j)', (value) => {
    if (value === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = value;

    expect(() => getJwtSecret()).toThrow('JWT_SECRET');
  });
});

describe('verifyToken without the old default secret', () => {
  it('rejects a token signed with the former hard-coded secret', async () => {
    const forged = jwt.sign({ userId: 1, role: 'admin', permissions: [] }, 'secret_key');

    const res = await request(buildApp()).get('/protected').set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(401);
  });

  it('accepts a token signed with the configured secret', async () => {
    const token = jwt.sign({ userId: 1, role: 'user', permissions: [] }, 'configured-secret');

    const res = await request(buildApp()).get('/protected').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
  });

  it('fails as a server error, never accepting the token, when JWT_SECRET is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const forged = jwt.sign({ userId: 1, role: 'admin', permissions: [] }, 'secret_key');
    delete process.env.JWT_SECRET;

    const res = await request(buildApp()).get('/protected').set('Authorization', `Bearer ${forged}`);

    expect(res.status).toBe(500);
    expect(res.body).not.toEqual({ ok: true });
  });
});
