import 'dotenv/config'
import type { AcurastProjectConfig } from './types.js'
import type { EnvVar } from './acurast/env/types.js'

const RPC_CANARY = 'wss://canarynet-ws-1.acurast-h-server-2.papers.tech'
const RPC_MAINNET = 'wss://archive.mainnet.acurast.com'

const MATCHER_CANARY = 'https://matcher.canary.acurast.com'
const MATCHER_MAINNET = 'https://matcher.mainnet.acurast.com'

const INDEXER_CANARY = 'https://dev.indexer.canary.acurast.com/api/v1/rpc'
const INDEXER_CANARY_API_KEY = 'OXuwySHqNSlwwa_qqB-cBw'
const INDEXER_MAINNET = 'https://dev.indexer.mainnet.acurast.com/api/v1/rpc'
const INDEXER_MAINNET_API_KEY = 'HbLxqSJoPTnzwa_rkF-tYv'

const IPFS_PROXY = 'https://ipfs-proxy.acurast.prod.gke.papers.tech'

export type EnvKeys =
  | 'ACURAST_MNEMONIC'
  | 'ACURAST_IPFS_URL'
  | 'ACURAST_IPFS_API_KEY'
  | 'ACURAST_RPC'
  | 'ACURAST_CANARY_RPC'
  | 'DEBUG'

const defaultValues: Record<EnvKeys, string | undefined> = {
  ACURAST_MNEMONIC: undefined,
  ACURAST_IPFS_URL: IPFS_PROXY,
  ACURAST_IPFS_API_KEY: '', // With the default IPFS Proxy, no API key is required
  ACURAST_RPC: RPC_MAINNET,
  ACURAST_CANARY_RPC: RPC_CANARY,
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

export const validateDeployEnvVars = (): void => {
  getEnv('ACURAST_MNEMONIC')
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

export const getRpcForNetwork = (network: 'mainnet' | 'canary'): string => {
  return network === 'mainnet'
    ? getEnv('ACURAST_RPC')
    : getEnv('ACURAST_CANARY_RPC')
}

export const getSymbolForNetwork = (network: 'mainnet' | 'canary'): string => {
  return network === 'mainnet' ? 'ACU' : 'cACU'
}

export const getMatcherUrlForNetwork = (
  network: 'mainnet' | 'canary'
): string | undefined => {
  return network === 'mainnet' ? MATCHER_MAINNET : MATCHER_CANARY
}

export const getIndexerConfigForNetwork = (
  network: 'mainnet' | 'canary'
): { url: string; apiKey: string } => {
  return network === 'mainnet'
    ? { url: INDEXER_MAINNET, apiKey: INDEXER_MAINNET_API_KEY }
    : { url: INDEXER_CANARY, apiKey: INDEXER_CANARY_API_KEY }
}

// Default RPC for backwards compatibility (mainnet)
export const RPC = getEnv('ACURAST_RPC')
