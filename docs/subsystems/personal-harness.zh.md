# 个人 Harness 上下文

[English](personal-harness.md) | 中文

任务路由、任务专属执行行动手册与持久个人记忆，是由[个人 Harness 组合包](../../packages/bundle/personal-harness/README.md)组装的上下文层能力。[Task Router 包](../../packages/context/task-router/README.md)拥有确定性任务选择与 `TaskSelection` 约定。[Task Playbook 包](../../packages/context/task-playbook/README.md)拥有完整路由覆盖、渲染字节限制与持久执行指导。[Memory Flow 包](../../packages/context/memory-flow/README.md)拥有 `RememberMemoryInput`、持久 `MemoryEntry` 记录、任务围栏检索与模型可见召回。

## 任务路由

`ctx.taskRouter.resolve(messages)` 分类显式消息列表；`current(agent)` 对 agent（智能体）的持久派生历史应用同一分类器；`definitions()` 按平局决胜顺序暴露不可变分类体系。路由快照是会话消息，而不是进程本地状态。

## 任务行动手册

Task Playbook 函数插件在加载时校验每个 Router 定义恰好对应一个 `TaskPlaybookDefinition`。每项定义携带目标、有序工作流、完成检查和注意事项。每轮第一个步骤会在确认完整渲染文本符合 `maxInjectedBytes` 后，把所选定义记录为一条 `task-playbook` 消息。包 README 拥有配置、指导权威性、模型体验与限制。

## 个人记忆

`ctx.memoryFlow.remember(agent, input)` 存储规范化的任务或全局范围条目，`recall(taskId, messages)` 返回一个任务的有界确定性选择，`forget(id)` 以幂等方式删除。`RememberMemoryInput` 携带范围、封闭类别、内容和检索标签。`MemoryEntry` 另加不透明 id、可选任务 id 与时间戳。

路由与记忆包 README 拥有各自配置、排序、信任、模型体验与限制。本页只拥有共享子系统行为和服务 API 查询界面。

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
