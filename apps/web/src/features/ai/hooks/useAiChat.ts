'use client';

import { useApolloClient } from '@apollo/client/react';
import { useState } from 'react';

import { AiAskDocument } from '../graphql/ai.documents';
import { historyForRequest, type ChatTurn } from '../lib/chat-history';

import { useAiRequest } from './useAiRequest';

import type { AiLanguage } from '@/graphql/__generated__/graphql';

export interface ShownTurn extends ChatTurn {
  language: AiLanguage;
}

/**
 * "Ask Your POS" state (F-29): the turns shown, the draft question and the answer language. Each
 * question sends the latest turns that fit the server's bounds; nothing is stored anywhere else.
 */
export function useAiChat() {
  const client = useApolloClient();
  const request = useAiRequest();
  const [language, setLanguage] = useState<AiLanguage>('ENGLISH');
  const [question, setQuestion] = useState('');
  const [turns, setTurns] = useState<ShownTurn[]>([]);

  const ask = (text: string) => {
    const asked = text.trim();
    if (asked === '' || request.loading) {
      return;
    }
    const history = historyForRequest(turns).map(({ role, text: said }) => ({ role, text: said }));
    void request.run(async () => {
      const { data } = await client.mutate({
        mutation: AiAskDocument,
        variables: { input: { question: asked, history, language } },
        fetchPolicy: 'no-cache',
      });
      const answer = data?.result;
      if (answer !== undefined) {
        setTurns((shown) => [
          ...shown,
          { role: 'USER', text: asked, language },
          { role: 'ASSISTANT', text: answer.text, language: answer.language },
        ]);
        setQuestion('');
      }
      return answer;
    });
  };

  const clear = () => {
    setTurns([]);
    request.clear();
  };

  return {
    language,
    setLanguage,
    question,
    setQuestion,
    turns,
    ask,
    clear,
    loading: request.loading,
    error: request.error,
  };
}
