import { expect, it } from 'vitest';
import { streamResponse } from './streamResponse';
import { readEvents } from '../src/stream';

it('sends partial code immediately and normalized final code with a completion event', async () => {
  let finish!: (code: string) => void;
  const response = streamResponse(async (update) => {
    update('const Card');
    return new Promise<string>((resolve) => { finish = resolve; });
  });
  const events = readEvents(response.body!);
  expect((await events.next()).value).toEqual({ code: 'const Card' });
  finish('```jsx\nconst Card = () => <div />;\n```');
  expect((await events.next()).value).toEqual({ code: 'const Card = () => <div />;\n\nrender(<Card />);', done: true });
  expect((await events.next()).done).toBe(true);
});

it('delivers generation failures as an error event instead of successful completion', async () => {
  const response = streamResponse(async () => { throw new Error('Gemini API error: 429'); });
  const events = [];
  for await (const event of readEvents(response.body!)) events.push(event);
  expect(events).toEqual([{ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }]);
});

it('aborts upstream work when the consumer cancels', async () => {
  let signal!: AbortSignal;
  const response = streamResponse(async (_, upstreamSignal) => {
    signal = upstreamSignal;
    return new Promise<string>((_, reject) => upstreamSignal.addEventListener('abort', () => reject(new Error('cancelled'))));
  });
  await response.body!.cancel();
  expect(signal.aborted).toBe(true);
});
