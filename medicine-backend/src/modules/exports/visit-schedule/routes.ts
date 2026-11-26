import { Router } from 'express';
import { requireAccess } from '../../../auth/access.js';
import type { VerifyIdentity } from '../../../auth/identity.js';
import type { SearchService } from '../../search/types.js';
import type { VisitScheduleExport } from './excel.js';

const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const FILE_NAME = 'A5409_VS_01_VisitSchedule.xlsx';

export const createVisitScheduleRouter = ({
  verifyIdentity,
  search,
  visitSchedule,
}: {
  verifyIdentity: VerifyIdentity;
  search: SearchService;
  visitSchedule: VisitScheduleExport;
}) => {
  const router = Router();

  router.get(
    '/subjects/:subjectRef/exports/visit-schedule',
    requireAccess(verifyIdentity, 'export.visitSchedule'),
    async (req, res) => {
      // PTID lấy từ database
      const { subjectRef } = req.params;
      const subject = await search.getSubject(typeof subjectRef === 'string' ? subjectRef : '');
      const file = await visitSchedule(subject.ptid);

      res.set({
        'Content-Type': XLSX_CONTENT_TYPE,
        'Content-Disposition': `attachment; filename="${FILE_NAME}"`,
        'Cache-Control': 'no-store',
      });
      res.send(file);
    }
  );

  return router;
};
