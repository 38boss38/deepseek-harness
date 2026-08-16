# Agent Note: Personal task routing, playbooks, and memory flow

Status: implemented

English | [中文](2026-08-16-personal-task-routing-memory-flow.zh.md)

## Problem

A personal Harness needs stable task identity, route-specific execution discipline, and reusable memory without turning the core Agent Loop into a user-specific policy engine. Plain prompt instructions cannot provide deterministic routing, complete taxonomy coverage, durable provenance, task isolation, or deletion, while invisible context would let model behavior depend on data absent from the Session log.

## Decision

Personal routing, playbooks, and memory ship as three context packages plus one composition bundle. [`dsh-task-router`](../../../../packages/context/task-router/README.md) selects one configured task from the latest direct human message and records a versioned route snapshot on the first step. [`dsh-task-playbook`](../../../../packages/context/task-playbook/README.md) requires exactly one bounded playbook per configured route and records the selected objective, workflow, completion checks, and cautions. [`dsh-memory-flow`](../../../../packages/context/memory-flow/README.md) consumes `ctx.taskRouter`, stores explicit model-tool captures in a storage-domain table, retrieves only global entries and entries belonging to the selected task, and records the exact bounded recall as a versioned Session message. [`dsh-personal-harness`](../../../../packages/bundle/personal-harness/README.md) owns the personal taxonomy, playbook contents, and budgets as an overlay after the Web bundle.

No core Agent Loop file changes. All model-visible contributions travel through `agent/pre-step` and become ordinary durable user messages before inference. The task source records `taskId`, matched signals, and fallback status; the playbook source records its `taskId`; the recall source records `taskId` and memory ids. Playbooks explicitly remain subordinate to the current request and active policy. Memory text is fallible, tag-delimited, and cannot confer permission.

## Routing, playbook, and memory contract

Task scoring is deterministic: count distinct configured substring signals in the latest direct human message, choose the greatest positive score, break ties by configuration order, and use the configured fallback only when all scores are zero. One route is active per turn.

The Task Router exposes its immutable taxonomy in tie-break order. Task Playbook configuration must cover that table exactly; unknown, duplicate, and missing task ids fail load. Each complete rendered playbook must fit its configured UTF-8 byte budget before any Agent starts. A playbook guides execution but neither grants permission nor enforces tools or operations.

Memory capture is explicit through `memory_remember`; every entry has global or task scope, a closed kind, bounded content, and bounded retrieval tags. Task scope is stamped from the same Task Router service used by recall. Retrieval excludes other task ids, ranks eligible entries by matched tags, task locality, recency, and stable id, then enforces both entry-count and complete-message byte budgets. `memory_forget` provides idempotent deletion.

The composition does not dynamically change tool visibility, select executable workflows, or summarize turns automatically. These remain separate decisions because they introduce enforcement, lifecycle, and evaluation requirements beyond durable context selection.

## Verification

Package tests pin route scoring and fallback, complete playbook coverage, durable source fields, task memory isolation, deletion, recall ordering, byte and capture limits, composed pre-step messages, real ToolRuntime registrations, Loader export forms, and the parseable personal bundle patch. A keyless headless composition boots through the real Loader and snapshots the exact route and playbook messages persisted before the mock model request. Package invariants validate versioned route, playbook, and recall source-to-text relations for loaded and newly appended Session events.

## Alternatives considered

**Put routing, playbooks, and memory in the system prompt.** This loses per-turn durable provenance, cannot express storage mutation or deletion, and makes replay depend on configuration rather than the exact context read during inference.

**Embed playbooks in Task Router definitions.** This makes lexical classification own execution policy and forces every reusable Router consumer to carry model-facing guidance. A separate plugin can require complete taxonomy coverage while allowing another composition to reuse routing without playbooks.

**Modify Agent Loop with personal state.** This reduces package boundaries and conflicts with upstream evolution even though both behaviors fit existing pre-step, tool, and storage extension points.

**Use semantic routing and vector search immediately.** That adds model or embedding providers, nondeterministic ranking, index lifecycle, and evaluation requirements before the personal taxonomy and memory discipline have evidence that lexical routing is insufficient.

**Store memory globally without task scope.** This is simpler but allows game-design decisions to leak into Harness engineering and makes retrieval quality degrade as unrelated notes accumulate.

## Consequences

The personal fork gains an observable context pipeline without forking the execution loop: route selection is explainable, each task receives explicit execution guidance, memory is durable and deletable, and task scope is shared through one service. The cost is a lexical classifier, checked-in playbook maintenance, explicit capture discipline, one storage prerequisite, and additional per-turn tokens. Future dynamic tool routing, automatic reflection, semantic retrieval, provenance UI, and evaluation must build on these logged records instead of bypassing them.
