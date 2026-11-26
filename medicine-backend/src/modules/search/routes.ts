// GET /subjects: danh sách bệnh nhân. GET /subjects/:subjectRef: tổng quan một bệnh nhân.

import { Router } from 'express';
import { requireAccess } from '../../auth/access.js';
import type { VerifyIdentity } from '../../auth/identity.js';
import type { SearchService } from './types.js';

export const createSearchRouter = ({ verifyIdentity, search }: { verifyIdentity: VerifyIdentity; search: SearchService }) => {
  const router = Router();

  router.get('/subjects', requireAccess(verifyIdentity, 'subject.search'), async (_req, res) => {
    const items = await search.listSubjects();
    res.set('Cache-Control', 'no-store'); // không cache dữ liệu bệnh nhân
    res.json({ items });
  });

  router.get('/subjects/:subjectRef', requireAccess(verifyIdentity, 'subject.view'), async (req, res) => {
    const { subjectRef } = req.params;
    const subject = await search.getSubject(typeof subjectRef === 'string' ? subjectRef : '');
    res.set('Cache-Control', 'no-store');
    res.json(subject);
  });

  return router;
};
