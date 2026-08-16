/**
 * Route-specific execution guidance for the personal Harness. The plugin
 * consumes `ctx.taskRouter` and records one bounded, source-attributed
 * playbook snapshot on the first model request of each turn.
 *
 * @module @deepseek-ai/dsh-task-playbook
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { Agent, PreStepDecision } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { TaskDefinition } from '@deepseek-ai/dsh-task-router'

/** Cordis plugin name used by Loader diagnostics. */
export const name = 'task-playbook'

/** Services required to select a route and contribute model context. */
export const inject = ['agents', 'taskRouter']

/** Stable source kind persisted with each model-visible playbook snapshot. */
export const TASK_PLAYBOOK_SOURCE_KIND = 'task-playbook'

/** Execution guidance for one configured task family. */
export interface TaskPlaybookDefinition {
  /** Task Router id that selects this playbook. */
  readonly taskId: string
  /** Outcome the model should optimize within the current user request. */
  readonly objective: string
  /** Ordered operating steps; the model may skip inapplicable steps. */
  readonly workflow: readonly string[]
  /** Observable conditions used before reporting completion. */
  readonly completionChecks: readonly string[]
  /** Task-specific failure modes to avoid. */
  readonly cautions: readonly string[]
}

/** Task Playbook configuration. */
export interface Config {
  /** Maximum UTF-8 bytes in any complete rendered playbook message. */
  readonly maxInjectedBytes: number
  /** Exactly one playbook for every configured Task Router definition. */
  readonly playbooks: readonly TaskPlaybookDefinition[]
}

/** Durable provenance for one model-visible Task Playbook snapshot. */
export interface TaskPlaybookSource {
  readonly kind: typeof TASK_PLAYBOOK_SOURCE_KIND
  readonly form: 'snapshot'
  readonly version: 1
  readonly taskId: string
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'task-playbook': TaskPlaybookSource
  }
}

/** Schemastery validation for {@link Config}. */
export const Config: z<Config> = z.object({
  maxInjectedBytes: z.number().required(),
  playbooks: z.array(z.object({
    taskId: z.string().required(),
    objective: z.string().required(),
    workflow: z.array(z.string()).required(),
    completionChecks: z.array(z.string()).required(),
    cautions: z.array(z.string()).required(),
  })).required(),
}) as z<Config>

/** Whether this turn already owns a durable playbook snapshot. */
function hasPlaybookInTurn(agent: Agent, turn: number): boolean {
  const start = agent.session.events.findLastIndex(
    event => event.type === 'turn/start' && event.data.turn === turn,
  )
  if (start < 0) return false
  return agent.session.events.slice(start + 1).some(event =>
    event.type === 'user/message' && event.data.source.kind === TASK_PLAYBOOK_SOURCE_KIND,
  )
}

/** Normalize one non-empty list and reject duplicate entries. */
function normalizeList(
  taskId: string,
  field: string,
  values: readonly string[],
  allowEmpty: boolean,
): readonly string[] {
  if (!allowEmpty && values.length === 0) {
    throw new TypeError(`task-playbook: ${taskId}.${field} must contain at least one entry`)
  }
  const seen = new Set<string>()
  const normalized = values.map((value) => {
    const text = value.trim()
    if (text === '') throw new TypeError(`task-playbook: ${taskId}.${field} contains an empty entry`)
    if (seen.has(text)) throw new TypeError(`task-playbook: ${taskId}.${field} repeats ${JSON.stringify(text)}`)
    seen.add(text)
    return text
  })
  return Object.freeze(normalized)
}

/**
 * Render the exact Task Playbook snapshot seen by the model.
 * @param playbook - Normalized guidance selected by task id.
 * @returns stable model-visible playbook text.
 */
export function renderTaskPlaybook(playbook: TaskPlaybookDefinition): string {
  const workflow = playbook.workflow.map((step, index) => `${index + 1}. ${step}`).join('\n')
  const checks = playbook.completionChecks.map(check => `- ${check}`).join('\n')
  const cautions = playbook.cautions.length === 0
    ? '- None beyond the active policies and current user request.'
    : playbook.cautions.map(caution => `- ${caution}`).join('\n')
  return '## Active task playbook\n'
    + `Task id: ${playbook.taskId}\n`
    + `Objective: ${playbook.objective}\n`
    + 'Workflow:\n'
    + `${workflow}\n`
    + 'Completion checks:\n'
    + `${checks}\n`
    + 'Cautions:\n'
    + `${cautions}\n`
    + 'Use this playbook only where it fits the current request. It does not override user instructions, active policies, or permission limits.'
}

