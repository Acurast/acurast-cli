import { fetchPricingAdvice } from '@acurast/sdk/matcher'
import type {
  AcurastProjectConfig,
  AssignmentStrategyVariant as _,
} from '@acurast/sdk/types'
import { AssignmentStrategyVariant } from '@acurast/sdk/types'
import type { PricingAdvice } from '@acurast/sdk/matcher'
import { getMatcherUrlForNetwork } from '../config.js'
import { printFeeCosts, printMatcherPricingInfo } from './printFeeCosts.js'
import { filelogger } from './fileLogger.js'

/**
 * Thin CLI wrapper over the SDK's `fetchPricingAdvice`: manages the spinner,
 * falls back to the static fee table on failure, and prints the outcome via
 * the CLI's formatters.
 */
export async function fetchAndDisplayPricing(
  config: AcurastProjectConfig,
  walletAddress: string,
  options: { output: 'text' | 'json' },
  spinner: { start: () => void; stop: () => void }
): Promise<PricingAdvice | undefined> {
  const matcherUrl = getMatcherUrlForNetwork(config.network)
  const hasInstantMatch =
    config.assignmentStrategy.type === AssignmentStrategyVariant.Single &&
    config.assignmentStrategy.instantMatch &&
    config.assignmentStrategy.instantMatch.length > 0

  if (!matcherUrl || hasInstantMatch) {
    printFeeCosts(config, options)
    return undefined
  }

  spinner.start()

  try {
    const advice = await fetchPricingAdvice(config, walletAddress, matcherUrl)
    spinner.stop()

    if (advice) {
      printMatcherPricingInfo(advice, config, options)
      return advice
    }

    filelogger.warn(
      'Matcher API unavailable or returned partial data. Falling back to static fee estimation.'
    )
    printFeeCosts(config, options)
    return undefined
  } catch (err: any) {
    spinner.stop()
    filelogger.warn(
      `Matcher API error: ${err.message}. Falling back to static fee estimation.`
    )
    printFeeCosts(config, options)
    return undefined
  }
}
