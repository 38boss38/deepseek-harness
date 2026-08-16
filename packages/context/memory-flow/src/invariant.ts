/** Package-owned recalled-memory invariants. @module @deepseek-ai/dsh-memory-flow/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import { MEMORY_RECALL_SOURCE_KIND } from './index.ts'

const PACKAGE_NAME = '@deepseek-ai/dsh-memory-flow'

/** Cordis companion plugin name. */
export const name = 'memory-flow-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** Validate one model-visible recall's versioned durable provenance. */
function validateRecall(event: SessionEvent<'user/message'>, fail: InvariantFailure): void {
  const source = event.data.source
  if (source.kind !== MEMORY_RECALL_SOURCE_KIND) return
  const raw = source as unknown as Record<string, unknown>
  const memoryIds = raw['memoryIds']
  if (raw['form'] !== 'recall' || raw['version'] !== 1
    || typeof raw['taskId'] !== 'string' || raw['taskId'] === ''
    || !Array.isArray(memoryIds) || memoryIds.length === 0
    || !memoryIds.every(id => typeof id === 'string')
    || new Set(memoryIds).size !== memoryIds.length) {
    fail('memory-recall source must carry one versioned task-scoped id list')
  }
  if (event.data.content.length !== 1 || event.data.content[0]?.type !== 'text') {
    fail('memory-recall messages must contain exactly one text block')
  }
  const text = event.data.content[0].text
  if (!text.startsWith('## Recalled personal memory\n')
    || !text.includes('<personal-memory>\n')
    || !text.endsWith('\n</personal-memory>')) {
    fail('memory-recall text must retain the subordinate-memory wrapper')
  }
  for (const id of memoryIds) {
    if (!text.includes(JSON.stringify(id))) fail(`memory-recall text omitted source id ${JSON.stringify(id)}`)
  }
}

/** Validate all package-owned recall messages in one Session. */
function validateSession(session: Session, fail: InvariantFailure): void {
  for (const event of session.events) {
    if (event.type === 'user/message') validateRecall(event, fail)
  }
}

/** Install validation for loaded and newly appended recall messages. */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  for (const session of ctx.sessions.list()) validateSession(session, fail)
  ctx.on('session/created', (session) => { validateSession(session, fail) }, { global: true })
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    if (eventName !== 'session/event') return
    const [, event] = args as [Session, SessionEvent]
    if (event.type === 'user/message') validateRecall(event, fail)
  }, { global: true })
}, { inject: ['sessions'] })

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
