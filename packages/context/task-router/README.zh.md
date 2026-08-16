# @deepseek-ai/dsh-task-router

[English](README.md) | 中文

以 `ctx.taskRouter` 暴露的确定性逐轮次任务路由。该服务根据有序路由表分类最新一条人类直接消息，并在本轮次的第一个步骤追加一条持久、模型可见的任务快照。它不改变 agent loop（智能体循环），也不推断权限。决策记录：[个人任务路由与记忆流 Agent Note](../../../.agents/notes/implemented/feature/2026-08-16-personal-task-routing-memory-flow.md)。

## 配置

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

`tasks` 是非空有序表。id 必须是唯一的小写 kebab-case 字符串，标题和用途不能为空，信号必须是同一任务内唯一、非空且不区分大小写的子字符串。`fallbackTaskId` 必须指向已配置任务。无效表会使插件加载失败。

## 路由约定

- 只有最新一条 `source.kind === "user"` 消息参与投票；更早的人类消息、工具结果、助手消息和插件上下文均不参与。
- 每个以不区分大小写子字符串形式出现的已配置信号贡献一票。匹配不同信号数量最多的任务获胜。
- 正分相同时按配置顺序打破平局。只有所有任务均为零分时才选择已配置回退任务。
- 每轮次的步骤 1 添加一条任务路由消息。已持久记录路由的重试不会添加重复消息。

服务方法 `resolve(messages)` 和 `current(agent)` 向同级插件暴露同一分类器。`current(agent)` 从持久会话历史派生，而不依赖进程本地路由状态，因此任务范围消费方在恢复后仍保持相同语义。`definitions()` 按平局决胜顺序返回不可变的已配置表，使依赖插件能够校验任务覆盖完整性，而不重复配置分类体系。

## 持久上下文

路由消息使用来源 `{ kind: "task-route", form: "snapshot", version: 1, taskId, matchedSignals, fallback }`。消息由 agent loop 在 `step/start` 之后追加，并参与普通会话持久化、请求重建与压缩。快照会说明它仅适用于当前轮次、覆盖更早的路由消息，并且不会授予超出用户请求的权限。

## 模型体验

### 任务路由快照

#### 模型看到的内容

注入消息具有以下稳定形状。

##### 路由快照

```markdown
## Active task route
Task id: <task-id>
Task: <configured-title>
Purpose: <configured-purpose>
Matched signals: <configured-signals-or-fallback>
This route applies to the current turn and supersedes earlier task-route messages. Keep recalled memory and execution choices aligned with it. The route grants no permission beyond the current user request.
```

#### Token 影响

每个进入的轮次添加一条紧凑快照，并保留在派生历史中，直到压缩将其遮蔽。

#### KV Cache 影响

仅追加。新路由跟在可复用对话前缀之后，不会重写系统提示词段落。

## 已知限制与暂缓事项

- **仅词法分类器**：v1 使用已配置子字符串信号，不执行嵌入、LLM（大语言模型）分类或语义回退。
- **不动态限制工具**：所选路由会告知上下文和同级插件，但尚不改变可见工具集或工作流实现。
- **每轮次一个路由**：单个人类轮次无法拆成多个同时活跃的任务类别。
- **配置定义分类体系**：添加或重命名任务是显式的组合包／profile 配置变更，不存在由模型编写的路由表。
