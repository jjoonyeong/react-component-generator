import { describe, it, expect } from 'vitest';
import { validatePromptLength } from './validatePromptLength';

describe('validatePromptLength', () => {
  it.each([0, 1, 499, 500])('%i자는 길이 제한 내다', (length) => {
    expect(validatePromptLength('가'.repeat(length))).toBe(true);
  });

  it('500자를 초과하면 유효하지 않다', () => {
    expect(validatePromptLength('가'.repeat(501))).toBe(false);
  });
});
