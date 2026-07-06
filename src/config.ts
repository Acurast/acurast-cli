import 'dotenv/config'
import type { AcurastProjectConfig, EnvVar } from '@acurast/sdk/types'

const RPC_CANARY = 'wss://canarynet-ws-1.acurast-h-server-2.papers.tech'
const RPC_MAINNET = 'wss://archive.mainnet.acurast.com'
const RPC_DEVNET = 'wss://acurast-devnet-ws.prod.gke.papers.tech'

const MATCHER_CANARY = 'https://matcher.canary.acurast.com'
const MATCHER_MAINNET = 'https://matcher.mainnet.acurast.com'
const MATCHER_DEVNET = '' // No public matcher on devnet by default

const INDEXER_CANARY = 'https://dev.indexer.canary.acurast.com/api/v1/rpc'
const INDEXER_CANARY_API_KEY = 'OXuwySHqNSlwwa_qqB-cBw'
const INDEXER_MAINNET = 'https://dev.indexer.mainnet.acurast.com/api/v1/rpc'
const INDEXER_MAINNET_API_KEY = 'HbLxqSJoPTnzwa_rkF-tYv'
const INDEXER_DEVNET = '' // No public indexer on devnet by default
const INDEXER_DEVNET_API_KEY = ''

const IPFS_PROXY = 'https://ipfs-proxy.acurast.prod.gke.papers.tech'

const DEVTOOLS_URL = 'https://devtools.acurast.com'
const DEVTOOLS_API_URL = 'https://api.devtools.acurast.com'

const HUB_URL = 'https://hub.acurast.com'

export type CliNetwork = 'mainnet' | 'canary' | 'devnet'

export const CLI_NETWORKS: readonly CliNetwork[] = [
  'mainnet',
  'canary',
  'devnet',
] as const

export type EnvKeys =
  | 'ACURAST_MNEMONIC'
  | 'ACURAST_IPFS_URL'
  | 'ACURAST_IPFS_API_KEY'
  | 'ACURAST_RPC'
  | 'ACURAST_MAINNET_RPC'
  | 'ACURAST_CANARY_RPC'
  | 'ACURAST_DEVNET_RPC'
  | 'ACURAST_MAINNET_MATCHER'
  | 'ACURAST_CANARY_MATCHER'
  | 'ACURAST_DEVNET_MATCHER'
  | 'ACURAST_MAINNET_INDEXER'
  | 'ACURAST_MAINNET_INDEXER_API_KEY'
  | 'ACURAST_CANARY_INDEXER'
  | 'ACURAST_CANARY_INDEXER_API_KEY'
  | 'ACURAST_DEVNET_INDEXER'
  | 'ACURAST_DEVNET_INDEXER_API_KEY'
  | 'ACURAST_DEVTOOLS_URL'
  | 'ACURAST_DEVTOOLS_API_URL'
  | 'ACURAST_HUB_URL'
  | 'ACURAST_SIGNING_MODE'
  | 'DEBUG'

const defaultValues: Record<EnvKeys, string | undefined> = {
  ACURAST_MNEMONIC: undefined,
  ACURAST_IPFS_URL: IPFS_PROXY,
  ACURAST_IPFS_API_KEY: '', // Default IPFS Proxy needs no API key
  ACURAST_RPC: RPC_MAINNET, // deprecated alias for ACURAST_MAINNET_RPC
  ACURAST_MAINNET_RPC: RPC_MAINNET,
  ACURAST_CANARY_RPC: RPC_CANARY,
  ACURAST_DEVNET_RPC: RPC_DEVNET,
  ACURAST_MAINNET_MATCHER: MATCHER_MAINNET,
  ACURAST_CANARY_MATCHER: MATCHER_CANARY,
  ACURAST_DEVNET_MATCHER: MATCHER_DEVNET,
  ACURAST_MAINNET_INDEXER: INDEXER_MAINNET,
  ACURAST_MAINNET_INDEXER_API_KEY: INDEXER_MAINNET_API_KEY,
  ACURAST_CANARY_INDEXER: INDEXER_CANARY,
  ACURAST_CANARY_INDEXER_API_KEY: INDEXER_CANARY_API_KEY,
  ACURAST_DEVNET_INDEXER: INDEXER_DEVNET,
  ACURAST_DEVNET_INDEXER_API_KEY: INDEXER_DEVNET_API_KEY,
  ACURAST_DEVTOOLS_URL: DEVTOOLS_URL,
  ACURAST_DEVTOOLS_API_URL: DEVTOOLS_API_URL,
  ACURAST_HUB_URL: HUB_URL,
  // 'local' (mnemonic) | 'remote' (browser wallet). Empty → auto-detect.
  ACURAST_SIGNING_MODE: '',
  DEBUG: 'false',
}

