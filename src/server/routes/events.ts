// ===========================================
// Event Routes
// ===========================================

import { Router, type Request, type Response, type NextFunction } from 'express';
import { eventService } from '../services/eventService.js';
import { validateBody } from '../middleware/validate.js';
import { notFound } from '../middleware/errorHandler.js';
import { createEventSchema, updateEventSchema } from '../../shared/schemas/event.schema.js';

const router = Router();

/**
 * GET /api/events — List all events
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const events = await eventService.list();
    res.json(events);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/events/:id — Get a single event
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const event = await eventService.getById(req.params['id']!);
    if (!event) {
      throw notFound('Event', req.params['id']!);
    }
    res.json(event);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/events — Create a new event
 */
router.post(
  '/',
  validateBody(createEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.create(req.body);
      res.status(201).json(event);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * PATCH /api/events/:id — Update an event
 */
router.patch(
  '/:id',
  validateBody(updateEventSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const event = await eventService.update(req.params['id']!, req.body);
      if (!event) {
        throw notFound('Event', req.params['id']!);
      }
      res.json(event);
    } catch (err) {
      next(err);
    }
  },
);

/**
 * DELETE /api/events/:id — Delete an event
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await eventService.delete(req.params['id']!);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

export default router;
