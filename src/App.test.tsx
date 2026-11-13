import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('./components/ComponentCard', () => ({ ComponentCard: () => null }));
beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: async () => ({ envKeys: { google: false, anthropic: false } }) }));
});

it('restores the selected provider and manual API key after reload', () => {
  const first = render(<App />);
  fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'anthropic' } });
  fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'manual-key' } });
  first.unmount();
  render(<App />);
  expect(screen.getByLabelText('Provider')).toHaveValue('anthropic');
  expect(screen.getByLabelText('API Key')).toHaveValue('manual-key');
  fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'google' } });
  expect(screen.getByLabelText('API Key')).toHaveValue('');
});

it('lets users reuse a persisted prompt from history', () => {
  localStorage.setItem('rcg.promptHistory', JSON.stringify(['saved prompt']));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'saved prompt' }));
  expect(screen.getByRole('textbox', { name: '프롬프트' })).toHaveValue('saved prompt');
});
