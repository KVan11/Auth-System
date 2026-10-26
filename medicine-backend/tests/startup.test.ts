import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MedicineConfig } from '../src/config.js';
import type { MedicineDb } from '../src/db.js';
import { databaseUnavailable } from '../src/errors.js';

const signalListeners = () => process.listenerCount('SIGINT') + process.listenerCount('SIGTERM');
const listenersBeforeImport = signalListeners();

const { startServer } = await import('../src/index.js');

// Cổng 0: hệ điều hành tự chọn cổng trống
const config: MedicineConfig = {
  databaseUrl: 'postgresql://unused@localhost/medicine',
  port: 0,
  frontendOrigin: 'http://localhost:5173',
};

const createFakeDb = (checkConnection: () => Promise<void> = async () => {}) => ({
  checkConnection: vi.fn(checkConnection),
  close: vi.fn(async () => {}),
}) satisfies MedicineDb;

const running: { close(): Promise<void> }[] = [];

afterEach(async () => {
  await Promise.all(running.splice(0).map((server) => server.close()));
  vi.restoreAllMocks();
});

describe('startServer', () => {
  it('does not start listening or register signal handlers on import', () => {
    expect(signalListeners()).toBe(listenersBeforeImport);
  });

  it('listens and serves the status endpoint', async () => {
    const db = createFakeDb();
    const server = await startServer({ config, db });
    running.push(server);

    const res = await fetch(`http://127.0.0.1:${server.port}/api/medicine/status`);

    expect(server.port).toBeGreaterThan(0);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok', database: 'connected' });
    expect(db.checkConnection).toHaveBeenCalledTimes(1);
  });

  it('keeps running and reports a safe failure when the database is unavailable', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const db = createFakeDb(async () => {
      throw databaseUnavailable(new Error('password authentication failed'));
    });
    const server = await startServer({ config, db });
    running.push(server);

    const res = await fetch(`http://127.0.0.1:${server.port}/api/medicine/status`);

    expect(res.status).toBe(503);
    expect((await res.json()).error.code).toBe('MEDICINE_DB_UNAVAILABLE');
  });

  it('stops listening and closes the database pool on shutdown', async () => {
    const db = createFakeDb();
    const server = await startServer({ config, db });
    const url = `http://127.0.0.1:${server.port}/api/medicine/status`;
    expect((await fetch(url)).status).toBe(200);

    await server.close();
    await server.close();

    expect(db.close).toHaveBeenCalledTimes(1);
    await expect(fetch(url)).rejects.toThrow();
  });

  it('rejects when the port is already in use', async () => {
    const first = await startServer({ config, db: createFakeDb() });
    running.push(first);

    await expect(
      startServer({ config: { ...config, port: first.port }, db: createFakeDb() })
    ).rejects.toMatchObject({ code: 'EADDRINUSE' });
  });
});
