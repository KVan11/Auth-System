import type { Queryable } from '../../db.js';
import { databaseUnavailable } from '../../errors.js';
import type { SearchRepository, SubjectRecord, SubjectRow } from './types.js';

// Bệnh nhân đang dùng (giống query PTIDStore, qryUsingPTIDs của Access)
const IN_SCOPE = `(s."BelongTo" = 'A5409' OR s."BelongTo" IS NULL) AND s."IsUse" = true`;

// Toàn bộ danh sách; ngày sinh đổi sang ngày theo giờ Việt Nam ngay trong SQL
const LIST_SUBJECTS = `
  SELECT s."ID" AS id,
         s."PTID" AS ptid,
         d."Ten" AS ten,
         to_char(d."NgaySinh" AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS "ngaySinh"
  FROM "PTIDStore_g" s
  LEFT JOIN "DEM-02a" d ON d."PTID" = s."PTID"
  WHERE ${IN_SCOPE}
  ORDER BY s."PTID" COLLATE "C", s."ID", d."ID"`;

// Một bệnh nhân theo ID
const FIND_SUBJECT = `
  SELECT s."ID" AS id, s."PTID" AS ptid
  FROM "PTIDStore_g" s
  WHERE s."ID" = $1 AND ${IN_SCOPE}`;

const run = async <T>(db: Queryable, text: string, values?: unknown[]) => {
  try {
    const { rows } = await (values ? db.query(text, values) : db.query(text));
    return rows as T[];
  } catch (error) {
    // Ẩn lỗi gốc của driver
    throw databaseUnavailable(error);
  }
};

export const createSearchRepository = (db: Queryable): SearchRepository => ({
  listSubjects: () => run<SubjectRow>(db, LIST_SUBJECTS),

  async findSubject(id) {
    const rows = await run<SubjectRecord>(db, FIND_SUBJECT, [id]);
    return rows[0] ?? null;
  },
});
