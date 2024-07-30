import Keyring from '@polkadot/keyring'
import { waitReady } from '@polkadot/wasm-crypto'
import { getEnv } from '../config.js'

export const getWallet = async () => {
  await waitReady()
  const keyring = new Keyring({ type: 'sr25519' })
  const wallet = keyring.addFromMnemonic(getEnv('ACURAST_MNEMONIC'), {
    name: 'AcurastCli',
  })

  return wallet
}
