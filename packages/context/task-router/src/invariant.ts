/** Package-owned durable task-route invariants. @module @deepseek-ai/dsh-task-router/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import { TASK_ROUTE_SOURCE_KIND } from './index.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-task-router'

/** Cordis companion plugin name. */
export const name = 'task-router-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** Validate one durable route snapshot's source-to-text relation. */
function validateRoute(event: SessionEvent<'user/message'>, fail: InvariantFailure): void {
  const source = event.data.source
  if (source.kind !== TASK_ROUTE_SOURCE_KIND) return
  const raw = source as unknown as Record<string, unknown>
  const taskId = raw['taskId']
  if (raw['form'] !== 'snapshot' || raw['version'] !== 1 || typeof taskId !== 'string' || taskId === ''
    || !Array.isArray(raw['matchedSignals']) || typeof raw['fallback'] !== 'boolean') {
    fail('task-route source must carry the versioned task selection snapshot')
  }
  if (event.data.content.length !== 1 || event.data.content[0]?.type !== 'text') {
    fail('task-route messages must contain exactly one text block')
  }
  const text = event.data.content[0].text
  if (!text.startsWith('## Active task route\n') || !text.includes(`Task id: ${taskId}\n`)) {
    fail('task-route text must identify the task id recorded by its source')
  }
}

/** Validate all package-owned routes already present in one session. */
function validateSession(session: Session, fail: InvariantFailure): void {
  for (const event of session.events) {
    if (event.type === 'user/message') validateRoute(event, fail)
  }
}

/** Install validation for loaded and newly appended route snapshots. */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  for (const session of ctx.sessions.list()) validateSession(session, fail)
  ctx.on('session/created', (session) => { validateSession(session, fail) }, { global: true })
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    if (eventName !== 'session/event') return
    const [, event] = args as [Session, SessionEvent]
    if (event.type === 'user/message') validateRoute(event, fail)
  }, { global: true })
}, { inject: ['sessions'] })

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
