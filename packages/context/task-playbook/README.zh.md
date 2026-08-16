# @deepseek-ai/dsh-task-playbook

[English](README.md) | 中文

个人 Harness 的任务专属行动手册（Task Playbook）。该函数插件消费 `ctx.taskRouter`，要求每条路由对应一个已配置行动手册，并在每轮第一个步骤把所选手册记录成有界、模型可见的会话消息。它指导执行，但不改变工具权限或 agent loop（智能体循环）。决策记录：[个人路由、行动手册与记忆 Agent Note](../../../.agents/notes/implemented/feature/2026-08-16-personal-task-routing-memory-flow.md)。

## 配置

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

`playbooks` 必须为 `ctx.taskRouter.definitions()` 的每个 id 恰好提供一个条目。未知、重复或缺失的任务 id 会使插件加载失败。目标和所有必填列表包含经去除首尾空白的非空唯一条目；`cautions` 可以为空。包括标题与权限提醒在内的每条完整渲染消息必须符合正安全整数 `maxInjectedBytes`；过大的配置会在 agent 启动前失败。

## 注入行为

插件使用路由上下文和记忆范围共同消费的 Task Router 服务，对即将进入步骤的消息批次分类。步骤 1 获得一个来源 `{ kind: "task-playbook", form: "snapshot", version: 1, taskId }`；已在该轮记录快照的重试不会重复注入。因此会话日志保存模型实际读取的目标、工作流、完成检查、注意事项与权限提醒。

行动手册只提供指导。工作流步骤仅在适合当前用户请求时适用，完成检查不会扩大请求范围，注意事项也不授予权限。动态工具筛选或可执行工作流选择需要独立的强制执行插件。

## 模型体验

### 活跃任务行动手册

#### 模型看到的内容

模型以一条带来源的消息接收所选配置，消息具有以下稳定结构。

##### 行动手册快照

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

#### Token 影响

每个进入的轮次恰好添加一条受 `maxInjectedBytes` 限制的行动手册消息。该消息保留在派生历史中，直到压缩将其遮蔽。

#### KV Cache 影响

仅追加。行动手册跟在可复用对话前缀之后，不会重写系统提示词段落。

## 已知限制与暂缓事项

- **指导不是强制执行**：行动手册不会隐藏工具、拒绝操作或强制遵循所列工作流。
- **每条路由一个行动手册**：一个轮次不能组合多份路由手册，也不能脱离 Task Router 独立选择手册。
- **配置拥有内容**：修改行动手册需要编辑组合包或后续 profile patch；尚无面向用户的编辑器。
- **静态字节预算**：完整配置消息在加载时校验，但单份行动手册内部不执行 token 感知压缩。
