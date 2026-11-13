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

it('shows partial code before completion and persists only the finished component', async () => {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({ start(c) { controller = c; } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'text/event-stream' } })));
  const hook = renderHook(useComponentGenerator);
  let pending!: Promise<void>;
  await act(async () => { pending = hook.result.current.generate('stream', undefined, 'google'); });
  expect(hook.result.current.streamingComponent?.code).toBe('');
  await act(async () => { controller.enqueue(new TextEncoder().encode('data: {"code":"const Card = () =>"}\n\n')); });
  expect(hook.result.current.streamingComponent?.code).toBe('const Card = () =>');
  expect(hook.result.current.components).toEqual([]);
  await act(async () => {
    controller.enqueue(new TextEncoder().encode('data: {"code":"render(<div />)","done":true}\n\n'));
    controller.close();
    await pending;
  });
  expect(hook.result.current.streamingComponent).toBeNull();
  expect(hook.result.current.components[0].code).toBe('render(<div />)');
});

it('discards incomplete streams and keeps previous successful components', async () => {
  const hook = renderHook(useComponentGenerator);
  await act(() => hook.result.current.generate('saved', undefined, 'google'));
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('data: {"code":"partial"}\n\n', { headers: { 'Content-Type': 'text/event-stream' } })));
  await act(() => hook.result.current.generate('broken', undefined, 'google'));
  expect(hook.result.current.error).toContain('연결이 끊겼습니다');
  expect(hook.result.current.components.map((item) => item.prompt)).toEqual(['saved']);
  expect(hook.result.current.streamingComponent).toBeNull();
  expect(hook.result.current.isLoading).toBe(false);
});
