#!/usr/bin/env node
/** Test driver that sends one routed turn through a Headless Loader composition. */

import { boot, resolveConfigPath } from '@deepseek-ai/dsh-app-boot'
import { runFixtureTurn } from '@deepseek-ai/dsh-loader-smoke'

const configPath = process.argv[2]
if (configPath === undefined) throw new Error('task-playbook driver requires a config path')

const ctx = await boot('task-playbook-e2e', resolveConfigPath(configPath, undefined))
try {
  await runFixtureTurn(ctx, { task: '继续魔改 DSH 插件架构' })
} finally {
  await ctx.fiber.dispose()
}
