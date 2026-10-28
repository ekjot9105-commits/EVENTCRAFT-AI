import { Router, type Request, type Response, type NextFunction } from 'express';
import { validateBody } from '../middleware/validate.js';
import { notFound } from '../middleware/errorHandler.js';
import { planningService } from '../services/planningService.js';
import {
  createBudgetItemSchema,
  updateBudgetItemSchema,
  createTimelineItemSchema,
  updateTimelineItemSchema,
  createVendorSchema,
  updateVendorSchema,
} from '../../shared/schemas/planning.schema.js';
import { parseResourceId } from '../utils/resourceId.js';
import { requireEventOwnership } from '../middleware/eventOwnership.js';

const router = Router();
router.use('/events/:eventId', requireEventOwnership);

// Parse route IDs at the boundary so services only receive valid UUIDs.
function eventId(req: Request): string {
  return parseResourceId(String(req.params['eventId']));
}

function itemId(req: Request): string {
  return parseResourceId(String(req.params['itemId']));
}

// Budget, timeline, and vendor routes intentionally share the same event scope.
router.get('/events/:eventId/budget', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await planningService.listBudgetItems(eventId(req))); } catch (error) { next(error); }
});

router.post('/events/:eventId/budget', validateBody(createBudgetItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await planningService.createBudgetItem(eventId(req), req.body)); } catch (error) { next(error); }
});

router.patch('/events/:eventId/budget/:itemId', validateBody(updateBudgetItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await planningService.updateBudgetItem(eventId(req), itemId(req), req.body);
    if (!item) throw notFound('Budget item', itemId(req));
    res.json(item);
  } catch (error) { next(error); }
});

router.delete('/events/:eventId/budget/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try { await planningService.deleteBudgetItem(eventId(req), itemId(req)); res.status(204).send(); } catch (error) { next(error); }
});

router.get('/events/:eventId/timeline', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await planningService.listTimelineItems(eventId(req))); } catch (error) { next(error); }
});

router.post('/events/:eventId/timeline', validateBody(createTimelineItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await planningService.createTimelineItem(eventId(req), req.body)); } catch (error) { next(error); }
});

router.patch('/events/:eventId/timeline/:itemId', validateBody(updateTimelineItemSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await planningService.updateTimelineItem(eventId(req), itemId(req), req.body);
    if (!item) throw notFound('Timeline item', itemId(req));
    res.json(item);
  } catch (error) { next(error); }
});

router.delete('/events/:eventId/timeline/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try { await planningService.deleteTimelineItem(eventId(req), itemId(req)); res.status(204).send(); } catch (error) { next(error); }
});

router.get('/events/:eventId/vendors', async (req: Request, res: Response, next: NextFunction) => {
  try { res.json(await planningService.listVendors(eventId(req))); } catch (error) { next(error); }
});

router.post('/events/:eventId/vendors', validateBody(createVendorSchema), async (req: Request, res: Response, next: NextFunction) => {
  try { res.status(201).json(await planningService.createVendor(eventId(req), req.body)); } catch (error) { next(error); }
});

router.patch('/events/:eventId/vendors/:itemId', validateBody(updateVendorSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const vendor = await planningService.updateVendor(eventId(req), itemId(req), req.body);
    if (!vendor) throw notFound('Vendor', itemId(req));
    res.json(vendor);
  } catch (error) { next(error); }
});

router.delete('/events/:eventId/vendors/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try { await planningService.deleteVendor(eventId(req), itemId(req)); res.status(204).send(); } catch (error) { next(error); }
});

export default router;
