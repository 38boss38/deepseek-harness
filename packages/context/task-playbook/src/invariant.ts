/** Package-owned durable Task Playbook invariants. @module @deepseek-ai/dsh-task-playbook/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import { TASK_PLAYBOOK_SOURCE_KIND } from './index.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-task-playbook'

/** Cordis companion plugin name. */
export const name = 'task-playbook-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** Validate one durable playbook snapshot's source-to-text relation. */
function validatePlaybook(event: SessionEvent<'user/message'>, fail: InvariantFailure): void {
  const source = event.data.source
  if (source.kind !== TASK_PLAYBOOK_SOURCE_KIND) return
  const raw = source as unknown as Record<string, unknown>
  const taskId = raw['taskId']
  if (raw['form'] !== 'snapshot' || raw['version'] !== 1 || typeof taskId !== 'string' || taskId === '') {
    fail('task-playbook source must carry a versioned task id')
  }
  if (event.data.content.length !== 1 || event.data.content[0]?.type !== 'text') {
    fail('task-playbook messages must contain exactly one text block')
  }
  const text = event.data.content[0].text
  if (!text.startsWith('## Active task playbook\n') || !text.includes(`Task id: ${taskId}\n`)) {
    fail('task-playbook text must identify the task id recorded by its source')
  }
}

/** Validate all package-owned playbooks already present in one session. */
function validateSession(session: Session, fail: InvariantFailure): void {
  for (const event of session.events) {
    if (event.type === 'user/message') validatePlaybook(event, fail)
  }
}

/** Install validation for loaded and newly appended playbook snapshots. */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  for (const session of ctx.sessions.list()) validateSession(session, fail)
  ctx.on('session/created', (session) => { validateSession(session, fail) }, { global: true })
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    if (eventName !== 'session/event') return
    const [, event] = args as [Session, SessionEvent]
    if (event.type === 'user/message') validatePlaybook(event, fail)
  }, { global: true })
}, { inject: ['sessions'] })

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
