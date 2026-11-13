import { expect, it } from 'vitest';
import { readProviderStream } from './providerStream';

function body(events: unknown[]) {
  return new Response(events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('')).body!;
}

it('forwards Anthropic text deltas before the message completes', async () => {
  const updates: string[] = [];
  const text = await readProviderStream(body([
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'const ' } },
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Card = () => <div />;' } },
    { type: 'message_stop' },
  ]), 'anthropic', (code) => updates.push(code));
  expect(updates).toEqual(['const ', 'const Card = () => <div />;']);
  expect(text).toBe(updates[1]);
});

it('streams Gemini text, excludes thought parts and requires a successful finish', async () => {
  const updates: string[] = [];
  const text = await readProviderStream(body([
    { candidates: [{ content: { parts: [{ text: 'private thought', thought: true }, { text: 'const ' }] } }] },
    { candidates: [{ content: { parts: [{ text: 'Card = () => <div />;' }] }, finishReason: 'STOP' }] },
  ]), 'google', (code) => updates.push(code));
  expect(updates).toEqual(['const ', 'const Card = () => <div />;']);
  expect(text).toBe(updates[1]);
});

it('rejects Gemini MAX_TOKENS with the existing truncation message', async () => {
  await expect(readProviderStream(body([{ candidates: [{ finishReason: 'MAX_TOKENS' }] }]), 'google', () => {}))
    .rejects.toThrow('생성된 코드가 너무 길어 잘렸습니다.');
});

it('rejects an Anthropic stream error even after text has arrived', async () => {
  await expect(readProviderStream(body([
    { type: 'content_block_delta', delta: { type: 'text_delta', text: 'partial' } },
    { type: 'error', error: { message: 'upstream failure' } },
    { type: 'message_stop' },
  ]), 'anthropic', () => {})).rejects.toThrow();
});
