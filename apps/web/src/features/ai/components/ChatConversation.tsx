import { AiMarkdown } from './AiMarkdown';
import { directionOf } from './AiResultView';

import type { ShownTurn } from '../hooks/useAiChat';

/** The chat so far: questions on the right, answers (Markdown, Urdu right to left) on the left. */
export function ChatConversation({ turns }: { turns: readonly ShownTurn[] }) {
  return (
    <ol className="grid gap-3" aria-label="Conversation" aria-live="polite">
      {turns.map((turn, index) => (
        <li
          key={index}
          className={
            turn.role === 'USER'
              ? 'ms-auto max-w-[80%] rounded-lg bg-primary px-3 py-2 text-primary-foreground'
              : 'max-w-[90%] rounded-lg border bg-muted/40 px-3 py-2'
          }
          dir={turn.role === 'USER' ? 'auto' : directionOf(turn.language)}
        >
          {turn.role === 'USER' ? turn.text : <AiMarkdown text={turn.text} />}
        </li>
      ))}
    </ol>
  );
}
