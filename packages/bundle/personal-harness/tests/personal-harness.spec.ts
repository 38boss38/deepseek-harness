import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import * as yaml from 'js-yaml'
import { entryListSchema } from '@deepseek-ai/cordis-plugin-include'

describe('personal Harness bundle', () => {
  it('declares the three ordered plugin rows through a parseable bundle patch', () => {
    const root = fileURLToPath(new URL('..', import.meta.url))
    const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
      dsh?: { bundle?: { patch?: string } }
    }
    expect(manifest.dsh?.bundle?.patch).toBe('./cordis.patch.yml')
    const parsed = yaml.load(readFileSync(resolve(root, 'cordis.patch.yml'), 'utf8'), {
      schema: entryListSchema,
    }) as { insert?: { id?: string; name?: string; config?: Record<string, unknown> }[] }[]
    const rows = parsed.flatMap(patch => patch.insert ?? [])
    expect(rows.map(row => row.id)).toEqual(['task-router', 'task-playbook', 'memory-flow'])
    expect(rows[0]?.name).toBe('@deepseek-ai/dsh-task-router')
    expect(rows[1]?.name).toBe('@deepseek-ai/dsh-task-playbook')
    expect(rows[2]?.name).toBe('@deepseek-ai/dsh-memory-flow')
    expect(rows[0]?.config?.['fallbackTaskId']).toBe('general')
    expect(rows[1]?.config?.['maxInjectedBytes']).toBe(4096)
    expect(rows[2]?.config?.['alwaysRecallKinds']).toEqual(['preference', 'principle'])
  })
})
