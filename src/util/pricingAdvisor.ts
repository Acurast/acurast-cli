import { BigNumber } from 'bignumber.js'
import type {
  MatchCheckResult,
  AveragePriceResult,
  PriceDistributionBucket,
} from '../services/matcherApi.js'

export interface PricingAdvice {
  status: 'sufficient' | 'insufficient' | 'overpaying'
  matchedProcessors: number
  requiredProcessors: number
  currentPrice: BigNumber
  suggestedPrice: BigNumber | null
  averagePrice: BigNumber | null
  distribution: PriceDistributionBucket[]
}

export function analyzePricing(
  matchResult: MatchCheckResult,
  distribution: PriceDistributionBucket[],
  averagePriceResult: AveragePriceResult,
  currentPrice: BigNumber,
  requiredProcessors: number
): PricingAdvice {
  const averagePrice = averagePriceResult.average_price
    ? new BigNumber(averagePriceResult.average_price)
    : null

  const suggestedPrice = computeSuggestedPrice(distribution, requiredProcessors)

  let status: PricingAdvice['status']
  if (matchResult.matched_processors < requiredProcessors) {
    status = 'insufficient'
  } else if (
    suggestedPrice &&
    currentPrice.gt(suggestedPrice.times(1.5))
  ) {
    status = 'overpaying'
  } else {
    status = 'sufficient'
  }

  return {
    status,
    matchedProcessors: matchResult.matched_processors,
    requiredProcessors,
    currentPrice,
    suggestedPrice,
    averagePrice,
    distribution,
  }
}

/**
 * Walk distribution buckets low-to-high, accumulating processor counts
 * until we have enough to cover `requiredProcessors`. The `range_max`
 * of that bucket is the cheapest price covering enough processors.
 */
function computeSuggestedPrice(
  buckets: PriceDistributionBucket[],
  requiredProcessors: number
): BigNumber | null {
  if (buckets.length === 0) return null

  let accumulated = 0
  for (const bucket of buckets) {
    accumulated += bucket.count
    if (accumulated >= requiredProcessors) {
      return new BigNumber(bucket.range_max)
    }
  }

  // Not enough processors in the entire distribution
  // Return the max price in the distribution as a best-effort suggestion
  const lastBucket = buckets[buckets.length - 1]
  return lastBucket ? new BigNumber(lastBucket.range_max) : null
}
