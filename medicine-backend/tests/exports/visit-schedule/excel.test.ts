import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it, vi } from 'vitest';
import { defaultPythonCommand } from '../../../src/config.js';
import { AppError } from '../../../src/errors.js';
import { createVisitScheduleExport } from '../../../src/modules/exports/visit-schedule/excel.js';
import type { ScheduleRow } from '../../../src/modules/exports/visit-schedule/repository.js';

// Node gọi lõi Python thật. Quy tắc điền ô và độ giữ nguyên mẫu
// được test kỹ ở python/test_visit_schedule.py; ở đây kiểm tra đường nối Node vs Python.

const PYTHON = process.env.MEDICINE_PYTHON?.trim() || defaultPythonCommand();
const SHEET = 'Visit Schedule';
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const exportWith = (
  rows: ScheduleRow[],
  options: { python?: string; templatePath?: string; scriptPath?: string; tempRoot?: string } = {}
) => {
  const repository = { listScheduleRows: vi.fn(async (_ptid: string) => rows) };
  return { repository, generate: createVisitScheduleExport({ repository, python: PYTHON, ...options }) };
};

const load = async (buffer: Buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  return workbook.getWorksheet(SHEET)!;
};

describe('createVisitScheduleExport (Node → Python)', () => {
  it('sends the PTID rows to Python and returns the filled template', async () => {
    const { repository, generate } = exportWith([
      { tableName: 'SVC-01', rowId: 1, tuan: 'Sàng lọc', ngayThucTe: '2026-05-20', ngayHenTiep: '2026-05-22' },
      { tableName: 'SVC-04', rowId: 2, tuan: 'Tuần 2', ngayThucTe: '2026-06-03', ngayHenTiep: null },
    ]);

    const sheet = await load(await generate('3144213F'));

    expect(repository.listScheduleRows).toHaveBeenCalledWith('3144213F');
    expect(sheet.getCell('A2').value).toBe('PTID:  3144213F');
    expect(sheet.getCell('G6').value).toEqual(day('2026-05-20'));
    expect(sheet.getCell('F7').value).toEqual(day('2026-05-22'));
    expect(sheet.getCell('G9').value).toEqual(day('2026-06-03'));
    expect(sheet.getCell('G9').numFmt).toBe('mm-dd-yy');
    // Kết quả công thức được tính sẵn (Protected View vẫn hiện đúng như Access)
    expect(sheet.getCell('D7').value).toMatchObject({ formula: 'C6+30', result: day('2026-06-19') });
    // Ghi chú của người thiết kế trong mẫu vẫn còn
    expect(sheet.getCell('G6').note).toBeDefined();
  });

  it('keeps Vietnamese text intact through stdin', async () => {
    const { generate } = exportWith([]);

    const sheet = await load(await generate('Mã-Đặc-Biệt'));

    expect(sheet.getCell('A2').value).toBe('PTID:  Mã-Đặc-Biệt');
  });

  it('does not query the schedule for a subject without PTID', async () => {
    const { repository, generate } = exportWith([]);

    const sheet = await load(await generate(null));

    expect(repository.listScheduleRows).not.toHaveBeenCalled();
    expect(sheet.getCell('A2').value).toBe('PTID:  ');
  });

  it.each([
    ['the template is missing', { templatePath: 'templates/khong-ton-tai.xlsx' }],
    ['Python is not installed', { python: 'khong-co-python-nay' }],
    ['the script is missing', { scriptPath: 'python/khong-ton-tai.py' }],
  ])('fails with a safe export error when %s', async (_label, options) => {
    const { generate } = exportWith([], options);

    const error = await generate('X').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 500, code: 'MEDICINE_EXPORT_FAILED', message: 'Không tạo được file Excel.' });
  });

  it('removes its temporary folder after success and failure', async () => {
    // Thư mục riêng để không lẫn với test khác chạy song song
    const tempRoot = await mkdtemp(join(tmpdir(), 'medicine-test-'));
    try {
      await exportWith([], { tempRoot }).generate('X');
      await exportWith([], { tempRoot, templatePath: 'templates/khong-ton-tai.xlsx' }).generate('X').catch(() => {});

      expect(await readdir(tempRoot)).toEqual([]);
    } finally {
      await rm(tempRoot, { recursive: true, force: true });
    }
  });

  it('lets a database error through unchanged (503, not an export error)', async () => {
    const dbError = new AppError(503, 'MEDICINE_DB_UNAVAILABLE', 'Không kết nối được cơ sở dữ liệu Medicine.');
    const repository = { listScheduleRows: vi.fn(async () => Promise.reject(dbError)) };

    await expect(createVisitScheduleExport({ repository, python: PYTHON })('X')).rejects.toBe(dbError);
  });
});
