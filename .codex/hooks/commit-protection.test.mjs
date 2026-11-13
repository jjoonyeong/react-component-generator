import assert from 'node:assert/strict'
import { test } from 'node:test'
import { spawnSync } from 'node:child_process'
import * as protection from './commit-protection.mjs'
import { evaluateProtection } from './commit-protection.mjs'

const commit = {
  hook_event_name: 'PreToolUse', tool_name: 'Bash',
  session_id: 'test-session', turn_id: 'test-turn',
  tool_input: { command: 'git commit -m "change"' },
}

test('a failing full test suite denies the commit and latches the turn', async () => {
  let blocked = false
  let runs = 0
  const output = await evaluateProtection(commit, {
    isBlocked: () => blocked,
    block: () => { blocked = true },
    runTests: async () => { runs++; return false },
  })
  assert.equal(runs, 1)
  assert.equal(blocked, true)
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny')
})

test('a blocked turn denies subsequent edits without rerunning tests', async () => {
  const output = await evaluateProtection({ ...commit, tool_name: 'apply_patch', tool_input: { command: 'patch' } }, {
    isBlocked: () => true,
    block: () => assert.fail('already blocked'),
    runTests: async () => assert.fail('must not run tests'),
  })
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny')
})

test('ordinary commands do not run the commit test gate', async () => {
  assert.deepEqual(await evaluateProtection({ ...commit, tool_input: { command: 'git status --short' } }, {
    isBlocked: () => false,
    runTests: async () => assert.fail('not a commit'),
  }), {})
})

test('a test runner error also denies the commit and latches the turn', async () => {
  let blocked = false
  const output = await evaluateProtection(commit, {
    isBlocked: () => false,
    block: () => { blocked = true },
    runTests: async () => { throw new Error('Bun unavailable') },
  })
  assert.equal(blocked, true)
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny')
})

test('the hook executable returns an explicit denial for malformed input', () => {
  const result = spawnSync(process.execPath, ['.codex/hooks/commit-protection.mjs'], {
    input: 'invalid JSON', encoding: 'utf8',
  })
  assert.match(result.stdout, /"permissionDecision":"deny"/)
})

test('runtime state persists for the same turn and a new user turn is unblocked', () => {
  assert.equal(typeof protection.createRuntime, 'function')
  const event = { ...commit, session_id: `test-${process.pid}-${Date.now()}` }
  const first = protection.createRuntime(event)
  assert.equal(first.isBlocked(), false)
  first.block()
  assert.equal(protection.createRuntime(event).isBlocked(), true)
  assert.equal(protection.createRuntime({ ...event, turn_id: 'next-turn' }).isBlocked(), false)
})

test('the runner executes the complete test script from the repo root without env loading', () => {
  assert.equal(typeof protection.runFullTests, 'function')
  const passed = protection.runFullTests((executable, args, options) => {
    assert.match(executable, /bun(?:\.exe)?$/)
    assert.deepEqual(args, ['--no-env-file', 'run', 'test'])
    assert.equal(options.cwd, process.cwd())
    assert.equal(options.timeout, 240000)
    return { status: 0 }
  })
  assert.equal(passed, true)
})

test('a test process with an error never counts as a pass', () => {
  assert.equal(protection.runFullTests(() => ({ status: 0, error: new Error('timeout') })), false)
})

test('compound commands containing a commit are denied before executing anything', async () => {
  const output = await evaluateProtection({ ...commit, tool_input: { command: 'change-files; git commit -m change' } }, {
    isBlocked: () => false,
    runTests: async () => true,
  })
  assert.equal(output.hookSpecificOutput.permissionDecision, 'deny')
})
