#!/usr/bin/env node
/**
 * Verifies the e2e canary wallet has a non-zero balance before deploy scenarios.
 */
import { ApiPromise, WsProvider } from '@polkadot/api'
import { walletFromMnemonic, getBalance } from '@acurast/sdk/chain'

const RPC_CANARY =
  process.env.ACURAST_CANARY_RPC ??
  'wss://canarynet-ws-1.acurast-h-server-2.papers.tech'

const mnemonic = process.env.ACURAST_E2E_MNEMONIC
if (!mnemonic) {
  console.error('ACURAST_E2E_MNEMONIC is not set')
  process.exit(1)
}

const wallet = await walletFromMnemonic(mnemonic, { name: 'AcurastCli' })
const api = await ApiPromise.create({
  provider: new WsProvider(RPC_CANARY),
  noInitWarn: true,
})
const balance = await getBalance(api, wallet.address)
await api.disconnect()

if (balance === 0) {
  console.error(
    `E2E canary balance is 0 for ${wallet.address}. Fund via https://faucet.acurast.com?address=${wallet.address}`
  )
  process.exit(1)
}

console.log(`E2E canary preflight OK: ${wallet.address} balance=${balance}`)
