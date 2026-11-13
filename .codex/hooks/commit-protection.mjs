import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir, tmpdir } from 'node:os'
import { spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const reason = 'Commit protection: full tests failed or could not run. Stop this turn and report the failure. Wait for a new user message before taking further actions.'

function deny(message = reason) {
  return { hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    permissionDecision: 'deny',
    permissionDecisionReason: message,
  } }
}

export async function evaluateProtection(event, dependencies) {
  if (dependencies.isBlocked()) return deny()
  const command = event.tool_input?.command ?? event.tool_input?.cmd ?? ''
  if (typeof command !== 'string' || !/\bgit(?:\.exe)?[\s\S]*?\bcommit\b/i.test(command)) return {}
  if (!/^\s*git(?:\.exe)?\s+commit(?:\s|$)/i.test(command) || /[;&|<>\r\n`$]/.test(command)) {
    return deny('Run git commit as a standalone command from this repository. Shell wrappers, global Git options, and compound commands are blocked by commit protection.')
  }
  let passed = false
  try {
    passed = await dependencies.runTests()
  } catch {
    // Missing runtime, timeout, or process errors must deny the commit too.
  }
  if (!passed) {
    dependencies.block()
    return deny()
  }
  return {}
}
export function runFullTests(spawn = spawnSync) {
  const installedBun = join(homedir(), '.bun', 'bin', process.platform === 'win32' ? 'bun.exe' : 'bun')
  const bun = existsSync(installedBun) ? installedBun : 'bun'
  const result = spawn(bun, ['--no-env-file', 'run', 'test'], {
    cwd: fileURLToPath(new URL('../../', import.meta.url)).replace(/[\\/]$/, ''),
    timeout: 240000,
    windowsHide: true,
    stdio: 'ignore',
  })
  return result.status === 0 && !result.error && !result.signal
}

export function createRuntime(event) {
  if (!event.session_id || !event.turn_id) throw new Error('Missing session or turn id')
  const key = createHash('sha256').update(JSON.stringify([
    import.meta.url, event.session_id, event.turn_id,
  ])).digest('hex')
  const marker = join(tmpdir(), `codex-test-gate-${key}.blocked`)
  return {
    runTests: () => runFullTests(),
    isBlocked: () => existsSync(marker),
    block: () => {
      try {
        writeFileSync(marker, '', { flag: 'wx' })
      } catch (error) {
        if (error.code !== 'EEXIST') throw error
      }
    },
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let output
  try {
    const event = JSON.parse(readFileSync(0, 'utf8'))
    output = await evaluateProtection(event, createRuntime(event))
  } catch {
    output = deny()
  }
  process.stdout.write(JSON.stringify(output))
}
