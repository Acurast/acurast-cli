import type { ApiPromise } from '@polkadot/api'

export const getBalance = async (
  address: string,
  api: ApiPromise
): Promise<bigint> => {
  let {
    data: { free: balance },
  } = (await api.query.system.account(address)) as any

  const balanceBigInt = BigInt(balance.toString())
  const shiftedBalance = balanceBigInt / BigInt(10 ** 12)
  return shiftedBalance
}
