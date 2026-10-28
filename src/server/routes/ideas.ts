import { Router, type Request, type Response, type NextFunction } from 'express';
import { createIdeaSchema, updateIdeaSchema } from '../../shared/schemas/idea.schema.js';
import { validateBody } from '../middleware/validate.js';
import { notFound } from '../middleware/errorHandler.js';
import { parseResourceId } from '../utils/resourceId.js';
import { ideaService } from '../services/ideaService.js';
import { requireEventOwnership } from '../middleware/eventOwnership.js';

const router = Router();
router.use('/events/:eventId', requireEventOwnership);
const eventId = (req: Request) => parseResourceId(String(req.params['eventId']));
const ideaId = (req: Request) => parseResourceId(String(req.params['ideaId']));

// Ideas are scoped to one event and never accept arbitrary cross-event IDs.
router.get('/events/:eventId/ideas', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await ideaService.list(eventId(req))); } catch (error) { next(error); }
});
router.post('/events/:eventId/ideas', validateBody(createIdeaSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await ideaService.create(eventId(req), req.body)); } catch (error) { next(error); }
});
router.patch('/events/:eventId/ideas/:ideaId', validateBody(updateIdeaSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idea = await ideaService.update(eventId(req), ideaId(req), req.body);
    if (!idea) throw notFound('Idea', ideaId(req));
    res.json(idea);
  } catch (error) { next(error); }
});

export default router;
