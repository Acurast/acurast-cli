import { parseByteSize, MIN_EXECUTION_DURATION_MS } from '@acurast/sdk/chain'
import type { AcurastProjectConfig, EnvVar } from '@acurast/sdk/types'
import {
  buildVpsJob,
  VPS_IMAGE_PRESETS,
  type VpsImageName,
} from '@acurast/vps'
import { CLI_NETWORKS, type CliNetwork } from '../config.js'
import { parse as parseDuration } from './parse-duration.js'

export const DEFAULT_VPS_IMAGE: VpsImageName = 'ubuntu'
export const DEFAULT_VPS_DURATION = '24h'
export const DEFAULT_VPS_NETWORK: CliNetwork = 'canary'
// From the app-tunnel/cargo example config.
export const DEFAULT_VPS_MAX_COST_PER_EXECUTION = 48_686_320_000

export const VPS_IMAGE_NAMES = Object.keys(VPS_IMAGE_PRESETS)

/**
 * Domain suffix the tunnel relay serves per network (mirrors the pinned
 * tunnel bundle's `NETWORKS` table). Devnet rides on the canary relays.
 */
const VPS_DOMAIN_SUFFIX: Record<CliNetwork, string> = {
  mainnet: 'acu.run',
  canary: 'canary.acu.run',
  devnet: 'canary.acu.run',
}

export interface VpsOptions {
  image?: string
  minMemory?: string
  minStorage?: string
  minComputeScore?: string | number
  minCpuMultiScore?: string | number
  authorizedSshKey?: string
  duration?: string
  callbackUrl?: string
  httpPort?: string | number
  network?: string
  maxCostPerExecution?: string | number
}

export const VPS_ENV_MAPPING: Record<keyof VpsOptions, string> = {
  image: 'VPS_IMAGE',
  minMemory: 'VPS_MIN_MEMORY',
  minStorage: 'VPS_MIN_STORAGE',
  minComputeScore: 'VPS_MIN_COMPUTE_SCORE',
  minCpuMultiScore: 'VPS_MIN_CPU_MULTI_SCORE',
  authorizedSshKey: 'VPS_AUTHORIZED_SSH_KEY',
  duration: 'VPS_DURATION',
  callbackUrl: 'VPS_CALLBACK_URL',
  httpPort: 'VPS_HTTP_PORT',
  network: 'VPS_NETWORK',
  maxCostPerExecution: 'VPS_MAX_COST_PER_EXECUTION',
}

/**
 * Merge CLI flags with `VPS_*` environment variables (flags win). `.env` is
 * already loaded via `dotenv/config` in `src/config.ts`.
 */
export const resolveVpsOptions = (
  flags: VpsOptions,
  env: NodeJS.ProcessEnv = process.env
): VpsOptions => {
  const resolved: VpsOptions = { ...flags }
  for (const [key, envKey] of Object.entries(VPS_ENV_MAPPING) as [
    keyof VpsOptions,
    string,
  ][]) {
    if (resolved[key] === undefined && env[envKey]) {
      resolved[key] = env[envKey]
    }
  }
  return resolved
}

const parsePositiveInt = (value: string | number, flag: string): number => {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(
      `Invalid --${flag}: "${value}" (expected a positive integer)`
    )
  }
  return parsed
}

const parseHttpPort = (value: string | number): number => {
  const port = parsePositiveInt(value, 'http-port')
  // Ports below 1024 can't be bound inside the proot sandbox.
  if (port < 1024 || port > 65535) {
    throw new Error(`Invalid --http-port: "${value}" (expected 1024-65535)`)
  }
  return port
}

export interface VpsPlan {
  config: AcurastProjectConfig & { network: CliNetwork }
  envVars: EnvVar[]
  /** Precomputed tunnel clientId (the tunnel key is generated locally). */
  clientId: string
  /** Full tunnel domain, e.g. `abc123.canary.acu.run`. */
  domain: string
  /** Ready-to-paste SSH connect command for the VPS. */
  sshCommand: string
}

export const buildVpsConfig = (options: VpsOptions): VpsPlan => {
  const imageName = (options.image ?? DEFAULT_VPS_IMAGE) as VpsImageName
  if (!VPS_IMAGE_PRESETS[imageName]) {
    throw new Error(
      `Unknown image "${imageName}". Available: ${VPS_IMAGE_NAMES.join(', ')}`
    )
  }

  const network = (options.network ?? DEFAULT_VPS_NETWORK) as CliNetwork
  if (!CLI_NETWORKS.includes(network)) {
    throw new Error(
      `Unsupported network "${network}". Supported: ${CLI_NETWORKS.join(', ')}`
    )
  }

  const duration = options.duration ?? DEFAULT_VPS_DURATION
  const durationMs = parseDuration(duration) ?? 0
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error(
      `Invalid duration "${duration}" (expected e.g. 1h, 24h, 2d)`
    )
  }
  if (durationMs < MIN_EXECUTION_DURATION_MS) {
    throw new Error(
      `Duration "${duration}" is too short: deployments must run for at least 1 minute`
    )
  }

  if (!options.authorizedSshKey) {
    throw new Error(
      'An SSH public key is required (--authorized-ssh-key or VPS_AUTHORIZED_SSH_KEY): the VPS only accepts key-based SSH auth.'
    )
  }

  // The tunnel bundle only knows mainnet/canary relays; devnet rides on canary.
  const tunnelNetwork = network === 'devnet' ? 'canary' : network

  const plan = buildVpsJob({
    sshKey: options.authorizedSshKey,
    image: imageName,
    network: tunnelNetwork,
    // The SDK defaults to a 3-minute lead, which the CLI validator flags as
    // risky (< 5 minutes).
    startAt: { msFromNow: 300_000 },
    maxExecutionTimeInMs: durationMs,
    reward:
      options.maxCostPerExecution !== undefined
        ? parsePositiveInt(
            options.maxCostPerExecution,
            'max-cost-per-execution'
          )
        : DEFAULT_VPS_MAX_COST_PER_EXECUTION,
    minMemory: options.minMemory
      ? Number(parseByteSize(options.minMemory))
      : undefined,
    minStorage: options.minStorage
      ? Number(parseByteSize(options.minStorage))
      : undefined,
    minCpuScore:
      options.minComputeScore !== undefined
        ? parsePositiveInt(options.minComputeScore, 'min-compute-score')
        : undefined,
    minCpuMultiScore:
      options.minCpuMultiScore !== undefined
        ? parsePositiveInt(options.minCpuMultiScore, 'min-cpu-multi-score')
        : undefined,
    callbackUrl: options.callbackUrl,
    httpPort:
      options.httpPort !== undefined
        ? parseHttpPort(options.httpPort)
        : undefined,
  })

  // clientId is unique per deployment (fresh keypair), so it doubles as a
  // stable, recognizable project name.
  const config = {
    ...plan.config,
    projectName: `vps-${plan.clientId}`,
    network,
  } as AcurastProjectConfig & { network: CliNetwork }

  const domain = `${plan.clientId}.${VPS_DOMAIN_SUFFIX[network]}`
  const sshCommand = `ssh -o ProxyCommand='openssl s_client -quiet -servername ${domain} -connect ${domain}:443' root@${domain}`

  return { config, envVars: plan.envVars, clientId: plan.clientId, domain, sshCommand }
}
