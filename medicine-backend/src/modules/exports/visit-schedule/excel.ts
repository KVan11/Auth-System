// Tạo file Excel lịch hẹn: Node lấy dữ liệu, Python điền mẫu

import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportFailed } from '../../../errors.js';
import { shellExecAsync } from '../../../shell/shellExec.js';
import type { VisitScheduleRepository } from './repository.js';

export const VISIT_SCHEDULE_SCRIPT = fileURLToPath(new URL('../../../../python/visit_schedule.py', import.meta.url));
export const VISIT_SCHEDULE_TEMPLATE = fileURLToPath(
  new URL('../../../../templates/A5409_VS_01_VisitSchedule.xlsx', import.meta.url)
);
const TIMEOUT_MS = 30_000;

export const createVisitScheduleExport = ({
  repository,
  python,
  templatePath = VISIT_SCHEDULE_TEMPLATE,
  scriptPath = VISIT_SCHEDULE_SCRIPT,
  timeoutMs = TIMEOUT_MS,
  tempRoot = tmpdir(),
}: {
  repository: VisitScheduleRepository;
  python: string; // lệnh chạy Python, xem config.ts
  templatePath?: string;
  scriptPath?: string;
  timeoutMs?: number;
  tempRoot?: string;
}) => {
  // ptid = null: trả file mẫu trống
  return async (ptid: string | null): Promise<Buffer> => {
    // Nằm ngoài try để lỗi database vẫn là 503
    const rows = ptid === null ? [] : await repository.listScheduleRows(ptid);

    // Thư mục tạm riêng cho mỗi request
    const dir = await mkdtemp(join(tempRoot, 'medicine-vs01-'));
    try {
      const output = join(dir, 'VisitSchedule.xlsx');
      // Dữ liệu gửi qua stdin, không ghép PTID vào câu lệnh
      await shellExecAsync(python, [scriptPath, '--template', templatePath, '--output', output], {
        input: JSON.stringify({ ptid, rows }),
        timeoutMs,
      });
      return await readFile(output);
    } catch (error) {
      throw exportFailed(error);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };
};

export type VisitScheduleExport = ReturnType<typeof createVisitScheduleExport>;
