import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { usePersistentState } from './usePersistentState';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
});

it('uses the default when storage is corrupt or unavailable', () => {
  localStorage.setItem('test', '{');
  expect(renderHook(() => usePersistentState('test', '', String)).result.current[0]).toBe('');
  vi.stubGlobal('localStorage', {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('quota'); },
  });
  const hook = renderHook(() => usePersistentState('test', '', String));
  act(() => hook.result.current[1]('usable'));
  expect(hook.result.current[0]).toBe('usable');
});

it('restores saved state after remount', () => {
  const first = renderHook(() => usePersistentState('test', '', String));
  act(() => first.result.current[1]('saved'));
  first.unmount();
  const second = renderHook(() => usePersistentState('test', '', String));
  expect(second.result.current[0]).toBe('saved');
});
