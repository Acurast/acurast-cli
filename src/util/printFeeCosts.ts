import type { AcurastProjectConfig } from '../types.js'
import { getFeeAnalysis, toCacu } from '../util/getFeeAnalysis.js'
import { pluralize } from '../util/pluralize.js'
import { red, green, yellow } from 'ansis'
import { acurastColor } from '../util.js'
import { consoleOutput } from './console-output.js'
import { getSymbolForNetwork } from '../config.js'
import type { PricingAdvice } from './pricingAdvisor.js'
import { BigNumber } from 'bignumber.js'

export const printFeeCosts = (
  config: AcurastProjectConfig,
  options: { output: 'text' | 'json' }
) => {
  const log = consoleOutput(options.output)
  const toAcurastColor = (text: string) => {
    if (options.output === 'json') {
      return text
    }
    return acurastColor(text)
  }

  if (options.output === 'text') {
    log(
      yellow(
        'Note: Live market pricing is unavailable. The estimates below use a legacy formula and may not reflect actual processor prices. Re-run with network access for accurate pricing.'
      )
    )
    log('')
  }

  const symbol = getSymbolForNetwork(config.network)

  const feeAnalysis = getFeeAnalysis(config)

  const numberOfExecutions = feeAnalysis.numberOfExecutions.toNumber()
  const numberOfReplicas = feeAnalysis.numberOfReplicas.toNumber()
  const totalRuns = feeAnalysis.totalRuns.toNumber()

  const suggestedCostPerExecution = feeAnalysis.suggestedCostPerExecution
  const maxCostPerExecution = feeAnalysis.maxCostPerExecution
  const maxCostPerExecutionCACU = feeAnalysis.maxCostPerExecutionCACU
  const maxCostPerExecutionPerReplicaCACU =
    feeAnalysis.maxCostPerExecutionPerReplicaCACU

  const excessCostPerExecution = feeAnalysis.excessCostPerExecution
  const excessCostPerExecutionPercentage =
    feeAnalysis.excessCostPerExecutionPercentage

  const maxTotalCostCACU = feeAnalysis.maxTotalCostCACU

  const suggestedFeeString = `Suggested fee: ${toAcurastColor(toCacu(suggestedCostPerExecution).toFixed())} ${symbol} (${suggestedCostPerExecution.toFixed()}), your max fee: ${toAcurastColor(toCacu(maxCostPerExecution).toFixed())} ${symbol} (${maxCostPerExecution.toFixed()}), excess: ${toAcurastColor(toCacu(excessCostPerExecution).toFixed())} ${symbol} (${excessCostPerExecution.toFixed()})`

  if (excessCostPerExecution.lt(0)) {
    log(
      `${red(`The "maxExecutionFee" you set in acurast.json is below the suggested fee. There is a chance that your deployment will not get matched!`)}\n${suggestedFeeString}`
    )
    log('')
  } else if (excessCostPerExecutionPercentage.gt(0.1)) {
    log(
      `${red(`The "maxExecutionFee" you set in acurast.json is ${excessCostPerExecutionPercentage.multipliedBy(100).toFixed(0)}% above the suggested fee. It is possible that you are overpaying for your deployment!`)}\n${suggestedFeeString}`
    )
    log('')
  }

  log(
    `There will be ${toAcurastColor(
      numberOfExecutions.toString()
    )} ${pluralize(numberOfExecutions, 'execution')} with ${toAcurastColor(
      numberOfReplicas.toString()
    )} ${pluralize(
      numberOfReplicas,
      'replica'
    )}. (Total runs: ${toAcurastColor(totalRuns.toString())})`
  )
  log('')
  log(
    `The maximum cost per execution is ${toAcurastColor(
      maxCostPerExecutionCACU.toString()
    )} ${symbol}, which means each replica will cost ${toAcurastColor(
      maxCostPerExecutionPerReplicaCACU.toString()
    )} ${symbol}.`
  )
  log('')
  log(
    `The total cost will be ${toAcurastColor(maxTotalCostCACU.toString())} ${symbol}.`
  )
  log('')
}

const ACURAST_DECIMALS = 12

function satoshiToDisplay(satoshi: BigNumber | string): string {
  return new BigNumber(satoshi).shiftedBy(-ACURAST_DECIMALS).toFixed()
}

