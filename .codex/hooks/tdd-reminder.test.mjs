import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import { buildReminder } from './tdd-reminder.mjs'

const rules = '# Other\nprivate context\n\n# TDD Rule\n\nRED before GREEN.\n## Steps\nRun the failing test.\n\n# Project Context\nnot part of TDD\n'

test('before a TSX patch, inject the current TDD section and a compliance check', () => {
  const output = buildReminder({
    tool_name: 'apply_patch',
    tool_input: { command: '*** Begin Patch\n*** Update File: src/App.tsx\n@@\n-old\n+new\n*** End Patch' },
  }, () => rules)
  assert.equal(output.hookSpecificOutput.hookEventName, 'PreToolUse')
  const context = output.hookSpecificOutput.additionalContext
  assert.match(context, /RED before GREEN/)
  assert.match(context, /Run the failing test/)
  assert.match(context, /하위.*AGENTS\.md/)
  assert.doesNotMatch(context, /private context|not part of TDD/)
})

test('a non-TypeScript patch stays quiet even when its body mentions a TSX file', () => {
  assert.deepEqual(buildReminder({
    tool_name: 'apply_patch',
    tool_input: { command: '*** Begin Patch\n*** Update File: README.md\n@@\n+See App.tsx\n*** End Patch' },
  }, () => assert.fail('must not read AGENTS.md')), {})
})

test('file-writing and shell tools also remind before explicit TypeScript targets', () => {
  for (const event of [
    { tool_name: 'Write', tool_input: { file_path: 'src/new.ts' } },
    { tool_name: 'Bash', tool_input: { command: 'Set-Content src/new.tsx "code"' } },
    { tool_name: 'Bash', tool_input: { cmd: 'cat > src/new.ts' } },
  ]) {
    assert.match(buildReminder(event, () => rules).hookSpecificOutput.additionalContext, /RED before GREEN/)
  }
})

test('the reminder executable reads the real root AGENTS.md TDD section', () => {
  const result = spawnSync(process.execPath, ['.codex/hooks/tdd-reminder.mjs'], {
    input: JSON.stringify({ tool_name: 'Write', tool_input: { file_path: 'src/new.ts' } }),
    encoding: 'utf8',
  })
  assert.match(result.stdout, /RED-GREEN-REFACTOR/)
  assert.match(result.stdout, /삭제 강제 규칙/)
})

test('a missing TDD section is reported instead of injecting undefined rules', () => {
  assert.throws(() => buildReminder({
    tool_name: 'Write', tool_input: { file_path: 'new.ts' },
  }, () => '# No TDD section'), /TDD/)
})
