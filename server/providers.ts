import { readProviderStream } from './providerStream';
import { withModelFallback } from './fallback';
import { SYSTEM_PROMPT } from './systemPrompt';

const GOOGLE_MODELS = ['gemini-3.1-flash-lite', 'gemini-3.5-flash'];

export async function generateCode(
  prompt: string, apiKey: string, provider: 'anthropic' | 'google',
  update: (code: string) => void, signal?: AbortSignal,
): Promise<string> {
  if (provider === 'google') {
    return withModelFallback(GOOGLE_MODELS, async (model) => {
      signal?.throwIfAborted();
      update('');
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse`, {
        method: 'POST', signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 8192 },
        }),
      });
      if (!response.ok) throw new Error(`Gemini API error: ${response.status}`);
      if (!response.body) throw new Error('AI 응답 스트림이 없습니다.');
      return readProviderStream(response.body, provider, update);
    });
  }
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001', max_tokens: 4096, stream: true,
      system: SYSTEM_PROMPT, messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
  if (!response.body) throw new Error('AI 응답 스트림이 없습니다.');
  return readProviderStream(response.body, provider, update);
}
