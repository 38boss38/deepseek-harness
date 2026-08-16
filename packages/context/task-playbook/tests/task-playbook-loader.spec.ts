import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { SessionEvent } from '@deepseek-ai/dsh-session'
import { LOADER_SMOKE_TEST_TIMEOUT_MS, runLoaderSmoke } from '@deepseek-ai/dsh-loader-smoke'

const fixture = fileURLToPath(new URL(
  '../../../../examples/headless-agent/tests/fixtures/personal-harness/',
  import.meta.url,
))
const driver = join(fixture, 'task-playbook-driver.ts')
const configPath = join(fixture, 'cordis.yml')
const repoTsconfig = fileURLToPath(new URL('../../../../tsconfig.json', import.meta.url))

async function jsonlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return jsonlFiles(path)
    return entry.isFile() && entry.name.endsWith('.jsonl') ? [path] : []
  }))
  return paths.flat()
}

describe('Task Playbook through a real headless cordis.yml', () => {
  it('persists the exact route-specific model context', async () => {
    let events: SessionEvent[] = []
    await runLoaderSmoke({
      label: 'task-playbook headless smoke',
      tempDirPrefix: 'task-playbook-e2e-',
      binScript: driver,
      libBinScript: driver,
      configPath,
      tsconfigPath: repoTsconfig,
      inspect: async (cwd) => {
        const logs = await jsonlFiles(join(cwd, '.sessions'))
        expect(logs).toHaveLength(1)
        const lines = (await readFile(logs[0] as string, 'utf8')).trimEnd().split('\n')
        events = lines.slice(1).map(line => JSON.parse(line) as SessionEvent)
      },
    })
    const contexts = events.filter(
      (event): event is SessionEvent<'user/message'> => event.type === 'user/message'
        && (event.data.source.kind === 'task-route' || event.data.source.kind === 'task-playbook'),
    )
    expect(contexts.map(event => event.data.source.kind)).toEqual(['task-playbook', 'task-route'])
    expect(contexts.map(event => event.data.content[0]?.type === 'text' ? event.data.content[0].text : '')).toMatchInlineSnapshot(`
      [
        "## Active task playbook
      Task id: harness-engineering
      Objective: Build observable Harness plugins through explicit extension points.
      Workflow:
      1. Inspect the owning package contracts.
      2. Implement the smallest sufficient plugin change.
      Completion checks:
      - Focused tests and the real composition pass.
      Cautions:
      - Do not modify the Agent Loop without need.
      Use this playbook only where it fits the current request. It does not override user instructions, active policies, or permission limits.",
        "## Active task route
      Task id: harness-engineering
      Task: Harness engineering
      Purpose: Build and evolve the personal Harness.
      Matched signals: \"DSH\", \"插件\"
      This route applies to the current turn and supersedes earlier task-route messages. Keep recalled memory and execution choices aligned with it. The route grants no permission beyond the current user request.",
      ]
    `)
  }, LOADER_SMOKE_TEST_TIMEOUT_MS)
})
