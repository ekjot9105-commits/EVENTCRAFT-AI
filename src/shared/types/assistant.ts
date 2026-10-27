// ===========================================
// Assistant Types
// ===========================================

import type { AssistantRole } from '../constants/statusEnums.js';

export interface AssistantMessage {
  id: string;
  event_id: string;
  role: AssistantRole;
  content: string;
  structured_actions: SuggestedAction[] | null;
  created_at: string;
}

export interface SuggestedAction {
  type: 'update_budget' | 'add_budget' | 'update_timeline' | 'add_timeline' | 'update_vendor' | 'add_vendor';
  description: string;
  target_id?: string;
  data: Record<string, unknown>;
}

export interface SendMessagePayload {
  message: string;
}

export interface AssistantResponse {
  message: AssistantMessage;
  suggested_actions: SuggestedAction[];
}
