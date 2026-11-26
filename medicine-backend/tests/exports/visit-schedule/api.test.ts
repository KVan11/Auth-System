import ExcelJS from 'exceljs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../../../src/app.js';
import { createJwtIdentityVerifier } from '../../../src/auth/identity.js';
import { defaultPythonCommand } from '../../../src/config.js';
import { subjectNotFound } from '../../../src/errors.js';
import { createVisitScheduleRepository } from '../../../src/modules/exports/visit-schedule/repository.js';
import { createVisitScheduleExport } from '../../../src/modules/exports/visit-schedule/excel.js';
import type { SearchService } from '../../../src/modules/search/types.js';

// Test API xuất lịch hẹn VS-01 (contracts/exports/visit-schedule.md), chỉ ADMIN

const SECRET = 'shared-test-secret';
const FRONTEND_ORIGIN = 'http://localhost:5173';
const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const PATH = '/api/medicine/subjects/20/exports/visit-schedule';
const PYTHON = process.env.MEDICINE_PYTHON?.trim() || defaultPythonCommand();
const tokenFor = (role: string) => `Bearer ${jwt.sign({ userId: 7, role, permissions: [] }, SECRET, { expiresIn: '15m' })}`;
const ADMIN = tokenFor('ADMIN');

const SCHEDULE_ROWS = [
  { tableName: 'SVC-01', rowId: 1, tuan: 'Sàng lọc', ngayThucTe: '2026-01-05', ngayHenTiep: '2026-01-20' },
  { tableName: 'SVC-04', rowId: 2, tuan: 'Tuần 2', ngayThucTe: '2026-02-03', ngayHenTiep: null },
];

let search: { listSubjects: ReturnType<typeof vi.fn>; getSubject: ReturnType<typeof vi.fn> };
let pool: { query: ReturnType<typeof vi.fn> };

const buildApp = (visitSchedule = createVisitScheduleExport({ repository: createVisitScheduleRepository(pool), python: PYTHON })) =>
  createApp({
    checkDatabase: async () => {},
    verifyIdentity: createJwtIdentityVerifier(SECRET),
    frontendOrigin: FRONTEND_ORIGIN,
    search: search as unknown as SearchService,
    visitSchedule,
  });

// supertest: nhận nội dung nhị phân
const binary = (res: request.Response, done: (error: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: Buffer) => chunks.push(chunk));
  res.on('end', () => done(null, Buffer.concat(chunks)));
};

