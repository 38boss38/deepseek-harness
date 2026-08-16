# @deepseek-ai/dsh-task-playbook

English | [中文](README.zh.md)

Route-specific execution guidance for a personal Harness. The function plugin consumes `ctx.taskRouter`, requires one configured playbook per route, and records the selected playbook as a bounded model-visible Session message on the first step of each turn. It guides execution without changing tool permissions or the Agent Loop. Decision record: [the personal routing, playbook, and memory Agent Note](../../../.agents/notes/implemented/feature/2026-08-16-personal-task-routing-memory-flow.md).

## Configuration

```yaml
- id: task-playbook
  name: '@deepseek-ai/dsh-task-playbook'
  config:
    maxInjectedBytes: 4096
    playbooks:
      - taskId: game-design
        objective: Validate a player-facing design as a small playable hypothesis.
        workflow:
          - State the target player experience and constraints.
          - Define the smallest playable slice and its observations.
        completionChecks:
          - The prototype can support or reject the central hypothesis.
        cautions:
          - Do not present untested tuning values as established balance.
      - taskId: general
        objective: Complete the requested outcome.
        workflow:
          - Identify the outcome.
          - Verify the result.
        completionChecks:
          - The result is observable.
        cautions: []
```

`playbooks` must contain exactly one entry for every `ctx.taskRouter.definitions()` id. Unknown, duplicate, or missing task ids fail plugin load. Objectives and all required lists contain trimmed non-empty unique entries. `cautions` may be empty. Every complete rendered message, including headings and the authority reminder, must fit the positive safe-integer `maxInjectedBytes`; oversized configuration fails before an Agent starts.

## Injection behavior

The plugin classifies the entering message batch with the same Task Router service used by route context and memory scope. Step 1 receives one source `{ kind: "task-playbook", form: "snapshot", version: 1, taskId }`; retries do not duplicate a snapshot already recorded in that turn. The Session log therefore preserves the exact objective, workflow, completion checks, cautions, and authority reminder read by the model.

The playbook is advisory. A workflow step applies only where it fits the current user request, completion checks do not broaden the requested scope, and cautions add no permission. Dynamic tool filtering or executable workflow selection requires a separate enforcing plugin.

## Model Experience

### Active Task Playbook

#### What the model sees

The model receives the selected configuration as one source-attributed message with the following stable structure.

##### Playbook snapshot

```markdown
## Active task playbook
Task id: <task-id>
Objective: <configured-objective>
Workflow:
1. <configured-step>
Completion checks:
- <configured-check>
Cautions:
- <configured-caution-or-default>
Use this playbook only where it fits the current request. It does not override user instructions, active policies, or permission limits.
```

#### Token effect

Each entered turn adds exactly one playbook message bounded by `maxInjectedBytes`. The message remains in derived history until compaction shadows it.

#### KV Cache effect

Append-only. The playbook follows the reusable conversation prefix and does not rewrite system prompt sections.

## Known Limitations and Deferred Work

- **Guidance is not enforcement** — playbooks do not hide tools, deny operations, or force the listed workflow.
- **One playbook per route** — a turn cannot combine multiple route playbooks or select a playbook independently of Task Router.
- **Configuration-owned content** — changing a playbook requires a bundle or later profile patch; there is no user-facing editor.
- **Static byte budget** — the complete configured message is validated at load, but no token-aware compaction occurs inside one playbook.
