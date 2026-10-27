import { randomUUID } from 'node:crypto';
import type { CopilotResponse } from './schemas.js';

interface StoredProposal {
  eventId: string;
  proposal: NonNullable<CopilotResponse['proposal']>;
  expiresAt: number;
}

const proposals = new Map<string, StoredProposal>();
const PROPOSAL_TTL_MS = 10 * 60 * 1000;

/** Keeps proposed mutations server-side until the user explicitly confirms them. */
export function storeProposal(eventId: string, proposal: NonNullable<CopilotResponse['proposal']>): string {
  const id = randomUUID();
  proposals.set(id, { eventId, proposal, expiresAt: Date.now() + PROPOSAL_TTL_MS });
  return id;
}

export function consumeProposal(id: string, eventId: string): StoredProposal | null {
  const stored = proposals.get(id);
  proposals.delete(id);
  if (!stored || stored.eventId !== eventId || stored.expiresAt < Date.now()) return null;
  return stored;
}
