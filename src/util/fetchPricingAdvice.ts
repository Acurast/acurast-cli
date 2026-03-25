import { BigNumber } from 'bignumber.js'
import { convertConfigToJob } from '../acurast/convertConfigToJob.js'
import { getMatcherUrlForNetwork } from '../config.js'
import {
  checkMatch,
  getAveragePrice,
  getPriceDistribution,
} from '../services/matcherApi.js'
import { analyzePricing } from './pricingAdvisor.js'
import type { PricingAdvice } from './pricingAdvisor.js'
import { printFeeCosts, printMatcherPricingInfo } from './printFeeCosts.js'
import { filelogger } from './fileLogger.js'
import type { AcurastProjectConfig } from '../types.js'
import { AssignmentStrategyVariant } from '../types.js'
import type { ApiResult } from '../services/matcherApi.js'

/**
 * Fetches live pricing data from the matcher API if available,
 * displays the result, and falls back to static fee estimation on failure.
 *
 * Returns the PricingAdvice if live data was successfully fetched, or undefined.
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
    const job = convertConfigToJob(config)

    const [matchResult, avgPriceResult, distResult] = await Promise.all([
      checkMatch(matcherUrl, config, job, walletAddress),
      getAveragePrice(matcherUrl, job.schedule.duration),
      getPriceDistribution(matcherUrl, job.schedule.duration, 10),
    ])

    spinner.stop()

    if (matchResult.ok && avgPriceResult.ok && distResult.ok) {
      const advice = analyzePricing(
        matchResult.data,
        distResult.data.buckets,
        avgPriceResult.data,
        new BigNumber(config.maxCostPerExecution),
        config.numberOfReplicas
      )
      printMatcherPricingInfo(advice, config, options)
      return advice
    } else {
      const errors = [matchResult, avgPriceResult, distResult]
        .filter((r): r is { ok: false; error: string } => !r.ok)
        .map((r) => r.error)
      filelogger.warn(
        `Matcher API unavailable: ${errors.join(', ')}. Falling back to static fee estimation.`
      )
      printFeeCosts(config, options)
      return undefined
    }
  } catch (err: any) {
    spinner.stop()
    filelogger.warn(
      `Matcher API error: ${err.message}. Falling back to static fee estimation.`
    )
    printFeeCosts(config, options)
    return undefined
  }
}
