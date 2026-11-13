export const MAX_PROMPT_LENGTH = 500;

/** 공백을 포함한 원문 길이를 검사한다. 빈 입력 여부는 별도로 검사한다. */
export function validatePromptLength(prompt: string): boolean {
  return prompt.length <= MAX_PROMPT_LENGTH;
}
