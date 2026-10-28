import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { aiService } from '../ai/aiService.js';
import { validateBody } from '../middleware/validate.js';
import { aiRateLimit } from '../middleware/aiRateLimit.js';
import { parseResourceId } from '../utils/resourceId.js';
import { planningService } from '../services/planningService.js';
import { createBudgetItemSchema, updateBudgetItemSchema } from '../../shared/schemas/planning.schema.js';
import { consumeProposal, storeProposal } from '../ai/proposalStore.js';
import { getAiProviderStatus } from '../ai/provider.js';
import { requireEventOwnership } from '../middleware/eventOwnership.js';

const router = Router();
router.use('/events/:eventId', requireEventOwnership);
const messageSchema = z.object({ message: z.string().trim().min(1).max(2000) });
const proposalSchema = z.object({
  proposal_id: z.string().uuid(),
});
const planSchema = z.object({ plan_id: z.string().uuid() });

router.get('/ai/status', (_req: Request, res: Response) => {
  res.json(getAiProviderStatus());
});

// AI routes are deliberately event-scoped so prompts cannot request unrelated data.
function eventId(req: Request): string {
  return parseResourceId(String(req.params['eventId']));
}

router.post('/events/:eventId/ai/generate', aiRateLimit, async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await aiService.generatePlan(eventId(req)));
  } catch (error) {
    next(error);
  }
});

router.get('/events/:eventId/ai/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(aiService.listPlans(eventId(req)));
  } catch (error) {
    next(error);
  }
});

router.post('/events/:eventId/ai/plans/apply', validateBody(planSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await aiService.applyPlan(eventId(req), req.body.plan_id));
  } catch (error) {
    next(error);
  }
});

router.post('/events/:eventId/ai/plans/restore', validateBody(planSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await aiService.restorePlan(eventId(req), req.body.plan_id));
  } catch (error) {
    next(error);
  }
});

router.post('/events/:eventId/ai/copilot', aiRateLimit, validateBody(messageSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const response = await aiService.answerCopilot(eventId(req), req.body.message);
    if (response.proposal?.requires_confirmation) {
      const proposal_id = storeProposal(eventId(req), response.proposal);
      res.json({ ...response, proposal: { ...response.proposal, proposal_id } });
      return;
    }
    res.json(response);
  } catch (error) {
    next(error);
  }
});

router.post('/events/:eventId/ai/copilot/confirm', validateBody(proposalSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = eventId(req);
    const stored = consumeProposal(req.body.proposal_id, id);
    if (!stored) return res.status(409).json({ error: 'The proposal is expired, already used, or belongs to another event.' });
    const proposal = stored.proposal;
    if (proposal.action === 'update_budget' && proposal.target_id) {
      const currentItems = await planningService.listBudgetItems(id);
      const currentItem = currentItems.find((item) => item.id === proposal.target_id);
      if (!currentItem || (proposal.current_value && Object.entries(proposal.current_value).some(([key, value]) => currentItem[key as keyof typeof currentItem] !== value))) {
        return res.status(409).json({ error: 'The proposal is stale or the item no longer exists.' });
      }
      const parsed = updateBudgetItemSchema.safeParse(proposal.proposed_value);
      if (!parsed.success) return res.status(400).json({ error: 'The proposed budget update is invalid.' });
      const current = await planningService.updateBudgetItem(id, proposal.target_id, {
        ...parsed.data,
        notes: parsed.data.notes ?? undefined,
      });
      if (!current) return res.status(409).json({ error: 'The proposal is stale or the item no longer exists.' });
      return res.json({ status: 'applied', item: current });
    }
    if (proposal.action === 'add_budget') {
      const parsed = createBudgetItemSchema.safeParse(proposal.proposed_value);
      if (!parsed.success) return res.status(400).json({ error: 'The proposed budget item is invalid.' });
      const item = await planningService.createBudgetItem(id, parsed.data);
      return res.status(201).json({ status: 'applied', item });
    }
    return res.status(400).json({ error: 'This proposal type is not yet supported for confirmation.' });
  } catch (error) {
    next(error);
  }
});

export default router;
