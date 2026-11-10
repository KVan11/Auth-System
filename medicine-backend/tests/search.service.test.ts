import { describe, expect, it, vi } from 'vitest';
import { AppError, databaseUnavailable } from '../src/errors.js';
import { createSearchService } from '../src/modules/search/service.js';
import type { SearchRepository, SubjectRecord, SubjectRow } from '../src/modules/search/types.js';

// Test service với repository giả

const createRepository = (
  rows: SubjectRow[] = [],
  record: SubjectRecord | null = null
): SearchRepository & { listSubjects: ReturnType<typeof vi.fn>; findSubject: ReturnType<typeof vi.fn> } => ({
  listSubjects: vi.fn(async () => rows),
  findSubject: vi.fn(async () => record),
});

const errorOf = (promise: Promise<unknown>) =>
  promise.then(
    () => {
      throw new Error('expected rejection');
    },
    (error: unknown) => error as AppError
  );

describe('search service: listSubjects', () => {
  it('maps each row to a candidate with a string subjectRef and the stored values unchanged', async () => {
    const repository = createRepository([
      { id: 25, ptid: ' 1000008h ', ten: null, ngaySinh: null },
      { id: 20, ptid: '1000001A', ten: 'Nguyễn Văn A', ngaySinh: '1990-05-12' },
      { id: 29, ptid: '1000011K', ten: 'Lê Văn K (1)', ngaySinh: '2001-01-31' },
      { id: 29, ptid: '1000011K', ten: 'Lê Văn K (2)', ngaySinh: null },
      { id: 26, ptid: null, ten: null, ngaySinh: null },
    ]);

    const items = await createSearchService(repository).listSubjects();

    // Giữ nguyên thứ tự và giá trị, không gộp dòng trùng
    expect(items).toEqual([
      { subjectRef: '25', ptid: ' 1000008h ', ten: null, ngaySinh: null },
      { subjectRef: '20', ptid: '1000001A', ten: 'Nguyễn Văn A', ngaySinh: '1990-05-12' },
      { subjectRef: '29', ptid: '1000011K', ten: 'Lê Văn K (1)', ngaySinh: '2001-01-31' },
      { subjectRef: '29', ptid: '1000011K', ten: 'Lê Văn K (2)', ngaySinh: null },
      { subjectRef: '26', ptid: null, ten: null, ngaySinh: null },
    ]);
    expect(repository.listSubjects).toHaveBeenCalledWith();
  });

  it('returns an empty list as a successful result', async () => {
    await expect(createSearchService(createRepository([])).listSubjects()).resolves.toEqual([]);
  });

  it('never turns a retrieval failure into an empty list', async () => {
    const repository = createRepository();
    repository.listSubjects.mockRejectedValue(databaseUnavailable(new Error('connection refused')));

    const error = await errorOf(createSearchService(repository).listSubjects());

    expect(error).toMatchObject({ status: 503, code: 'MEDICINE_DB_UNAVAILABLE' });
  });

  it('returns only the approved candidate fields', async () => {
    const extra = { id: 1, ptid: '1000001A', ten: 'A', ngaySinh: null, DienThoai: '0900000000' } as SubjectRow;

    const [item] = await createSearchService(createRepository([extra])).listSubjects();

    expect(Object.keys(item!).sort()).toEqual(['ngaySinh', 'ptid', 'subjectRef', 'ten']);
  });
});

describe('search service: getSubject', () => {
  it('returns the selected subject overview (PTID only) for a valid reference', async () => {
    const repository = createRepository([], { id: 17, ptid: '1234567A' });

    await expect(createSearchService(repository).getSubject('17')).resolves.toEqual({
      subjectRef: '17',
      ptid: '1234567A',
    });
    expect(repository.findSubject).toHaveBeenCalledWith(17);
  });

  it('accepts the largest PostgreSQL integer', async () => {
    const repository = createRepository([], { id: 2147483647, ptid: null });

    await expect(createSearchService(repository).getSubject('2147483647')).resolves.toEqual({
      subjectRef: '2147483647',
      ptid: null,
    });
    expect(repository.findSubject).toHaveBeenCalledWith(2147483647);
  });

  it.each([
    '',
    '0',
    '017',
    '-1',
    '+1',
    '1.5',
    '1e3',
    '0x11',
    ' 17',
    '17 ',
    'abc',
    '17abc',
    '2147483648',
    '99999999999',
    '١٧',
    "1 OR 1=1",
  ])('responds "not found" for malformed reference %j without querying', async (subjectRef) => {
    const repository = createRepository([], { id: 1, ptid: 'x' });

    const error = await errorOf(createSearchService(repository).getSubject(subjectRef));

    expect(error).toBeInstanceOf(AppError);
    expect(error).toMatchObject({ status: 404, code: 'MEDICINE_SUBJECT_NOT_FOUND', message: 'Không tìm thấy bệnh nhân.' });
    expect(repository.findSubject).not.toHaveBeenCalled();
  });

  it('responds "not found" when the row is missing or no longer in scope', async () => {
    const repository = createRepository([], null);

    const error = await errorOf(createSearchService(repository).getSubject('30'));

    expect(error).toMatchObject({ status: 404, code: 'MEDICINE_SUBJECT_NOT_FOUND' });
    expect(repository.findSubject).toHaveBeenCalledWith(30);
  });

  it('propagates a retrieval failure instead of reporting "not found"', async () => {
    const repository = createRepository();
    repository.findSubject.mockRejectedValue(databaseUnavailable(new Error('timeout')));

    const error = await errorOf(createSearchService(repository).getSubject('17'));

    expect(error).toMatchObject({ status: 503, code: 'MEDICINE_DB_UNAVAILABLE' });
  });
});
