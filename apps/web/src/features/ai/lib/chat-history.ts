import { AI_HISTORY_MAX_CHARS, AI_HISTORY_MAX_TURNS } from '@pos/contracts';

import type { AiChatRole } from '@/graphql/__generated__/graphql';

export interface ChatTurn {
  role: AiChatRole;
  text: string;
}

/**
 * The most recent turns that fit the server's bounds (≤ 10 turns, ≤ 4,000 characters; API.md §6.2).
 * The conversation lives only in this screen and is never stored (SYSTEM_DESIGN.md §8 step 6).
 */
export function historyForRequest(turns: readonly ChatTurn[]): ChatTurn[] {
  const kept: ChatTurn[] = [];
  let characters = 0;
  for (let index = turns.length - 1; index >= 0 && kept.length < AI_HISTORY_MAX_TURNS; index -= 1) {
    const turn = turns[index];
    if (turn === undefined || characters + turn.text.length > AI_HISTORY_MAX_CHARS) {
      break;
    }
    characters += turn.text.length;
    kept.unshift(turn);
  }
  return kept;
}
