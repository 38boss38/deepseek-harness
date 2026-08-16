/**
 * Deterministic task routing for one user turn. The selected route is emitted
 * as durable, source-attributed model context and is also available through
 * `ctx.taskRouter` to sibling personal-harness plugins.
 *
 * @module @deepseek-ai/dsh-task-router
 */

import { Context, Service } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Message } from '@deepseek-ai/dsh-llm'

/** Stable route-source kind persisted in Session user messages. */
export const TASK_ROUTE_SOURCE_KIND = 'task-route'

/** One configured task family. Configuration order is the tie-break order. */
export interface TaskDefinition {
  /** Stable lowercase id written to durable route sources and memory scopes. */
  readonly id: string
  /** Short model-visible label. */
  readonly title: string
  /** Model-visible purpose and boundary of the task family. */
  readonly purpose: string
  /** Case-insensitive substrings that vote for this task family. */
  readonly signals: readonly string[]
}

/** Task-router configuration. */
export interface Config {
  /** Route used when no configured signal occurs in the latest human message. */
  readonly fallbackTaskId: string
  /** Ordered, non-empty route table. */
  readonly tasks: readonly TaskDefinition[]
}

/** Immutable result of one deterministic routing decision. */
export interface TaskSelection {
  readonly task: TaskDefinition
  readonly matchedSignals: readonly string[]
  readonly fallback: boolean
}

/** Durable provenance for one model-visible task-route snapshot. */
export interface TaskRouteSource {
  readonly kind: typeof TASK_ROUTE_SOURCE_KIND
  readonly form: 'snapshot'
  readonly version: 1
  readonly taskId: string
  readonly matchedSignals: readonly string[]
  readonly fallback: boolean
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'task-route': TaskRouteSource
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    taskRouter: TaskRouter
  }
}

const TASK_ID = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

/** Copy and validate the route table at the plugin boundary. */
function resolveConfig(config: Config): { fallbackTaskId: string; tasks: readonly TaskDefinition[] } {
  if (!Array.isArray(config.tasks) || config.tasks.length === 0) {
    throw new TypeError('task-router: tasks must contain at least one task definition')
  }
  const ids = new Set<string>()
  const tasks = config.tasks.map((candidate: TaskDefinition) => {
    const id = candidate.id.trim()
    const title = candidate.title.trim()
    const purpose = candidate.purpose.trim()
    if (!TASK_ID.test(id)) {
      throw new TypeError(`task-router: task id ${JSON.stringify(candidate.id)} must be lowercase kebab-case`)
    }
    if (ids.has(id)) throw new TypeError(`task-router: duplicate task id ${JSON.stringify(id)}`)
    ids.add(id)
    if (title === '') throw new TypeError(`task-router: task ${JSON.stringify(id)} must have a non-empty title`)
    if (purpose === '') throw new TypeError(`task-router: task ${JSON.stringify(id)} must have a non-empty purpose`)
    const seen = new Set<string>()
    const signals = candidate.signals.map((signal: string) => signal.trim()).map((signal: string) => {
      if (signal === '') throw new TypeError(`task-router: task ${JSON.stringify(id)} contains an empty signal`)
      const normalized = signal.toLocaleLowerCase()
      if (seen.has(normalized)) {
        throw new TypeError(`task-router: task ${JSON.stringify(id)} repeats signal ${JSON.stringify(signal)}`)
      }
      seen.add(normalized)
      return signal
    })
    return Object.freeze({ id, title, purpose, signals: Object.freeze(signals) })
  })
  const fallbackTaskId = config.fallbackTaskId.trim()
  if (!ids.has(fallbackTaskId)) {
    throw new TypeError(`task-router: fallbackTaskId ${JSON.stringify(fallbackTaskId)} does not name a configured task`)
  }
  return { fallbackTaskId, tasks: Object.freeze(tasks) }
}

/**
 * Join text blocks from the latest direct human-authored user message.
 * @param messages - Derived and proposed model messages.
 * @returns text owned by the latest `source.kind === "user"` message, or an empty string.
 */
export function latestDirectUserText(messages: readonly Message[]): string {
  for (const message of [...messages].reverse()) {
    if (message.role !== 'user' || message.source.kind !== 'user') continue
    return message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
  }
  return ''
}

