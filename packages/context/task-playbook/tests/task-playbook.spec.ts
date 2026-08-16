import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import AgentRegistry, { agentEvents, type Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import * as TaskPlaybook from '@deepseek-ai/dsh-task-playbook'
import type { Config as TaskPlaybookConfig } from '@deepseek-ai/dsh-task-playbook'
import TaskRouter, { type Config as TaskRouterConfig } from '@deepseek-ai/dsh-task-router'

const SIGNAL = new AbortController().signal
const ROUTER_CONFIG: TaskRouterConfig = {
  fallbackTaskId: 'general',
  tasks: [
    { id: 'harness-engineering', title: 'Harness', purpose: 'Build the Harness.', signals: ['DSH', '插件'] },
    { id: 'general', title: 'General', purpose: 'Handle other work.', signals: [] },
  ],
}
const PLAYBOOK_CONFIG: TaskPlaybookConfig = {
  maxInjectedBytes: 2048,
  playbooks: [
    {
      taskId: 'harness-engineering',
      objective: 'Build observable Harness plugins.',
      workflow: ['Inspect the owning package.', 'Implement through an extension point.'],
      completionChecks: ['Focused tests pass.'],
      cautions: ['Do not modify the Agent Loop without need.'],
    },
    {
      taskId: 'general',
      objective: 'Complete the requested outcome.',
      workflow: ['Identify the outcome.', 'Verify the result.'],
      completionChecks: ['The result is observable.'],
      cautions: [],
    },
  ],
}

function human(text: string) {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

function fakeAgent(session: Session): Agent {
  return { id: session.id, session } as Agent
}

async function harness(config: TaskPlaybookConfig = PLAYBOOK_CONFIG) {
  const ctx = new Context()
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(TaskRouter, ROUTER_CONFIG)
  await ctx.plugin(TaskPlaybook, config)
  return ctx
}

describe('TaskPlaybook', () => {
  it('injects the selected playbook with the durable task route', async () => {
    const ctx = await harness()
    const session = Session.create(SessionId('playbook'))
    session.append('turn/start', { turn: 1 })
    const proposed = human('继续魔改 DSH 插件')
    const decision = await agentEvents(ctx, fakeAgent(session)).waterfall(
      'agent/pre-step',
      { messages: [proposed], turn: 1, step: 1, signal: SIGNAL },
      () => Promise.resolve({ kind: 'enter' as const, messages: [proposed] }),
    )
    expect(decision.kind).toBe('enter')
    if (decision.kind !== 'enter') throw new Error('expected entering decision')
    expect(decision.messages.map(message => message.source.kind)).toEqual(['user', 'task-playbook', 'task-route'])
    const message = decision.messages.find(message => message.source.kind === 'task-playbook')
    expect(message?.source).toEqual({
      kind: 'task-playbook',
      form: 'snapshot',
      version: 1,
      taskId: 'harness-engineering',
    })
    const block = message?.content[0]
    expect(block?.type).toBe('text')
    if (block?.type !== 'text') throw new Error('expected playbook text block')
    expect(block.text).toContain('Objective: Build observable Harness plugins.')
    expect(block.text).toContain('1. Inspect the owning package.')
    expect(block.text).toContain('It does not override user instructions, active policies, or permission limits.')
    await ctx.fiber.dispose()
  })

  it('fails load when playbooks do not exactly cover the router taxonomy', async () => {
    await expect(harness({
      maxInjectedBytes: PLAYBOOK_CONFIG.maxInjectedBytes,
      playbooks: PLAYBOOK_CONFIG.playbooks.slice(0, 1),
    })).rejects.toThrow(/missing playbooks.*general/)
    await expect(harness({
      maxInjectedBytes: PLAYBOOK_CONFIG.maxInjectedBytes,
      playbooks: [
        ...PLAYBOOK_CONFIG.playbooks,
        { ...PLAYBOOK_CONFIG.playbooks[0]!, taskId: 'unknown' },
      ],
    })).rejects.toThrow(/unknown task id/)
  })

  it('enforces the complete rendered byte budget at plugin load', async () => {
    await expect(harness({
      maxInjectedBytes: 16,
      playbooks: PLAYBOOK_CONFIG.playbooks,
    })).rejects.toThrow(/exceeding maxInjectedBytes/)
  })

  it('loads as a function plugin through Loader exports', () => {
    const loader = Object.create(Loader.prototype) as Loader
    const unwrapped: unknown = loader.unwrapExports(TaskPlaybook)
    expect(unwrapped).toMatchObject({
      name: 'task-playbook',
      inject: ['agents', 'taskRouter'],
      apply: TaskPlaybook.apply,
    })
    expect('default' in TaskPlaybook).toBe(false)
  })
})
