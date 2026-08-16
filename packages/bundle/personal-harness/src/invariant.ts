/** Package-owned invariant companion for the personal Harness bundle. @module @deepseek-ai/dsh-personal-harness/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-personal-harness'

/** Cordis companion plugin name. */
export const name = 'personal-harness-invariant'
/** Service required before the companion can register. */
export const inject = ['invariants']

/** No runtime invariant: the bundle holds no state beyond its separately invariant-checked plugin rows. */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
