import 'dotenv/config'
import type { AcurastProjectConfig } from './types.js'
import type { EnvVar } from './acurast/env/types.js'

const RPC_CANARY = 'wss://canarynet-ws-1.acurast-h-server-2.papers.tech'

export type EnvKeys =
  | 'ACURAST_MNEMONIC'
  | 'ACURAST_IPFS_URL'
  | 'ACURAST_IPFS_API_KEY'
  | 'ACURAST_RPC'
  | 'DEBUG'

const defaultValues: Record<EnvKeys, string | undefined> = {
  ACURAST_MNEMONIC: undefined,
  ACURAST_IPFS_URL: undefined,
  ACURAST_IPFS_API_KEY: undefined,
  ACURAST_RPC: RPC_CANARY,
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
  const envVars: EnvVar[] = []
  config.includeEnvironmentVariables?.forEach((key) => {
    const value = getProjectEnv(key)
    envVars.push({ key, value })
  })
  return envVars
}

export const RPC = getEnv('ACURAST_RPC')
