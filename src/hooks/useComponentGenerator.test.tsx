import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { useComponentGenerator } from './useComponentGenerator';

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 'render(<div />)' }) }));
});

it('keeps submitted prompt history independently of cleared components across reloads', async () => {
  const first = renderHook(useComponentGenerator);
  await act(() => first.result.current.generate('card', undefined, 'google'));
  act(() => first.result.current.clearAll());
  first.unmount();
  const second = renderHook(useComponentGenerator);
  expect(second.result.current.promptHistory).toEqual(['card']);
  expect(second.result.current.components).toEqual([]);
});

it('restores generated components and their Date values, including deletion', async () => {
  const first = renderHook(useComponentGenerator);
  await act(() => first.result.current.generate('card', undefined, 'google'));
  first.unmount();
  const second = renderHook(useComponentGenerator);
  expect(second.result.current.components[0]).toMatchObject({ prompt: 'card', createdAt: expect.any(Date) });
  act(() => second.result.current.removeComponent(second.result.current.components[0].id));
  second.unmount();
  expect(renderHook(useComponentGenerator).result.current.components).toEqual([]);
});