export const printMatcherPricingInfo = (
  advice: PricingAdvice,
  config: AcurastProjectConfig,
  options: { output: 'text' | 'json' }
) => {
  const log = consoleOutput(options.output)
  const symbol = getSymbolForNetwork(config.network)

  if (options.output === 'json') {
    log(
      '',
      JSON.stringify({
        type: 'pricing',
        status: advice.status,
        matchable: advice.matchedProcessors >= advice.requiredProcessors,
        matched_processors: advice.matchedProcessors,
        required_processors: advice.requiredProcessors,
        current_price: advice.currentPrice.toFixed(),
        suggested_price: advice.suggestedPrice?.toFixed() ?? null,
        average_price: advice.averagePrice?.toFixed() ?? null,
        distribution: advice.distribution,
      })
    )
    return
  }

  const toColor = (text: string) => acurastColor(text)

  log('Processor pricing (live market data):')
  log('')
  log(
    `  Your max price:     ${toColor(satoshiToDisplay(advice.currentPrice))} ${symbol} per execution`
  )
  if (advice.averagePrice) {
    log(
      `  Market average:     ${toColor(satoshiToDisplay(advice.averagePrice))} ${symbol} per execution`
    )
  }
  if (advice.suggestedPrice) {
    log(
      `  Suggested price:    ${toColor(satoshiToDisplay(advice.suggestedPrice))} ${symbol} per execution`
    )
  }
  log(
    `  Matched processors: ${toColor(String(advice.matchedProcessors))} of ${toColor(String(advice.requiredProcessors))} required`
  )
  log('')

  // Distribution bar chart
  if (advice.distribution.length > 0) {
    log('  Price distribution (per execution):')

    const maxCount = Math.max(...advice.distribution.map((b) => b.count))
    const barWidth = 20

    for (const bucket of advice.distribution) {
      const min = satoshiToDisplay(bucket.range_min)
      const max = satoshiToDisplay(bucket.range_max)
      const filled =
        maxCount > 0 ? Math.round((bucket.count / maxCount) * barWidth) : 0
      const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled)
      const countStr = String(bucket.count).padStart(4)

      const bucketMin = new BigNumber(bucket.range_min)
      const bucketMax = new BigNumber(bucket.range_max)

      let marker = ''
      if (
        advice.currentPrice.gte(bucketMin) &&
        advice.currentPrice.lt(bucketMax)
      ) {
        marker = '  \u25C4 your price'
      } else if (
        advice.suggestedPrice &&
        advice.suggestedPrice.gte(bucketMin) &&
        advice.suggestedPrice.lt(bucketMax)
      ) {
        marker = '  \u25C4 suggested'
      }

      log(
        `    ${min.padStart(10)} - ${max.padEnd(10)} ${symbol}: ${bar} ${countStr} ${pluralize(bucket.count, 'processor')}${marker}`
      )
    }

    // If the user's price is above all buckets, note it
    const lastBucket = advice.distribution[advice.distribution.length - 1]
    if (
      lastBucket &&
      advice.currentPrice.gte(new BigNumber(lastBucket.range_max))
    ) {
      log(
        `    ${''.padStart(10)}   ${'(your price is above all buckets)'.padEnd(10)}`
      )
    }

    log('')
  }

  // Status message
  if (advice.status === 'insufficient') {
    if (advice.matchedProcessors === 0) {
      log(red('No processors are available at your current price.'))
    } else {
      log(
        red(
          `Not enough processors at your current price (${advice.matchedProcessors} of ${advice.requiredProcessors} required).`
        )
      )
    }
    if (advice.suggestedPrice) {
      log(
        `Suggested price: ${toColor(satoshiToDisplay(advice.suggestedPrice))} ${symbol} (covers ${advice.requiredProcessors} ${pluralize(advice.requiredProcessors, 'processor')})`
      )
    }
    log('')
  } else if (advice.status === 'overpaying') {
    const savings = advice.suggestedPrice
      ? advice.currentPrice.minus(advice.suggestedPrice)
      : null
    log(
      yellow(
        `Your price is significantly above what is needed to match ${advice.requiredProcessors} ${pluralize(advice.requiredProcessors, 'processor')}.`
      )
    )
    if (savings) {
      log(
        `You could save ${toColor(satoshiToDisplay(savings))} ${symbol} per execution by lowering to ${toColor(satoshiToDisplay(advice.suggestedPrice!))} ${symbol}.`
      )
    }
    log('')
  } else {
    log(
      green(
        `Your price matches ${advice.matchedProcessors} ${pluralize(advice.matchedProcessors, 'processor')} (${advice.requiredProcessors} required).`
      )
    )
    log('')
  }
}
