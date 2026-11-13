import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function buildReminder(event, readRules) {
  const input = event.tool_input ?? {}
  const command = input.command ?? input.cmd ?? ''
  let target
  if (event.tool_name === 'apply_patch') {
    const paths = [...command.matchAll(/^\*\*\* (?:Add File|Update File|Delete File|Move to): (.+)$/gm)].map(match => match[1].trim())
    target = paths.some(path => /\.tsx?$/i.test(path))
  } else {
    target = /\.tsx?$/i.test(input.file_path ?? input.path ?? '')
      || /\.tsx?(?=$|[\s'"`;:,)>}\]])/i.test(command)
  }
  if (!target) return {}
  const section = readRules().match(/^# TDD Rule\s*\r?\n([\s\S]*?)(?=^# |$(?![\s\S]))/m)?.[0]?.trim()
  if (!section) throw new Error('AGENTS.md TDD Rule section missing')
  return { hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext: `TypeScript 수정 전 TDD 준수 여부를 확인하라. 대상 경로의 하위 AGENTS.md에 별도 TDD 규칙이 있으면 우선 적용하라. 동작 변경이면 하나의 실패 테스트를 먼저 실행했는지 확인하고, 순수 UI·타입·설정 변경이면 적용 제외 사유를 확인하라.\n\n${section}`,
  } }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let output
  try {
    output = buildReminder(JSON.parse(readFileSync(0, 'utf8')), () =>
      readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8'))
  } catch {
    output = { systemMessage: 'TDD 리마인더를 읽지 못했습니다. TypeScript 수정 전 AGENTS.md의 TDD 규칙을 직접 확인하세요.' }
  }
  process.stdout.write(JSON.stringify(output))
}
