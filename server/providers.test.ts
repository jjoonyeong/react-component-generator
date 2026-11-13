import { afterEach, expect, it, vi } from 'vitest';
import { generateCode } from './providers';

afterEach(() => vi.unstubAllGlobals());

it('requests Anthropic streaming and forwards incremental code', async () => {
  const fetchMock = vi.fn().mockResolvedValue(new Response(
    'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"const Card = () => <div />;"}}\n\ndata: {"type":"message_stop"}\n\n',
  ));
  vi.stubGlobal('fetch', fetchMock);
  const update = vi.fn();
  expect(await generateCode('card', 'test-placeholder', 'anthropic', update)).toContain('const Card');
  expect(JSON.parse(fetchMock.mock.calls[0][1].body).stream).toBe(true);
  expect(update).toHaveBeenCalledWith('const Card = () => <div />;');
});

it('uses Gemini SSE and resets partial code before a sequential model fallback', async () => {
  const fetchMock = vi.fn()
    .mockResolvedValueOnce(new Response('data: {"candidates":[{"content":{"parts":[{"text":"bad partial"}]},"finishReason":"MAX_TOKENS"}]}\n\n'))
    .mockResolvedValueOnce(new Response('data: {"candidates":[{"content":{"parts":[{"text":"good code"}]},"finishReason":"STOP"}]}\n\n'));
  vi.stubGlobal('fetch', fetchMock);
  const updates: string[] = [];
  expect(await generateCode('card', 'test-placeholder', 'google', (code) => updates.push(code))).toBe('good code');
  expect(fetchMock.mock.calls[0][0]).toContain(':streamGenerateContent?alt=sse');
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(updates).toEqual(['', '', 'good code']);
});
