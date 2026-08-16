# @deepseek-ai/dsh-task-router

English | [中文](README.zh.md)

Deterministic per-turn task routing exposed as `ctx.taskRouter`. The service classifies the latest direct human message against an ordered route table and appends one durable, model-visible task snapshot to the first step of the turn. It does not change the Agent Loop or infer permissions. Decision record: [the personal task-routing and memory-flow Agent Note](../../../.agents/notes/implemented/feature/2026-08-16-personal-task-routing-memory-flow.md).

## Configuration

```yaml
- id: task-router
  name: '@deepseek-ai/dsh-task-router'
  config:
    fallbackTaskId: general
    tasks:
      - id: game-design
        title: Game design
        purpose: Design player-facing game systems.
        signals: [游戏, 玩法, 关卡, game design]
      - id: general
        title: General execution
        purpose: Handle work that does not match a specialized route.
        signals: []
```

`tasks` is a non-empty ordered table. Ids are unique lowercase kebab-case strings, titles and purposes are non-empty, and signals are non-empty case-insensitive substrings unique within one task. `fallbackTaskId` must name a configured task. Invalid tables fail plugin load.

## Routing contract

- Only the latest `source.kind === "user"` message votes; earlier human messages, tool results, assistant messages, and plugin context do not.
- Every configured signal found as a case-insensitive substring contributes one vote. The task with the most distinct matched signals wins.
- Configuration order breaks equal positive scores. The configured fallback wins only when every task scores zero.
- One task-route message is added on step 1 of a turn. A retry that already durably recorded a route does not add a duplicate.

The service methods `resolve(messages)` and `current(agent)` expose the same classifier to sibling plugins. `current(agent)` derives from durable Session history rather than process-local route state, so task-scoped consumers keep the same semantics after resume. `definitions()` returns the immutable configured table in tie-break order so a dependent plugin can validate complete task coverage without duplicating taxonomy configuration.

## Durable context

The route message uses source `{ kind: "task-route", form: "snapshot", version: 1, taskId, matchedSignals, fallback }`. The message is appended by the Agent Loop after `step/start` and participates in ordinary Session persistence, request reconstruction, and compaction. The snapshot says that it applies only to the current turn, supersedes older route messages, and grants no permission beyond the user's request.

## Model Experience

### Task-route snapshot

#### What the model sees

The injected message has the following stable shape.

##### Route snapshot

```markdown
## Active task route
Task id: <task-id>
Task: <configured-title>
Purpose: <configured-purpose>
Matched signals: <configured-signals-or-fallback>
This route applies to the current turn and supersedes earlier task-route messages. Keep recalled memory and execution choices aligned with it. The route grants no permission beyond the current user request.
```

#### Token effect

One compact snapshot is added per entered turn and remains in derived history until compaction shadows it.

#### KV Cache effect

Append-only. The new route follows the reusable conversation prefix and does not rewrite system prompt sections.

## Known Limitations and Deferred Work

- **Lexical classifier only** — v1 uses configured substring signals and performs no embedding, LLM classification, or semantic fallback.
- **No dynamic tool restriction** — the selected route informs context and sibling plugins but does not yet change the visible tool set or workflow implementation.
- **One route per turn** — a single human turn cannot split into multiple concurrently active task families.
- **Configuration defines taxonomy** — adding or renaming a task is an explicit bundle/profile configuration change; there is no model-authored route table.
