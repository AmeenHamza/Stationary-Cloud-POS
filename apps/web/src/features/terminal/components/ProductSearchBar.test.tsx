import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ProductSearchBar } from './ProductSearchBar';

const scan = vi.fn<(code: string) => Promise<boolean>>();

vi.mock('../hooks/useBarcodeScan', () => ({ useBarcodeScan: () => scan }));

const BARCODE = '8960000000011';
const WELL_PAST_THE_WINDOW = 1_000;

function setUp() {
  const onSearch = vi.fn<(search: string) => void>();
  render(<ProductSearchBar onSearch={onSearch} />);
  const input = screen.getByRole<HTMLInputElement>('textbox');
  const type = (text: string) => {
    fireEvent.change(input, { target: { value: text } });
  };
  const pressEnter = () => {
    fireEvent.submit(input);
  };
  return { onSearch, input, type, pressEnter };
}

/** A lookup the test answers when it chooses, like a slow connection. */
function slowLookup() {
  let answer: (found: boolean) => void = () => undefined;
  scan.mockReturnValueOnce(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  return (found: boolean) =>
    act(async () => {
      answer(found);
      await Promise.resolve();
    });
}

beforeEach(() => {
  vi.useFakeTimers();
  scan.mockReset();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('ProductSearchBar (F-18, NET-07)', () => {
  it('searches by name after typing stops, without any Enter', () => {
    const { onSearch, type } = setUp();
    onSearch.mockClear();
    type('notebook');
    act(() => {
      vi.advanceTimersByTime(WELL_PAST_THE_WINDOW);
    });
    expect(onSearch).toHaveBeenCalledWith('notebook');
    expect(scan).not.toHaveBeenCalled();
  });

  it('a slow scan sends no name search while the lookup is out, or after it finds the code', async () => {
    const { onSearch, input, type, pressEnter } = setUp();
    onSearch.mockClear();
    const answer = slowLookup();
    type(BARCODE);
    pressEnter();
    act(() => {
      vi.advanceTimersByTime(WELL_PAST_THE_WINDOW);
    });
    expect(onSearch).not.toHaveBeenCalled();
    await answer(true);
    act(() => {
      vi.advanceTimersByTime(WELL_PAST_THE_WINDOW);
    });
    expect(input.value).toBe('');
    expect(onSearch).not.toHaveBeenCalledWith(BARCODE);
  });

  it('a code that matches nothing searches by name at once, and only once', async () => {
    const { onSearch, input, type, pressEnter } = setUp();
    onSearch.mockClear();
    const answer = slowLookup();
    type('notebook');
    pressEnter();
    await answer(false);
    expect(onSearch.mock.calls).toEqual([['notebook']]);
    act(() => {
      vi.advanceTimersByTime(WELL_PAST_THE_WINDOW);
    });
    expect(onSearch.mock.calls).toEqual([['notebook']]);
    expect(input.value).toBe('notebook');
  });

  it('Enter on an empty box clears the search without a lookup', () => {
    const { onSearch, pressEnter } = setUp();
    onSearch.mockClear();
    pressEnter();
    expect(onSearch.mock.calls).toEqual([['']]);
    expect(scan).not.toHaveBeenCalled();
  });
});
