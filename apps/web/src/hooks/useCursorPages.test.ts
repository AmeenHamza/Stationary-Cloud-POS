import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useCursorPages } from './useCursorPages';

describe('useCursorPages (keyset forward/back, API.md §3)', () => {
  it('starts on page 1 with no cursor', () => {
    const { result } = renderHook(() => useCursorPages());
    expect(result.current).toMatchObject({ after: null, page: 1, hasPrevious: false });
  });

  it('moves forward with end cursors and back to the cached previous cursor', () => {
    const { result } = renderHook(() => useCursorPages());
    act(() => {
      result.current.next('c1');
    });
    act(() => {
      result.current.next('c2');
    });
    expect(result.current).toMatchObject({ after: 'c2', page: 3, hasPrevious: true });
    act(() => {
      result.current.previous();
    });
    expect(result.current).toMatchObject({ after: 'c1', page: 2 });
  });

  it('ignores a missing end cursor, never goes before page 1, and resets', () => {
    const { result } = renderHook(() => useCursorPages());
    act(() => {
      result.current.next(null);
      result.current.previous();
    });
    expect(result.current.page).toBe(1);
    act(() => {
      result.current.next('c1');
    });
    act(() => {
      result.current.reset();
    });
    expect(result.current).toMatchObject({ after: null, page: 1 });
  });
});
