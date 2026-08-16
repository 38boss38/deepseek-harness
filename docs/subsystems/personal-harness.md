# Personal Harness Context

English | [中文](personal-harness.zh.md)

Task routing, route-specific execution playbooks, and durable personal memory are context-layer capabilities assembled by the [personal Harness bundle](../../packages/bundle/personal-harness/README.md). The [Task Router package](../../packages/context/task-router/README.md) owns deterministic task selection and the `TaskSelection` contract. The [Task Playbook package](../../packages/context/task-playbook/README.md) owns complete route coverage, rendered byte limits, and durable execution guidance. The [Memory Flow package](../../packages/context/memory-flow/README.md) owns `RememberMemoryInput`, durable `MemoryEntry` records, task-fenced retrieval, and model-visible recall.

## Task routing

`ctx.taskRouter.resolve(messages)` classifies an explicit message list; `current(agent)` applies the same classifier to the Agent's durable derived history; `definitions()` exposes the immutable taxonomy in tie-break order. Route snapshots are Session messages rather than process-local state.

## Task playbooks

The Task Playbook function plugin validates exactly one `TaskPlaybookDefinition` per Router definition at load. Each definition carries an objective, ordered workflow, completion checks, and cautions. The first step of each turn records the selected definition as one `task-playbook` message after verifying that its complete rendered text fits `maxInjectedBytes`. The package README owns configuration, guidance authority, model experience, and limitations.

## Personal memory

`ctx.memoryFlow.remember(agent, input)` stores a normalized task- or global-scope entry, `recall(taskId, messages)` returns the bounded deterministic selection for one task, and `forget(id)` deletes idempotently. `RememberMemoryInput` carries scope, closed kind, content, and retrieval tags. `MemoryEntry` adds its opaque id, optional task id, and timestamps.

The routing and memory package READMEs own their configuration, ranking, trust, model experience, and limitations. This page owns only the shared subsystem behavior and service API lookup surface.

<!-- BEGIN GENERATED cordis-surface (gen-cordis-catalog.ts) — do not edit between markers -->

<a id="cordis-surface"></a>

## Cordis API

Generated from source by `scripts/gen-cordis-catalog.ts` (verified fresh by `pnpm run verify-cordis-catalog` in doc-sync; regenerate with `pnpm run gen-cordis-catalog`) — this section is byte-identical in both language sides of the page. Signature blocks use a `ts cordis-catalog` fence and keep the original source JSDoc; dispatch modes are defined in the [primer](../cordis-primer.md#dispatch-modes), and the framework-inherited `ctx` API lives in [cordis-api/inherited.md](../cordis-api/inherited.md).

<a id="ctxmemoryflow--memoryflow"></a>

### `ctx.memoryFlow` — `MemoryFlow`

Durable task-aware personal-memory service and its model-facing tools.

```ts cordis-catalog
/**
 * Normalize and persist one memory under the Agent's current task route.
 * @param agent - Agent whose current task owns task-scoped memory.
 * @param input - Requested memory fields.
 * @returns the committed immutable entry.
 */
async remember(agent: Agent, input: RememberMemoryInput): Promise<MemoryEntry>

/**
 * Delete one memory idempotently.
 * @param id - Opaque durable entry id.
 * @returns whether a record existed and was deleted.
 */
forget(id: string): Promise<boolean>

/**
 * Retrieve task-eligible entries by configured tags and always-recall kinds.
 * @param taskId - Current deterministic task route.
 * @param messages - Current model history used only for the latest direct user text.
 * @returns ranked immutable entries fitting both count and byte budgets.
 */
recall(taskId: string, messages: readonly Message[]): readonly MemoryEntry[]
```

Types: [Agent](core.md) · [Message](llm-streaming.md)

Source: [`packages/context/memory-flow/src/index.ts:147`](../../packages/context/memory-flow/src/index.ts)

<a id="ctxtaskrouter--taskrouter"></a>

### `ctx.taskRouter` — `TaskRouter`

Service that resolves configured task families and contributes one durable route snapshot to the first model request of each turn.

```ts cordis-catalog
/**
 * Resolve one message history. Most matched signals wins; task-table order
 * breaks ties, and the configured fallback wins when every score is zero.
 * @param messages - Current derived messages plus any proposed pre-step messages.
 * @returns immutable selected task and the matched configured signals.
 */
resolve(messages: readonly Message[]): TaskSelection

/**
 * Resolve the current task directly from an Agent's durable derived history.
 * @param agent - Agent whose latest direct human message owns the route.
 * @returns current deterministic selection.
 */
current(agent: Agent): TaskSelection

/**
 * Return the immutable configured task table in deterministic tie-break order.
 * @returns every configured task definition.
 */
definitions(): readonly TaskDefinition[]
```

Types: [Agent](core.md) · [Message](llm-streaming.md)

Source: [`packages/context/task-router/src/index.ts:154`](../../packages/context/task-router/src/index.ts)
<!-- END GENERATED cordis-surface -->
