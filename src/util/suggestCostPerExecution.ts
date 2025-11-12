import { BigNumber } from 'bignumber.js'

const ACURAST_DECIMALS: number = 12
const DEFAULT_BASE_FEE: BigNumber = new BigNumber('2000000000') // 0.002 cACU
const DEFAULT_FEE_PER_MILLIS: BigNumber = new BigNumber(1) // 0.000000000001 cACU
const DEFAULT_FEE_PER_BYTE: BigNumber = new BigNumber(1) // 0.000000000001 cACU
const DEFAULT_MATCHER_FEE: BigNumber = new BigNumber('30000000000') // 0.03 cACU

export const suggestCostPerExecution = (
  duration: number,
  storage: number,
  humanReadable: boolean = false
): string => {
  if (duration === null) {
    throw Error('Invalid duration')
  }
  const minDefaultReward = DEFAULT_FEE_PER_MILLIS.times(duration)
    .plus(DEFAULT_FEE_PER_BYTE.times(storage))
    .plus(DEFAULT_BASE_FEE)
    .plus(DEFAULT_MATCHER_FEE)

  if (humanReadable) {
    return minDefaultReward.shiftedBy(-ACURAST_DECIMALS).toString()
  }

  return minDefaultReward.toString()
}
