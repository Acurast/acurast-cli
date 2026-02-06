import type { AcurastProjectConfig } from '../types.js'
import { getFeeAnalysis, toCacu } from '../util/getFeeAnalysis.js'
import { pluralize } from '../util/pluralize.js'
import { red } from 'ansis'
import { acurastColor } from '../util.js'
import { consoleOutput } from './console-output.js'
import { getSymbolForNetwork } from '../config.js'

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
