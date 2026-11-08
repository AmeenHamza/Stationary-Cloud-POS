'use client';

import { ScanBarcodeIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Input } from '@/components/ui/input';
import { userMessageOf } from '@/lib/errors/graphql-error';
import { createCoalescer } from '@/lib/timing/debounce';

import { useBarcodeScan } from '../hooks/useBarcodeScan';

/**
 * "Search by name or scan barcode" (F-18). Typing updates the name search after a short debounce.
 * Enter decides at once: it cancels that pending search and tries the text as a barcode, so a scan
 * sends one lookup and nothing else (NET-07); only a code that matches nothing searches by name.
 */
export function ProductSearchBar({ onSearch }: { onSearch: (search: string) => void }) {
  const [text, setText] = useState('');
  const onSearchRef = useRef(onSearch);
  const coalescerRef = useRef(createCoalescer(180));
  const scan = useBarcodeScan();
  useEffect(() => {
    onSearchRef.current = onSearch;
  }, [onSearch]);
  useEffect(() => {
    coalescerRef.current.schedule('terminal-search', () => {
      onSearchRef.current(text.trim());
    });
  }, [text]);
  useEffect(
    () => () => {
      coalescerRef.current.cancelAll();
    },
    [],
  );
  const submit = async () => {
    coalescerRef.current.cancelAll();
    const code = text.trim();
    if (code === '') {
      onSearch('');
      return;
    }
    try {
      if (await scan(code)) {
        setText('');
      } else {
        onSearch(code);
      }
    } catch (error) {
      toast.error(userMessageOf(error));
    }
  };
  return (
    <form
      className="relative min-w-60 flex-1"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <ScanBarcodeIcon
        className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        autoFocus
        className="pl-9"
        placeholder="Search by name or scan barcode"
        aria-label="Search by name or scan barcode"
        value={text}
        onChange={(event) => {
          setText(event.target.value);
        }}
      />
    </form>
  );
}
