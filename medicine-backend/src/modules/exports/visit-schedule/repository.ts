// SQL lấy lịch hẹn của một bệnh nhân cho file Excel VS-01.

import type { Queryable } from '../../../db.js';
import { databaseUnavailable } from '../../../errors.js';

// Gửi nguyên dạng JSON sang Python. Ngày dạng 'YYYY-MM-DD' hoặc null.
export interface ScheduleRow {
  tableName: string;
  rowId: number;
  tuan: string | null;
  ngayThucTe: string | null;
  ngayHenTiep: string | null;
}

const LIST_SCHEDULE = `
  SELECT "TableName" AS "tableName",
         "RowID" AS "rowId",
         "Tuan" AS tuan,
         to_char("Ngay_ThucTe" AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS "ngayThucTe",
         to_char("Q_HenTiep_Ngay" AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD') AS "ngayHenTiep"
  FROM "ScheduleView"
  WHERE "PTID" = $1 AND "TableName" IN ('SVC-01', 'SVC-02', 'SVC-04')
  ORDER BY "TableName", "RowID"`;

export interface VisitScheduleRepository {
  listScheduleRows(ptid: string): Promise<ScheduleRow[]>;
}

export const createVisitScheduleRepository = (db: Queryable): VisitScheduleRepository => ({
  async listScheduleRows(ptid) {
    try {
      const result = await db.query(LIST_SCHEDULE, [ptid]);
      return result.rows as ScheduleRow[];
    } catch (error) {
      throw databaseUnavailable(error);
    }
  },
});
