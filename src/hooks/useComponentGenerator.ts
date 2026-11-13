import { useState, useCallback, useRef } from 'react';
import { readEvents } from '../stream';
import type { GeneratedComponent, Provider } from '../types';
import { usePersistentState } from './usePersistentState';

function decodeComponents(value: unknown): GeneratedComponent[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item.id !== 'string' || typeof item.prompt !== 'string' ||
        typeof item.code !== 'string' || typeof item.createdAt !== 'string') return [];
    const createdAt = new Date(item.createdAt);
    return Number.isNaN(createdAt.getTime()) ? [] : [{ ...item, createdAt }];
  });
}

interface UseComponentGeneratorReturn {
  streamingComponent: GeneratedComponent | null;
  components: GeneratedComponent[];
  promptHistory: string[];
  isLoading: boolean;
  error: string | null;
  generate: (prompt: string, apiKey: string | undefined, provider: Provider) => Promise<void>;
  removeComponent: (id: string) => void;
  clearAll: () => void;
}

export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [components, setComponents] = usePersistentState<GeneratedComponent[]>('rcg.components', [], decodeComponents);
  const [isLoading, setIsLoading] = useState(false);
  const [promptHistory, setPromptHistory] = usePersistentState<string[]>('rcg.promptHistory', [],
    (value) => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []);
  const [error, setError] = useState<string | null>(null);
  const [streamingComponent, setStreamingComponent] = useState<GeneratedComponent | null>(null);
  const generating = useRef(false);

  const generate = useCallback(async (prompt: string, apiKey: string | undefined, provider: Provider) => {
    if (generating.current) return;
    generating.current = true;
    const draft: GeneratedComponent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      prompt, code: '', createdAt: new Date(),
    };
    setStreamingComponent(draft);
    setIsLoading(true);
    setError(null);
    setPromptHistory((previous) => [prompt, ...previous.filter((item) => item !== prompt)]);

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
        body: JSON.stringify({ prompt, ...(apiKey && { apiKey }), provider }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to generate component');
      }
      if (res.headers?.get('Content-Type')?.includes('text/event-stream')) {
        if (!res.body) throw new Error('스트림을 읽을 수 없습니다.');
        let completed = false;
        for await (const event of readEvents(res.body)) {
          if (event.error) throw new Error(event.error);
          if (typeof event.code === 'string') {
            draft.code = event.code;
            setStreamingComponent({ ...draft });
          }
          if (event.done) { completed = true; break; }
        }
        if (!completed || !draft.code.trim()) throw new Error('코드 생성이 완료되기 전에 연결이 끊겼습니다.');
      } else {
        const data = await res.json();
        draft.code = data.code;
      }
      setComponents((prev) => [{ ...draft }, ...prev]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      generating.current = false;
      setStreamingComponent(null);
      setIsLoading(false);
    }
  }, [setComponents, setPromptHistory]);

  const removeComponent = useCallback((id: string) => {
    setComponents((prev) => prev.filter((c) => c.id !== id));
  }, [setComponents]);

  const clearAll = useCallback(() => {
    setComponents([]);
  }, [setComponents]);

  return { components, streamingComponent, promptHistory, isLoading, error, generate, removeComponent, clearAll };
}
