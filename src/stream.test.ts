import { expect, it } from 'vitest';
import { readEvents } from './stream';

it('decodes SSE across byte boundaries and CRLF frames', async () => {
  const bytes = new TextEncoder().encode('data: {"text":"한글"}\r\n\r\ndata: {"done":true}\n\n');
  const body = new ReadableStream<Uint8Array>({ start(c) { for (const byte of bytes) c.enqueue(Uint8Array.of(byte)); c.close(); } });
  const events = [];
  for await (const event of readEvents(body)) events.push(event);
  expect(events).toEqual([{ text: '한글' }, { done: true }]);
});
