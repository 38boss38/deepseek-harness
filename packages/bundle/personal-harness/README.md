# @deepseek-ai/dsh-personal-harness

English | [中文](README.zh.md)

The personal Harness composition bundle. Its patch adds deterministic Task Router, route-specific Task Playbook, and task-scoped durable Memory Flow rows after `@deepseek-ai/dsh-web-app`. Generic behavior stays in reusable context packages; this bundle owns the personal task taxonomy, playbooks, retrieval policy, and explicit budgets. Decision record: [the personal routing, playbook, and memory Agent Note](../../../.agents/notes/implemented/feature/2026-08-16-personal-task-routing-memory-flow.md).

## Package topology

```text
packages/context/task-router/       deterministic route service + durable task context
packages/context/task-playbook/     route-specific workflow + completion context
packages/context/memory-flow/       storage domain + capture/delete tools + recall context
packages/bundle/personal-harness/   personal taxonomy, limits, and profile patch
```

This boundary keeps the Agent Loop unchanged and lets an upstream merge replace core packages without entangling personal policy. `task-playbook` and `memory-flow` consume the explicit `ctx.taskRouter` service rather than parsing task-route prose.

## Profile composition

The bundle expects a preceding Web bundle because Web owns the `storage`, `storage-json`, and `storage-domain` rows. A profile's ordered bundle list is therefore:

```json
{
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        "@deepseek-ai/dsh-personal-harness"
      ]
    }
  }
}
```

From a built checkout, install the local bundle and its linked workspace packages into the Web profile:

```powershell
dsh plugin --profile web add `
  <repo>/packages/bundle/personal-harness `
  <repo>/packages/context/task-router `
  <repo>/packages/context/task-playbook `
  <repo>/packages/context/memory-flow
```

A local directory dependency uses pnpm `link:` and does not materialize the bundle's workspace dependencies, so all four checkout paths are required for local testing. The profile composer activates only the package carrying `dsh.bundle.patch`; the three context packages remain ordinary dependencies. A registry installation resolves declared dependencies normally. A non-Web profile must first mount compatible storage hub, backend, and storage-domain rows.

## Included policy

The taxonomy contains `harness-engineering`, `game-design`, `research`, and `general`. English and Chinese signals and each route's objective, workflow, completion checks, and cautions are explicit in [`cordis.patch.yml`](cordis.patch.yml). The fallback is `general`; each playbook fits 4,096 UTF-8 bytes; always-recalled memory kinds are `preference` and `principle`; one turn can inject at most six entries and 8,192 UTF-8 bytes of recalled-memory context.

Edit this bundle when the personal taxonomy, playbook content, or default policy changes. Edit the reusable packages only when routing, playbook injection, or memory semantics change for every composition.

## Model Experience

### Routed personal context

#### What the model sees

On the first step of an entered turn, the model sees an `Active task route` snapshot and the matching `Active task playbook`. When eligible memory exists, it also sees one subordinate `Recalled personal memory` JSON snapshot. The tool catalog includes `memory_remember` and `memory_forget`.

#### Token effect

Each turn adds one route message, one bounded playbook message, and zero or one bounded memory message. Captured records do not enter history until a later recall selects them.

#### KV Cache effect

All contributions are append-only Session messages after the reusable prefix. The bundle does not generate dynamic system prompt sections.

## Known Limitations and Deferred Work

- **Web-storage prerequisite** — this v1 bundle is an overlay for the Web profile and is not a self-contained surface bundle.
- **Personal policy is checked in** — changing task signals or budgets currently requires editing the patch or overriding its complete config rows in a later user patch.
- **No task-specific toolset yet** — routes select guidance and memory scope, not dynamic tool restrictions, executable workflows, or evaluation suites.
- **No automatic reflection yet** — memory creation remains an explicit model tool action rather than an end-of-turn summarizer.
