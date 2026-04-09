import axios from 'axios'
import Keyring from '@polkadot/keyring'
import { u8aToHex } from '@polkadot/util'
import { waitReady } from '@polkadot/wasm-crypto'
import { getEnv } from '../config.js'
import { filelogger } from '../util/fileLogger.js'

export interface ViewKeyResponse {
  viewKey: string
  jobId: string
  expiresAt: string
}

/**
 * Derives an ed25519 keypair from the same mnemonic used for the CLI wallet.
 * The devtools API accepts ed25519 (32-byte) public keys, not sr25519.
 */
async function getEd25519Wallet() {
  await waitReady()
  const keyring = new Keyring({ type: 'ed25519' })
  return keyring.addFromMnemonic(getEnv('ACURAST_MNEMONIC'))
}

export function buildDevtoolsUrl(
  deploymentId: string,
  viewKey: string
): string {
  const devtoolsUrl = getEnv('ACURAST_DEVTOOLS_URL')
  return `${devtoolsUrl}/deployment/${deploymentId}?viewKey=${viewKey}`
}

export async function getDevtoolsViewKey(
  jobId: string
): Promise<ViewKeyResponse> {
  const apiUrl = getEnv('ACURAST_DEVTOOLS_API_URL')
  const wallet = await getEd25519Wallet()

  const publicKeyHex = u8aToHex(wallet.publicKey).slice(2) // no 0x prefix
  const timestamp = Math.floor(Date.now() / 1000).toString()

  // Message format expected by devtools API: "publicKeyHex:timestamp"
  const message = `${publicKeyHex}:${timestamp}`
  const encoder = new TextEncoder()
  const signature = u8aToHex(wallet.sign(encoder.encode(message))).slice(2)

  filelogger.debug(
    `DevTools view-key request: POST ${apiUrl}/v1/auth/view-key jobId=${jobId} publicKey=${publicKeyHex}`
  )

  try {
    const response = await axios.post<ViewKeyResponse>(
      `${apiUrl}/v1/auth/view-key`,
      { jobId },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-PublicKey': publicKeyHex,
          'X-Timestamp': timestamp,
        },
        timeout: 10_000,
      }
    )

    return response.data
  } catch (error: any) {
    const detail = error.response?.data
      ? JSON.stringify(error.response.data)
      : error.message
    filelogger.error(
      `DevTools view-key failed: ${error.response?.status} ${detail}`
    )
    throw new Error(
      `DevTools API ${error.response?.status ?? 'error'}: ${detail}`
    )
  }
}
