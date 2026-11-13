import { ensureRenderCall, stripCodeFences } from './generator';

export function streamResponse(
  generate: (update: (code: string) => void, signal: AbortSignal) => Promise<string>,
  headers: Record<string, string> = {},
): Response {
  const abort = new AbortController();
  const encoder = new TextEncoder();
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: object) => {
        if (!cancelled) controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        const text = await generate((code) => send({ code: stripCodeFences(code) }), abort.signal);
        send({ code: ensureRenderCall(stripCodeFences(text)), done: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        send({ error: message.includes('429')
          ? '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
          : message.includes('503')
            ? 'API 서버가 일시적으로 과부하 상태입니다. 잠시 후 다시 시도해주세요.'
            : message });
      } finally {
        if (!cancelled) controller.close();
      }
    },
    cancel() { cancelled = true; abort.abort(); },
  });
  return new Response(body, { headers: {
    ...headers, 'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache', 'X-Accel-Buffering': 'no',
  } });
}
