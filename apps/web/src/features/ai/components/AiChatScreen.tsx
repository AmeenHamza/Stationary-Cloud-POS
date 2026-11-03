'use client';

import { Loader2Icon, SendIcon, Trash2Icon } from 'lucide-react';

import { AI_QUESTION_MAX_CHARS } from '@pos/contracts';

import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { useAiChat } from '../hooks/useAiChat';

import { AiBackLink, AiKeyNotice } from './AiKeyNotice';
import { ChatConversation } from './ChatConversation';
import { LanguagePicker } from './LanguagePicker';

const SUGGESTIONS = [
  'What were today’s sales?',
  'Which products sold most this week?',
  'Which products are running low?',
  'How do this month’s sales compare with last month?',
];

/** "Ask Your POS" (F-29): a chat over live figures; the conversation is kept only on this screen. */
export function AiChatScreen() {
  const chat = useAiChat();
  return (
    <>
      <PageHeader
        title="Ask your POS"
        description="Ask about sales, products and stock. Answers use live figures; customer details are never shared."
        actions={<AiBackLink />}
      />
      <AiKeyNotice />
      <Card>
        <CardContent className="grid gap-5 pt-6">
          <LanguagePicker
            value={chat.language}
            onChange={chat.setLanguage}
            disabled={chat.loading}
          />
          <ChatConversation turns={chat.turns} />
          {chat.turns.length === 0 && (
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    chat.ask(suggestion);
                  }}
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          )}
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              chat.ask(chat.question);
            }}
          >
            <Input
              aria-label="Your question"
              placeholder="Ask a question…"
              maxLength={AI_QUESTION_MAX_CHARS}
              value={chat.question}
              onChange={(event) => {
                chat.setQuestion(event.target.value);
              }}
            />
            <Button type="submit" disabled={chat.loading || chat.question.trim() === ''}>
              {chat.loading ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
              Ask
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={chat.loading || chat.turns.length === 0}
              onClick={chat.clear}
            >
              <Trash2Icon />
              Clear
            </Button>
          </form>
          {chat.error !== undefined && (
            <p role="alert" className="text-sm text-destructive">
              {chat.error}
            </p>
          )}
        </CardContent>
      </Card>
    </>
  );
}
