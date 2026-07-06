import { parseByteSize } from '@acurast/sdk/chain'
import {
  AssignmentStrategyVariant,
  DeploymentRuntime,
  RequiredModules,
  RestartPolicy,
  type AcurastProjectConfig,
  type BenchmarkFilters,
  type EnvVar,
} from '@acurast/sdk/types'
import { CLI_NETWORKS, type CliNetwork } from '../config.js'
import { parse as parseDuration } from './parse-duration.js'

export interface VpsImage {
  url: string
  sha256: string
}

/**
 * Aliases for proot-distro Ubuntu rootfs tarballs (aarch64 — processors are
 * ARM). https://github.com/termux/proot-distro/releases
 */
export const VPS_IMAGES: Record<string, VpsImage> = {
  ubuntu24: {
    url: 'https://github.com/termux/proot-distro/releases/download/v4.18.0/ubuntu-noble-aarch64-pd-v4.18.0.tar.xz',
    sha256: '91acaa786b8e2fbba56a9fd0f8a1188cee482b5c7baeed707b29ddaa9a294daa',
  },
  ubuntu25: {
    url: 'https://github.com/termux/proot-distro/releases/download/v4.30.1/ubuntu-questing-aarch64-pd-v4.30.1.tar.xz',
    sha256: '5ab35b90cd9a9f180656261ba400a135c4c01c2da4b74522118342f985c2d328',
  },
}

export const DEFAULT_VPS_IMAGE = 'ubuntu24'
export const DEFAULT_VPS_DURATION = '24h'
export const DEFAULT_VPS_NETWORK: CliNetwork = 'canary'
// From the app-tunnel/cargo example config.
export const DEFAULT_VPS_MAX_COST_PER_EXECUTION = 48_686_320_000
// Secondary tunnel connections (SSH) need processor >= 1.26.0.
const MIN_ANDROID_PROCESSOR_VERSION = '1.26.0'

export interface VpsOptions {
  image?: string
  minMemory?: string
  minStorage?: string
  minComputeScore?: string | number
  authorizedSshKey?: string
  sshPassword?: string
  duration?: string
  callbackUrl?: string
  network?: string
  replicas?: string | number
  maxCostPerExecution?: string | number
}

export const VPS_ENV_MAPPING: Record<keyof VpsOptions, string> = {
  image: 'VPS_IMAGE',
  minMemory: 'VPS_MIN_MEMORY',
  minStorage: 'VPS_MIN_STORAGE',
  minComputeScore: 'VPS_MIN_COMPUTE_SCORE',
  authorizedSshKey: 'VPS_AUTHORIZED_SSH_KEY',
  sshPassword: 'VPS_SSH_PASSWORD',
  duration: 'VPS_DURATION',
  callbackUrl: 'VPS_CALLBACK_URL',
  network: 'VPS_NETWORK',
  replicas: 'VPS_REPLICAS',
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

export const buildVpsConfig = (
  options: VpsOptions,
  templateDir: string
): {
  config: AcurastProjectConfig & { network: CliNetwork }
  envVars: EnvVar[]
} => {
  const imageAlias = options.image ?? DEFAULT_VPS_IMAGE
  const image = VPS_IMAGES[imageAlias]
  if (!image) {
    throw new Error(
      `Unknown image "${imageAlias}". Available: ${Object.keys(VPS_IMAGES).join(', ')}`
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

  const benchmarkFilters: BenchmarkFilters = {}
  if (options.minMemory) {
    benchmarkFilters.minRamTotalBytes = Number(parseByteSize(options.minMemory))
  }
  if (options.minStorage) {
    benchmarkFilters.minStorageAvailBytes = Number(
      parseByteSize(options.minStorage)
    )
  }
  if (options.minComputeScore !== undefined) {
    benchmarkFilters.minCpuSingleCoreScore = parsePositiveInt(
      options.minComputeScore,
      'min-compute-score'
    )
  }

  const config: AcurastProjectConfig & { network: CliNetwork } = {
    projectName: `vps-${Math.random().toString(36).slice(2, 8)}`,
    fileUrl: templateDir,
    entrypoint: 'start.sh',
    runtime: DeploymentRuntime.Shell,
    image,
    network: network as AcurastProjectConfig['network'] & CliNetwork,
    onlyAttestedDevices: true,
    startAt: { msFromNow: 300_000 },
    assignmentStrategy: { type: AssignmentStrategyVariant.Single },
    execution: { type: 'onetime', maxExecutionTimeInMs: durationMs },
    maxAllowedStartDelayInMs: 10_000,
    usageLimit: { maxMemory: 0, maxNetworkRequests: 0, maxStorage: 0 },
    numberOfReplicas:
      options.replicas !== undefined
        ? parsePositiveInt(options.replicas, 'replicas')
        : 1,
    requiredModules: [RequiredModules.Shell],
    minProcessorVersions: { android: MIN_ANDROID_PROCESSOR_VERSION },
    minProcessorReputation: 0,
    maxCostPerExecution:
      options.maxCostPerExecution !== undefined
        ? parsePositiveInt(
            options.maxCostPerExecution,
            'max-cost-per-execution'
          )
        : DEFAULT_VPS_MAX_COST_PER_EXECUTION,
    restartPolicy: RestartPolicy.OnFailure,
    ...(Object.keys(benchmarkFilters).length > 0 ? { benchmarkFilters } : {}),
  }

  // tunnel.py only knows mainnet/canary relays; devnet rides on canary.
  const tunnelNetwork = network === 'devnet' ? 'canary' : network
  const envVars: EnvVar[] = [{ key: 'NETWORK', value: tunnelNetwork }]
  if (options.sshPassword) {
    envVars.push({ key: 'SSH_PASSWORD', value: options.sshPassword })
  }
  if (options.authorizedSshKey) {
    envVars.push({ key: 'SSH_AUTHORIZED_KEY', value: options.authorizedSshKey })
  }
  if (options.callbackUrl) {
    envVars.push({ key: 'CALLBACK_URL', value: options.callbackUrl })
  }

  return { config, envVars }
}
