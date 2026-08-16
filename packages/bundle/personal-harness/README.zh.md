# @deepseek-ai/dsh-personal-harness

[English](README.md) | 中文

个人 Harness 组合包。它的 patch 在 `@deepseek-ai/dsh-web-app` 之后添加确定性 Task Router、任务专属行动手册（Task Playbook）与任务范围持久 Memory Flow 配置项。通用行为留在可复用上下文包中；本组合包拥有个人任务分类体系、行动手册、检索策略与显式预算。决策记录：[个人路由、行动手册与记忆 Agent Note](../../../.agents/notes/implemented/feature/2026-08-16-personal-task-routing-memory-flow.md)。

## 包拓扑

```text
packages/context/task-router/       deterministic route service + durable task context
packages/context/task-playbook/     route-specific workflow + completion context
packages/context/memory-flow/       storage domain + capture/delete tools + recall context
packages/bundle/personal-harness/   personal taxonomy, limits, and profile patch
```

该边界保持 agent loop（智能体循环）不变，使上游合并能够替换核心包，而不会与个人策略纠缠。`task-playbook` 与 `memory-flow` 消费显式 `ctx.taskRouter` 服务，而不是解析任务路由文本。

## Profile 组装

该组合包要求前置 Web 组合包，因为 Web 拥有 `storage`、`storage-json` 与 `storage-domain` 配置项。因此 profile 的有序组合包列表为：

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

从已构建 checkout 中，把本地组合包及其链接的 workspace 包安装进 Web profile：

```powershell
dsh plugin --profile web add `
  <repo>/packages/bundle/personal-harness `
  <repo>/packages/context/task-router `
  <repo>/packages/context/task-playbook `
  <repo>/packages/context/memory-flow
```

本地目录依赖使用 pnpm `link:`，不会物化组合包的 workspace 依赖，因此本地测试需要全部四条 checkout 路径。Profile 组装器只激活携带 `dsh.bundle.patch` 的包；三个上下文包保留为普通依赖。从注册表安装时会正常解析已声明依赖。非 Web profile 必须先挂载兼容的存储中心、后端与 storage-domain 配置项。

## 内置策略

分类体系包含 `harness-engineering`、`game-design`、`research` 与 `general`。中英文信号，以及各路由的目标、工作流、完成检查和注意事项，都显式写在 [`cordis.patch.yml`](cordis.patch.yml) 中。回退任务为 `general`；每份行动手册不超过 4,096 个 UTF-8 字节；始终召回的记忆类别为 `preference` 与 `principle`；一个轮次最多注入六条记录和 8,192 个 UTF-8 字节的召回记忆上下文。

个人分类体系、行动手册内容或默认策略变化时编辑本组合包。只有每套组装都适用的路由、行动手册注入或记忆语义变化时，才编辑可复用包。

## 模型体验

### 已路由个人上下文

#### 模型看到的内容

在进入轮次的第一个步骤，模型会看到一条 `Active task route` 快照和匹配的 `Active task playbook`。存在合格记忆时，还会看到一条从属的 `Recalled personal memory` JSON 快照。工具目录包含 `memory_remember` 与 `memory_forget`。

#### Token 影响

每轮次添加一条路由消息、一条有界行动手册消息，以及零或一条有界记忆消息。捕获的记录只有在后续召回选中时才进入历史。

#### KV Cache 影响

所有贡献都是可复用前缀之后的仅追加会话消息。本组合包不生成动态系统提示词段落。

## 已知限制与暂缓事项

- **要求 Web 存储**：此 v1 组合包是 Web profile 的 overlay，不是自包含表层组合包。
- **个人策略检入仓库**：更改任务信号或预算目前需要编辑 patch，或在更后的用户 patch 中覆盖完整配置项。
- **尚无任务专属工具集**：路由选择指导与记忆范围，不动态限制工具、可执行工作流或评测套件。
- **尚无自动反思**：记忆创建仍是显式模型工具操作，不是轮次结束时的总结器。