beforeEach(() => {
  search = {
    listSubjects: vi.fn(),
    getSubject: vi.fn(async (subjectRef: string) => ({ subjectRef, ptid: '1000001A' })),
  };
  pool = { query: vi.fn(async (..._args: unknown[]) => ({ rows: SCHEDULE_ROWS })) };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('GET /api/medicine/subjects/:subjectRef/exports/visit-schedule', () => {
  it('returns the filled .xlsx as an attachment for an ADMIN', async () => {
    const res = await request(buildApp()).get(PATH).set('Authorization', ADMIN).buffer(true).parse(binary);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(XLSX);
    expect(res.headers['content-disposition']).toBe('attachment; filename="A5409_VS_01_VisitSchedule.xlsx"');
    expect(res.headers['cache-control']).toBe('no-store');

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(res.body as ArrayBuffer);
    const sheet = workbook.getWorksheet('Visit Schedule')!;
    expect(sheet.getCell('A2').value).toBe('PTID:  1000001A');
    expect(sheet.getCell('G6').value).toEqual(new Date('2026-01-05T00:00:00.000Z'));
    expect(sheet.getCell('F7').value).toEqual(new Date('2026-01-20T00:00:00.000Z'));
    expect(sheet.getCell('G9').value).toEqual(new Date('2026-02-03T00:00:00.000Z'));
  });

  it('resolves the PTID on the server and passes it to one fixed query as a parameter', async () => {
    await request(buildApp()).get(`${PATH}?ptid=9999999Z&sql=DROP`).set('Authorization', ADMIN);

    expect(search.getSubject).toHaveBeenCalledWith('20');
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0]!;
    expect(sql).toContain('FROM "ScheduleView"');
    expect(sql).not.toContain('DROP');
    expect(params).toEqual(['1000001A']);
  });

  it('still generates a file with only the PTID when the subject has no schedule rows', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const res = await request(buildApp()).get(PATH).set('Authorization', ADMIN).buffer(true).parse(binary);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe(XLSX);
  });

  it('does not query the schedule for a subject without PTID', async () => {
    search.getSubject.mockResolvedValue({ subjectRef: '20', ptid: null });

    const res = await request(buildApp()).get(PATH).set('Authorization', ADMIN).buffer(true).parse(binary);

    expect(res.status).toBe(200);
    expect(pool.query).not.toHaveBeenCalled();
    expect(res.headers['content-disposition']).toBe('attachment; filename="A5409_VS_01_VisitSchedule.xlsx"');
  });

  it('never puts the PTID in the file name', async () => {
    search.getSubject.mockResolvedValue({ subjectRef: '20', ptid: ' 10"0\r\n8h ' });

    const res = await request(buildApp()).get(PATH).set('Authorization', ADMIN);

    expect(res.headers['content-disposition']).toBe('attachment; filename="A5409_VS_01_VisitSchedule.xlsx"');
  });

  it('lets the frontend origin read the file name header', async () => {
    const res = await request(buildApp()).get(PATH).set('Authorization', ADMIN).set('Origin', FRONTEND_ORIGIN);

    expect(res.headers['access-control-expose-headers']).toMatch(/content-disposition/i);
  });

  it.each([
    ['USER', tokenFor('USER'), 403],
    ['GUEST', tokenFor('GUEST'), 403],
    ['no token', undefined, 401],
  ])('refuses %s before touching data', async (_label, header, status) => {
    const req = request(buildApp()).get(PATH);
    const res = await (header ? req.set('Authorization', header) : req);

    expect(res.status).toBe(status);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(search.getSubject).not.toHaveBeenCalled();
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns 404 for an unknown or out-of-scope subject', async () => {
    search.getSubject.mockRejectedValue(subjectNotFound());

    const res = await request(buildApp()).get(PATH).set('Authorization', ADMIN);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('MEDICINE_SUBJECT_NOT_FOUND');
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('reports a database failure as 503 JSON, not a file', async () => {
    pool.query.mockRejectedValue(Object.assign(new Error('connect ECONNREFUSED db.internal'), { code: 'ECONNREFUSED' }));

    const res = await request(buildApp()).get(PATH).set('Authorization', ADMIN);

    expect(res.status).toBe(503);
    expect(res.body).toEqual({
      error: { code: 'MEDICINE_DB_UNAVAILABLE', message: 'Không kết nối được cơ sở dữ liệu Medicine.' },
    });
    expect(res.text).not.toMatch(/db\.internal|ECONNREFUSED/);
  });

  it('reports a generation failure (missing template) as 500 JSON without a file', async () => {
    const app = buildApp(
      createVisitScheduleExport({
        repository: createVisitScheduleRepository(pool),
        python: PYTHON,
        templatePath: 'templates/khong-ton-tai.xlsx',
      })
    );

    const res = await request(app).get(PATH).set('Authorization', ADMIN);

    expect(res.status).toBe(500);
    expect(res.headers['content-disposition']).toBeUndefined();
    expect(res.body).toEqual({ error: { code: 'MEDICINE_EXPORT_FAILED', message: 'Không tạo được file Excel.' } });
  });

  it('offers no other export path or method', async () => {
    for (const [method, path] of [
      ['post', PATH],
      ['get', '/api/medicine/subjects/20/exports/lab'],
      ['get', '/api/medicine/exports/visit-schedule'],
    ] as const) {
      const res = await request(buildApp())[method](path).set('Authorization', ADMIN);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
  });
});