/** Validate and freeze a complete playbook table against the Task Router taxonomy. */
function resolveConfig(ctx: Context, config: Config): {
  maxInjectedBytes: number
  playbooks: ReadonlyMap<string, TaskPlaybookDefinition>
} {
  if (!Number.isSafeInteger(config.maxInjectedBytes) || config.maxInjectedBytes <= 0) {
    throw new TypeError('task-playbook: maxInjectedBytes must be a positive safe integer')
  }
  const taskIds = new Set(ctx.taskRouter.definitions().map((task: TaskDefinition) => task.id))
  const playbooks = new Map<string, TaskPlaybookDefinition>()
  for (const candidate of config.playbooks) {
    const taskId = candidate.taskId.trim()
    if (!taskIds.has(taskId)) {
      throw new TypeError(`task-playbook: unknown task id ${JSON.stringify(taskId)}`)
    }
    if (playbooks.has(taskId)) {
      throw new TypeError(`task-playbook: duplicate task id ${JSON.stringify(taskId)}`)
    }
    const objective = candidate.objective.trim()
    if (objective === '') throw new TypeError(`task-playbook: ${taskId}.objective must not be empty`)
    const playbook = Object.freeze({
      taskId,
      objective,
      workflow: normalizeList(taskId, 'workflow', candidate.workflow, false),
      completionChecks: normalizeList(taskId, 'completionChecks', candidate.completionChecks, false),
      cautions: normalizeList(taskId, 'cautions', candidate.cautions, true),
    })
    const bytes = Buffer.byteLength(renderTaskPlaybook(playbook), 'utf8')
    if (bytes > config.maxInjectedBytes) {
      throw new TypeError(
        `task-playbook: ${taskId} renders to ${bytes} UTF-8 bytes, exceeding maxInjectedBytes ${config.maxInjectedBytes}`,
      )
    }
    playbooks.set(taskId, playbook)
  }
  const missing = [...taskIds].filter(taskId => !playbooks.has(taskId))
  if (missing.length > 0) {
    throw new TypeError(`task-playbook: missing playbooks for task ids ${missing.map(id => JSON.stringify(id)).join(', ')}`)
  }
  return { maxInjectedBytes: config.maxInjectedBytes, playbooks }
}

/**
 * Register bounded first-step playbook injection for the lifetime of `ctx`.
 * @param ctx - Plugin context carrying the Agent event plane and Task Router.
 * @param config - Complete route-indexed playbook table and rendered byte limit.
 * @throws when the table does not exactly cover the Task Router taxonomy or a rendered playbook exceeds its byte limit.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(ctx, config)
  ctx.on('agent/pre-step', async (
    { agent, turn, step, signal },
    next,
  ): Promise<PreStepDecision> => {
    const decision = await next()
    if (decision.kind === 'reject' || signal.aborted || step !== 1 || hasPlaybookInTurn(agent, turn)) {
      return decision
    }
    const taskId = ctx.taskRouter.resolve(decision.messages).task.id
    const playbook = resolved.playbooks.get(taskId)
    if (playbook === undefined) throw new Error(`task-playbook: validated playbook ${JSON.stringify(taskId)} disappeared`)
    const text = renderTaskPlaybook(playbook)
    if (Buffer.byteLength(text, 'utf8') > resolved.maxInjectedBytes) {
      throw new Error(`task-playbook: rendered playbook ${JSON.stringify(taskId)} exceeded its validated byte limit`)
    }
    return {
      kind: 'enter',
      messages: [
        ...decision.messages,
        createUserMessage({
          content: [{ type: 'text', text }],
          source: {
            kind: TASK_PLAYBOOK_SOURCE_KIND,
            form: 'snapshot',
            version: 1,
            taskId,
          },
        }),
      ],
    }
  })
}
