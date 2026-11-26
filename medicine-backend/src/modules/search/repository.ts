// SQL tìm bệnh nhân. Giá trị luôn truyền qua $1, không ghép chuỗi (tránh SQL injection).

import type { Queryable } from '../../db.js';
import { databaseUnavailable } from '../../errors.js';
import type { SearchRepository, SubjectRecord, SubjectRow } from './types.js';

// Bệnh nhân đang dùng (giống qryUsingPTIDs của Access)
const IN_SCOPE = `(s."BelongTo" = 'A5409' OR s."BelongTo" IS NULL) AND s."IsUse" = true`;

// Ngày sinh đổi sang giờ Việt Nam ngay trong SQL
const LIST_SUBJECTS = `
  SELECT s."ID" AS id,
         s."PTID" AS ptid,
         d."Ten" AS ten,
         to_char(d."NgaySinh" AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS "ngaySinh"
  FROM "PTIDStore_g" s
  LEFT JOIN "DEM-02a" d ON d."PTID" = s."PTID"
  WHERE ${IN_SCOPE}
  ORDER BY s."PTID" COLLATE "C", s."ID", d."ID"`;

const FIND_SUBJECT = `
  SELECT s."ID" AS id, s."PTID" AS ptid
  FROM "PTIDStore_g" s
  WHERE s."ID" = $1 AND ${IN_SCOPE}`;

export const createSearchRepository = (db: Queryable): SearchRepository => ({
  async listSubjects() {
    try {
      const result = await db.query(LIST_SUBJECTS);
      return result.rows as SubjectRow[];
    } catch (error) {
      throw databaseUnavailable(error);
    }
  },

  async findSubject(id) {
    try {
      const result = await db.query(FIND_SUBJECT, [id]);
      const record = result.rows[0] as SubjectRecord | undefined;
      return record ?? null;
    } catch (error) {
      throw databaseUnavailable(error);
    }
  },
});