/** Whether this turn already durably owns one route snapshot. */
function hasRouteInTurn(agent: Agent, turn: number): boolean {
  const start = agent.session.events.findLastIndex(
    event => event.type === 'turn/start' && event.data.turn === turn,
  )
  if (start < 0) return false
  return agent.session.events.slice(start + 1).some(event =>
    event.type === 'user/message' && event.data.source.kind === TASK_ROUTE_SOURCE_KIND,
  )
}

/**
 * Render the exact route snapshot seen by the model.
 * @param selection - Deterministic configured task and its matched signals.
 * @returns stable model-visible task-route text.
 */
export function renderTaskSelection(selection: TaskSelection): string {
  const matched = selection.matchedSignals.length === 0
    ? 'none (fallback route)'
    : selection.matchedSignals.map(signal => JSON.stringify(signal)).join(', ')
  return '## Active task route\n'
    + `Task id: ${selection.task.id}\n`
    + `Task: ${selection.task.title}\n`
    + `Purpose: ${selection.task.purpose}\n`
    + `Matched signals: ${matched}\n`
    + 'This route applies to the current turn and supersedes earlier task-route messages. '
    + 'Keep recalled memory and execution choices aligned with it. The route grants no permission beyond the current user request.'
}

/**
 * Service that resolves configured task families and contributes one durable
 * route snapshot to the first model request of each turn.
 */
export class TaskRouter extends Service {
  static inject = ['agents']

  /** Runtime schema for the ordered route table. */
  static Config = z.object({
    fallbackTaskId: z.string().required(),
    tasks: z.array(z.object({
      id: z.string().required(),
      title: z.string().required(),
      purpose: z.string().required(),
      signals: z.array(z.string()).default([]),
    })).required(),
  }) as z<Config>

  private readonly fallbackTaskId: string
  private readonly tasks: readonly TaskDefinition[]

  /**
   * @param ctx - Host context carrying the Agent event plane.
   * @param config - Ordered task families and fallback route.
   */
  constructor(ctx: Context, config: Config) {
    super(ctx, 'taskRouter')
    const resolved = resolveConfig(config)
    this.fallbackTaskId = resolved.fallbackTaskId
    this.tasks = resolved.tasks
  }

  /** Mount the per-turn model-context contribution. */
  protected [Service.init](): void {
    this.ctx.on('agent/pre-step', async (
      { agent, turn, step, signal },
      next,
    ): Promise<PreStepDecision> => {
      const decision = await next()
      if (decision.kind === 'reject' || signal.aborted || step !== 1 || hasRouteInTurn(agent, turn)) {
        return decision
      }
      const selection = this.resolve(decision.messages)
      const text = renderTaskSelection(selection)
      return {
        kind: 'enter',
        messages: [
          ...decision.messages,
          createUserMessage({
            content: [{ type: 'text', text }],
            source: {
              kind: TASK_ROUTE_SOURCE_KIND,
              form: 'snapshot',
              version: 1,
              taskId: selection.task.id,
              matchedSignals: selection.matchedSignals,
              fallback: selection.fallback,
            },
          }),
        ],
      }
    }, { prepend: true })
  }

  /**
   * Resolve one message history. Most matched signals wins; task-table order
   * breaks ties, and the configured fallback wins when every score is zero.
   * @param messages - Current derived messages plus any proposed pre-step messages.
   * @returns immutable selected task and the matched configured signals.
   */
  resolve(messages: readonly Message[]): TaskSelection {
    const text = latestDirectUserText(messages).toLocaleLowerCase()
    let selected: TaskDefinition | undefined
    let selectedMatches: string[] = []
    for (const task of this.tasks) {
      const matched = task.signals.filter(signal => text.includes(signal.toLocaleLowerCase()))
      if (matched.length > selectedMatches.length) {
        selected = task
        selectedMatches = matched
      }
    }
    const fallback = selected === undefined
    const task = selected ?? this.tasks.find(candidate => candidate.id === this.fallbackTaskId)
    if (task === undefined) throw new Error('task-router: validated fallback task disappeared')
    return Object.freeze({
      task,
      matchedSignals: Object.freeze(selectedMatches),
      fallback,
    })
  }

  /**
   * Resolve the current task directly from an Agent's durable derived history.
   * @param agent - Agent whose latest direct human message owns the route.
   * @returns current deterministic selection.
   */
  current(agent: Agent): TaskSelection {
    return this.resolve(agent.session.deriveMessages())
  }

  /**
   * Return the immutable configured task table in deterministic tie-break order.
   * @returns every configured task definition.
   */
  definitions(): readonly TaskDefinition[] {
    return this.tasks
  }
}

export default TaskRouter
