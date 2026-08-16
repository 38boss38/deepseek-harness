/** Durable storage declaration for personal Harness memory. @module @deepseek-ai/dsh-memory-flow/src/spec */

import { z } from 'zod'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'

/** Stable personal-memory categories exposed to the model-facing capture tool. */
export const MEMORY_KINDS = ['preference', 'principle', 'decision', 'fact', 'open-loop'] as const

/** Category of one durable memory entry. */
export type MemoryKind = typeof MEMORY_KINDS[number]

/** Whether an entry is shared by every task or fenced to its capture task. */
export type MemoryScope = 'global' | 'task'

/** Durable record for one personal-memory entry. */
export const memoryEntrySchema = z.object({
  id: z.uuid(),
  scope: z.union([z.literal('global'), z.literal('task')]),
  taskId: z.string().min(1).optional(),
  kind: z.union(MEMORY_KINDS.map(kind => z.literal(kind))),
  content: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  createdAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  updatedAt: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
}).superRefine((entry, ctx) => {
  if ((entry.scope === 'task') !== (entry.taskId !== undefined)) {
    ctx.addIssue({
      code: 'custom',
      path: ['taskId'],
      message: 'task-scoped memory must carry taskId and global memory must omit it',
    })
  }
  if (entry.updatedAt < entry.createdAt) {
    ctx.addIssue({
      code: 'custom',
      path: ['updatedAt'],
      message: 'memory updatedAt must not precede createdAt',
    })
  }
})

/** One stored memory record inferred from {@link memoryEntrySchema}. */
export type MemoryEntry = z.infer<typeof memoryEntrySchema>

/** Personal-memory domain, one record per opaque memory id. */
export const memoryDomainSpec = defineDomain({
  name: 'personal_memory',
  version: 0,
  tables: {
    entries: domainTable<string, MemoryEntry>(memoryEntrySchema),
  },
})
