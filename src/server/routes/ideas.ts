// ===========================================
// Ideas Studio Routes
// ===========================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { createIdeaSchema, updateIdeaSchema } from '../../shared/schemas/idea.schema.js';
import { validateBody } from '../middleware/validate.js';
import { notFound } from '../middleware/errorHandler.js';
import { parseResourceId } from '../utils/resourceId.js';
import { ideaService } from '../services/ideaService.js';
import { requireEventOwnership } from '../middleware/eventOwnership.js';

const router = Router();

// Enforce ownership / tenant isolation for all ideas routes
router.use('/events/:eventId', requireEventOwnership);

/**
 * Extracts and validates the eventId parameter as a valid UUID.
 */
const eventId = (req: Request) => parseResourceId(String(req.params['eventId']));

/**
 * Extracts and validates the ideaId parameter as a valid UUID.
 */
const ideaId = (req: Request) => parseResourceId(String(req.params['ideaId']));

// ===========================================
// Ideas CRUD Endpoints
// ===========================================

/**
 * GET /api/events/:eventId/ideas — List all curated and AI-generated ideas for an event
 */
router.get('/events/:eventId/ideas', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ideas = await ideaService.list(eventId(req));
    res.json(ideas);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/events/:eventId/ideas — Save a new idea (custom or AI-suggested)
 */
router.post('/events/:eventId/ideas', validateBody(createIdeaSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idea = await ideaService.create(eventId(req), req.body);
    res.status(201).json(idea);
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/events/:eventId/ideas/:ideaId — Update idea status, notes, or voting
 */
router.patch('/events/:eventId/ideas/:ideaId', validateBody(updateIdeaSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const idea = await ideaService.update(eventId(req), ideaId(req), req.body);
    if (!idea) throw notFound('Idea', ideaId(req));
    res.json(idea);
  } catch (error) {
    next(error);
  }
});

export default router;
