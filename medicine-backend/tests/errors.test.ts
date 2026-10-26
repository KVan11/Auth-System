import { describe, expect, it } from 'vitest';
import { AppError, databaseUnavailable, notFound, toErrorResponse } from '../src/errors.js';

// Lỗi giống lỗi thật của driver pg: chứa user, host, mã lỗi và stack
const rawPgError = () =>
  Object.assign(
    new Error('password authentication failed for user "medicine_user" at db.internal:5432'),
    { code: '28P01', detail: 'postgresql://medicine_user:S3cret@db.internal/medicine' }
  );

const SENSITIVE = ['medicine_user', 'db.internal', 'S3cret', '28P01', 'password', 'at '];

const expectSafe = (body: unknown) => {
  const text = JSON.stringify(body);
  for (const value of SENSITIVE) expect(text).not.toContain(value);
  expect(Object.keys(body as object)).toEqual(['error']);
  expect(Object.keys((body as { error: object }).error).sort()).toEqual(['code', 'message']);
};

describe('toErrorResponse', () => {
  it('translates a controlled AppError', () => {
    expect(toErrorResponse(new AppError(418, 'TEAPOT', 'Thông báo an toàn'))).toEqual({
      status: 418,
      body: { error: { code: 'TEAPOT', message: 'Thông báo an toàn' } },
    });
  });

  it('reports Medicine database unavailability as a safe 503', () => {
    const response = toErrorResponse(databaseUnavailable(rawPgError()));

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('MEDICINE_DB_UNAVAILABLE');
    expectSafe(response.body);
  });

  it('reports unknown routes as 404', () => {
    const response = toErrorResponse(notFound());

    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it.each([
    ['raw database error', rawPgError()],
    ['plain error', new Error('connect ECONNREFUSED 10.0.0.5:5432 password=S3cret')],
    ['string', 'postgresql://medicine_user:S3cret@db.internal/medicine'],
    ['null', null],
    ['undefined', undefined],
  ])('hides details of an unexpected %s behind a generic 500', (_label, error) => {
    const response = toErrorResponse(error);

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expectSafe(response.body);
  });
});
