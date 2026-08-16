import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import AgentRegistry, { agentEvents, type Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { Session, SessionId } from '@deepseek-ai/dsh-session'
import TaskRouter, { type Config } from '@deepseek-ai/dsh-task-router'

const SIGNAL = new AbortController().signal
const CONFIG: Config = {
  fallbackTaskId: 'general',
  tasks: [
    {
      id: 'harness-engineering',
      title: 'Harness engineering',
      purpose: 'Build and evolve the personal agent harness.',
      signals: ['harness', 'DSH', '插件'],
    },
    {
      id: 'game-design',
      title: 'Game design',
      purpose: 'Design player-facing game systems.',
      signals: ['游戏', '关卡', '玩法'],
    },
    {
      id: 'general',
      title: 'General',
      purpose: 'Handle work that does not match a specialized route.',
      signals: [],
    },
  ],
}

function message(text: string) {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

function fakeAgent(session: Session): Agent {
  return { id: session.id, session } as Agent
}

async function harness(config: Config = CONFIG) {
  const ctx = new Context()
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(TaskRouter, config)
  return ctx
}

describe('TaskRouter', () => {
  it('selects the most matched task and uses configuration order as a stable tie-break', async () => {
    const ctx = await harness()
    const game = ctx.taskRouter.resolve([message('帮我分析这个游戏关卡和玩法')])
    expect(game.task.id).toBe('game-design')
    expect(game.matchedSignals).toEqual(['游戏', '关卡', '玩法'])
    expect(game.fallback).toBe(false)

    const tie = ctx.taskRouter.resolve([message('为游戏插件设计一个 harness')])
    expect(tie.task.id).toBe('harness-engineering')
    expect(tie.matchedSignals).toEqual(['harness', '插件'])
    await ctx.fiber.dispose()
  })

  it('falls back when no signal matches', async () => {
    const ctx = await harness()
    const selection = ctx.taskRouter.resolve([message('明天下午提醒我喝水')])
    expect(selection.task.id).toBe('general')
    expect(selection.matchedSignals).toEqual([])
    expect(selection.fallback).toBe(true)
    await ctx.fiber.dispose()
  })

  it('exposes the immutable configured taxonomy to dependent plugins', async () => {
    const ctx = await harness()
    expect(ctx.taskRouter.definitions().map(task => task.id)).toEqual([
      'harness-engineering',
      'game-design',
      'general',
    ])
    expect(Object.isFrozen(ctx.taskRouter.definitions())).toBe(true)
    await ctx.fiber.dispose()
  })

  it('injects one durable-source-shaped route on the first step', async () => {
    const ctx = await harness()
    const session = Session.create(SessionId('route'))
    session.append('turn/start', { turn: 1 })
    const proposed = message('继续魔改 DSH 的插件')
    const decision = await agentEvents(ctx, fakeAgent(session)).waterfall(
      'agent/pre-step',
      { messages: [proposed], turn: 1, step: 1, signal: SIGNAL },
      () => Promise.resolve({ kind: 'enter' as const, messages: [proposed] }),
    )
    expect(decision.kind).toBe('enter')
    if (decision.kind !== 'enter') throw new Error('expected entering decision')
    const route = decision.messages.at(-1)
    expect(route?.source).toEqual({
      kind: 'task-route',
      form: 'snapshot',
      version: 1,
      taskId: 'harness-engineering',
      matchedSignals: ['DSH', '插件'],
      fallback: false,
    })
    const routeBlock = route?.content[0]
    expect(routeBlock?.type).toBe('text')
    if (routeBlock?.type !== 'text') throw new Error('expected route text block')
    expect(routeBlock.text).toContain('Task id: harness-engineering')
    await ctx.fiber.dispose()
  })

  it('fails loud for ambiguous route tables', async () => {
    await expect(harness({
      fallbackTaskId: 'missing',
      tasks: [{ id: 'general', title: 'General', purpose: 'Fallback.', signals: [] }],
    })).rejects.toThrow(/fallbackTaskId/)
    await expect(harness({
      fallbackTaskId: 'general',
      tasks: [
        { id: 'general', title: 'General', purpose: 'Fallback.', signals: [] },
        { id: 'general', title: 'Again', purpose: 'Duplicate.', signals: [] },
      ],
    })).rejects.toThrow(/duplicate task id/)
  })

  it('loads as a service-class plugin through Loader exports', () => {
    const loader = Object.create(Loader.prototype) as Loader
    expect(loader.unwrapExports(TaskRouter)).toBe(TaskRouter)
    expect(TaskRouter.inject).toEqual(['agents'])
    expect(TaskRouter.Config).toBeDefined()
  })
})