export const getEnv = (key: EnvKeys): string => {
  const value = process.env[key]
  if (!value) {
    const defaultValue = defaultValues[key]
    if (defaultValue === undefined) {
      throw new Error(`"${key}" is not defined in the environment.`)
    }
    return defaultValue
  }
  return value
}

export const validateDeployEnvVars = (
  options: { requireMnemonic?: boolean } = {}
): void => {
  // In remote-signing mode the mnemonic is not needed — the browser wallet signs.
  if (options.requireMnemonic ?? true) {
    getEnv('ACURAST_MNEMONIC')
  }
  getEnv('ACURAST_IPFS_URL')
  getEnv('ACURAST_IPFS_API_KEY')
}

export const getProjectEnv = (key: string): string => {
  if (Object.keys(defaultValues).includes(key)) {
    throw new Error(
      `Key ${key} is a CLI env variable and cannot be used as a project environment variable.`
    )
  }
  const value = process.env[key]
  if (!value) {
    throw new Error(`"${key}" is not defined in the environment.`)
  }
  return value
}

export const getProjectEnvVars = (config: AcurastProjectConfig): EnvVar[] => {
  return (
    config.includeEnvironmentVariables?.map((key) => ({
      key,
      value: getProjectEnv(key),
    })) || []
  )
}

export const getRpcForNetwork = (network: CliNetwork): string => {
  switch (network) {
    case 'mainnet':
      // Honour the legacy ACURAST_RPC override if present.
      return process.env.ACURAST_MAINNET_RPC ?? getEnv('ACURAST_RPC')
    case 'canary':
      return getEnv('ACURAST_CANARY_RPC')
    case 'devnet': {
      const rpc = getEnv('ACURAST_DEVNET_RPC')
      if (!rpc) {
        throw new Error(
          'Devnet RPC is not configured. Set ACURAST_DEVNET_RPC in your environment.'
        )
      }
      return rpc
    }
  }
}

export const getSymbolForNetwork = (network: CliNetwork): string => {
  switch (network) {
    case 'mainnet':
      return 'ACU'
    case 'canary':
      return 'cACU'
    case 'devnet':
      return 'dACU'
  }
}

export const getMatcherUrlForNetwork = (
  network: CliNetwork
): string | undefined => {
  switch (network) {
    case 'mainnet':
      return getEnv('ACURAST_MAINNET_MATCHER') || undefined
    case 'canary':
      return getEnv('ACURAST_CANARY_MATCHER') || undefined
    case 'devnet':
      return process.env.ACURAST_DEVNET_MATCHER || undefined
  }
}

export const getIndexerConfigForNetwork = (
  network: CliNetwork
): { url: string; apiKey: string } => {
  switch (network) {
    case 'mainnet':
      return {
        url: getEnv('ACURAST_MAINNET_INDEXER'),
        apiKey: getEnv('ACURAST_MAINNET_INDEXER_API_KEY'),
      }
    case 'canary':
      return {
        url: getEnv('ACURAST_CANARY_INDEXER'),
        apiKey: getEnv('ACURAST_CANARY_INDEXER_API_KEY'),
      }
    case 'devnet': {
      const url = process.env.ACURAST_DEVNET_INDEXER || ''
      if (!url) {
        throw new Error(
          'Devnet indexer is not configured. Set ACURAST_DEVNET_INDEXER (and optionally ACURAST_DEVNET_INDEXER_API_KEY) in your environment.'
        )
      }
      return {
        url,
        apiKey: process.env.ACURAST_DEVNET_INDEXER_API_KEY ?? '',
      }
    }
  }
}

/** IPFS config for `@acurast/sdk/ipfs` `uploadScript` calls. */
export const getIpfsConfig = (): { endpoint: string; apiKey: string } => ({
  endpoint: getEnv('ACURAST_IPFS_URL'),
  apiKey: getEnv('ACURAST_IPFS_API_KEY'),
})

/** Base URL of the Acurast Hub (used by `login` and remote signing). */
export const getHubUrl = (): string => getEnv('ACURAST_HUB_URL').replace(/\/$/, '')

// Default RPC for backwards compatibility (mainnet)
export const RPC = getEnv('ACURAST_RPC')
