import { Router } from 'express';
import { requireAccess } from '../../auth/access.js';
import type { VerifyIdentity } from '../../auth/identity.js';
import type { SearchService } from './types.js';

// Chỉ có API đọc; query string bị bỏ qua
export const createSearchRouter = ({ verifyIdentity, search }: { verifyIdentity: VerifyIdentity; search: SearchService }) => {
  const router = Router();

  router.get('/subjects', requireAccess(verifyIdentity, 'subject.search'), async (_req, res) => {
    const items = await search.listSubjects();
    res.set('Cache-Control', 'no-store');
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
