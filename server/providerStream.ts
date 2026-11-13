import { readEvents } from '../src/stream';

export async function readProviderStream(
  body: ReadableStream<Uint8Array>, provider: 'anthropic' | 'google', update: (code: string) => void,
): Promise<string> {
  let text = '';
  let completed = false;
  for await (const event of readEvents(body)) {
    if (event.error) throw new Error('AI 제공자 스트림 오류가 발생했습니다. 다시 시도해주세요.');
    if (provider === 'anthropic') {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        text += event.delta.text;
        update(text);
      }
      if (event.type === 'message_stop') completed = true;
    } else {
      const candidate = event.candidates?.[0];
      if (candidate?.finishReason === 'MAX_TOKENS') {
        throw new Error('생성된 코드가 너무 길어 잘렸습니다. 더 간단한 컴포넌트를 요청해주세요.');
      }
      const delta = candidate?.content?.parts?.filter((part: { thought?: boolean }) => !part.thought)
        .map((part: { text?: string }) => part.text ?? '').join('') ?? '';
      if (delta) { text += delta; update(text); }
      if (candidate?.finishReason === 'STOP') completed = true;
    }
  }
  if (!completed || !text.trim()) throw new Error('코드 생성이 완료되지 않았습니다. 다시 시도해주세요.');
  return text;
}
