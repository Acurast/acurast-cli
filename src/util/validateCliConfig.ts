import { validateConfig } from '@acurast/sdk/types'
import type { AcurastProjectConfig } from '@acurast/sdk/types'
import { CLI_NETWORKS, type CliNetwork } from '../config.js'

type SdkValidateResult = ReturnType<typeof validateConfig>

export type CliValidateResult =
  | {
      success: true
      data: AcurastProjectConfig & { network: CliNetwork }
      notes?: SdkValidateResult extends { notes?: infer N } ? N : never
    }
  | {
      success: false
      error: any
      notes?: SdkValidateResult extends { notes?: infer N } ? N : never
    }

/**
 * The SDK's `validateConfig` only accepts `mainnet` or `canary`. We extend it
 * with `devnet` by temporarily swapping `devnet` → `canary` for the schema
 * check, then restoring the user's original network in the returned data.
 *
 * TODO: Add `devnet` support to the SDK and remove this workaround.
 */
/**
 * The SDK's `validateConfig` returns only the fields it knows about, dropping
 * CLI-only ones. `enableDevtools` is such a field — losing it silently
 * disabled devtools snippet injection on every deploy — so it is carried back
 * onto the validated data here.
 */
const preserveCliFields = (result: CliValidateResult, original: unknown): CliValidateResult => {
  if (!result.success || typeof original !== 'object' || original === null) return result
  const enableDevtools = (original as { enableDevtools?: unknown }).enableDevtools
  if (enableDevtools === undefined) return result
  return { ...result, data: { ...result.data, enableDevtools } as typeof result.data }
}

export const validateCliConfig = (config: unknown): CliValidateResult => {
  if (typeof config !== 'object' || config === null) {
    return validateConfig(config) as CliValidateResult
  }

  const network = (config as { network?: unknown }).network

  if (typeof network !== 'string' || !CLI_NETWORKS.includes(network as any)) {
    return {
      success: false,
      error: `Unsupported network "${String(network)}". Supported: ${CLI_NETWORKS.join(', ')}.`,
    }
  }

  if (network !== 'devnet') {
    return preserveCliFields(validateConfig(config) as CliValidateResult, config)
  }

  const normalized = {
    ...(config as Record<string, unknown>),
    network: 'canary',
  }
  const result = validateConfig(normalized) as CliValidateResult

  if (result.success) {
    return preserveCliFields(
      {
        ...result,
        data: {
          ...result.data,
          network: 'devnet',
        } as unknown as AcurastProjectConfig & {
          network: CliNetwork
        },
      },
      config,
    )
  }

  return result
}
