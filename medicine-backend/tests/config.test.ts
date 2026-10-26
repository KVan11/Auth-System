import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from '../src/config.js';

const VALID_URL = 'postgresql://medicine_user:S3cretPass@db.example.test:5432/medicine';

const expectConfigError = (env: Record<string, string | undefined>, secret?: string) => {
  let error: unknown;
  try {
    loadConfig(env);
  } catch (caught) {
    error = caught;
  }
  expect(error).toBeInstanceOf(ConfigError);
  const message = (error as Error).message;
  if (secret) expect(message).not.toContain(secret);
  return message;
};

describe('loadConfig', () => {
  it('reads Medicine-only settings', () => {
    expect(
      loadConfig({
        MEDICINE_DATABASE_URL: VALID_URL,
        MEDICINE_PORT: '4100',
        MEDICINE_FRONTEND_ORIGIN: 'http://localhost:5174',
      })
    ).toEqual({
      databaseUrl: VALID_URL,
      port: 4100,
      frontendOrigin: 'http://localhost:5174',
    });
  });

  it('uses non-secret development defaults for port and frontend origin', () => {
    expect(loadConfig({ MEDICINE_DATABASE_URL: VALID_URL })).toEqual({
      databaseUrl: VALID_URL,
      port: 3001,
      frontendOrigin: 'http://localhost:5173',
    });
  });

  it('accepts the postgres:// scheme', () => {
    const url = 'postgres://u:p@localhost/medicine';
    expect(loadConfig({ MEDICINE_DATABASE_URL: url }).databaseUrl).toBe(url);
  });

  it('requires MEDICINE_DATABASE_URL and has no fallback connection', () => {
    expect(expectConfigError({})).toContain('MEDICINE_DATABASE_URL');
    expect(expectConfigError({ MEDICINE_DATABASE_URL: '   ' })).toContain('MEDICINE_DATABASE_URL');
  });

  it('does not require or reuse Auth settings', () => {
    // Không cần JWT_SECRET hay DATABASE_URL của Auth
    expect(() => loadConfig({ MEDICINE_DATABASE_URL: VALID_URL })).not.toThrow();

    // DATABASE_URL của Auth không được dùng thay cho MEDICINE_DATABASE_URL
    expectConfigError({ DATABASE_URL: VALID_URL, JWT_SECRET: 'auth-secret' });
  });

  it('rejects an invalid database URL without revealing it', () => {
    const message = expectConfigError(
      { MEDICINE_DATABASE_URL: 'mysql://root:TopSecret99@db.internal/medicine' },
      'TopSecret99'
    );
    expect(message).not.toContain('db.internal');
    expectConfigError({ MEDICINE_DATABASE_URL: 'not a url with :Hidden1 inside' }, 'Hidden1');
  });

  it.each(['abc', '0', '-1', '65536', '3001.5', ''])('rejects invalid MEDICINE_PORT %j', (port) => {
    expect(expectConfigError({ MEDICINE_DATABASE_URL: VALID_URL, MEDICINE_PORT: port })).toContain(
      'MEDICINE_PORT'
    );
  });

  it.each(['not-a-url', 'ftp://localhost:5173', 'http://localhost:5173/medicine', '*'])(
    'rejects invalid MEDICINE_FRONTEND_ORIGIN %j',
    (origin) => {
      expect(
        expectConfigError({ MEDICINE_DATABASE_URL: VALID_URL, MEDICINE_FRONTEND_ORIGIN: origin })
      ).toContain('MEDICINE_FRONTEND_ORIGIN');
    }
  );
});
