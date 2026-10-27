import { Router, type Request } from 'express';
import { z } from 'zod';
import { aiService } from '../ai/aiService.js';
import { validateBody } from '../middleware/validate.js';
import { aiRateLimit } from '../middleware/aiRateLimit.js';
import { parseResourceId } from '../utils/resourceId.js';
import { planningService } from '../services/planningService.js';
import { createBudgetItemSchema, updateBudgetItemSchema } from '../../shared/schemas/planning.schema.js';

const router = Router();
const messageSchema = z.object({ message: z.string().trim().min(1).max(2000) });
const proposalSchema = z.object({
  action: z.enum(['update_budget', 'add_budget', 'update_timeline', 'add_timeline', 'update_vendor', 'add_vendor']),
  target_id: z.string().uuid().nullable(),
  current_value: z.record(z.string(), z.unknown()).nullable(),
  proposed_value: z.record(z.string(), z.unknown()),
  explanation: z.string().min(1).max(1000),
});

// AI routes are deliberately event-scoped so prompts cannot request unrelated data.
function eventId(req: Request): string {
  return parseResourceId(String(req.params['eventId']));
}

router.post('/events/:eventId/ai/generate', aiRateLimit, async (req, res, next) => {
  try {
    res.status(201).json(await aiService.generatePlan(eventId(req)));
  } catch (error) {
    next(error);
  }
});

router.post('/events/:eventId/ai/copilot', aiRateLimit, validateBody(messageSchema), async (req, res, next) => {
  try {
    res.json(await aiService.answerCopilot(eventId(req), req.body.message));
  } catch (error) {
    next(error);
  }
});

router.post('/events/:eventId/ai/copilot/confirm', validateBody(proposalSchema), async (req, res, next) => {
  try {
    const id = eventId(req);
    const proposal = req.body;
    if (proposal.action === 'update_budget' && proposal.target_id) {
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
