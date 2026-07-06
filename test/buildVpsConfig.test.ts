import {
  buildVpsConfig,
  resolveVpsOptions,
  VPS_IMAGES,
  DEFAULT_VPS_IMAGE,
} from '../src/util/buildVpsConfig.js'
import { DeploymentRuntime } from '@acurast/sdk/types'

const TEMPLATE_DIR = '/tmp/templates/vps/app'

describe('resolveVpsOptions', () => {
  test('flags win over VPS_* env vars', () => {
    const resolved = resolveVpsOptions(
      { image: 'ubuntu24', minMemory: '4GB' },
      {
        VPS_IMAGE: 'ubuntu25',
        VPS_MIN_MEMORY: '1GB',
        VPS_MIN_STORAGE: '20GB',
      }
    )
    expect(resolved.image).toBe('ubuntu24')
    expect(resolved.minMemory).toBe('4GB')
    expect(resolved.minStorage).toBe('20GB')
  })

  test('reads all VPS_* env vars when no flags given', () => {
    const resolved = resolveVpsOptions(
      {},
      {
        VPS_IMAGE: 'ubuntu25',
        VPS_MIN_MEMORY: '2GB',
        VPS_MIN_STORAGE: '10GB',
        VPS_MIN_COMPUTE_SCORE: '100',
        VPS_AUTHORIZED_SSH_KEY: 'ssh-ed25519 AAAA key',
        VPS_SSH_PASSWORD: 'hunter2',
        VPS_DURATION: '2h',
        VPS_CALLBACK_URL: 'https://webhook.watch/abc',
        VPS_NETWORK: 'mainnet',
        VPS_REPLICAS: '2',
        VPS_MAX_COST_PER_EXECUTION: '123',
      }
    )
    expect(resolved).toMatchObject({
      image: 'ubuntu25',
      minMemory: '2GB',
      minStorage: '10GB',
      minComputeScore: '100',
      authorizedSshKey: 'ssh-ed25519 AAAA key',
      sshPassword: 'hunter2',
      duration: '2h',
      callbackUrl: 'https://webhook.watch/abc',
      network: 'mainnet',
      replicas: '2',
      maxCostPerExecution: '123',
    })
  })

  test('ignores unrelated and empty env vars', () => {
    const resolved = resolveVpsOptions(
      {},
      { VPS_IMAGE: '', OTHER: 'x', VPS_UNKNOWN: 'y' }
    )
    expect(resolved.image).toBeUndefined()
  })
})

describe('buildVpsConfig', () => {
  test('defaults: ubuntu24 image, 24h onetime execution, canary, 1 replica', () => {
    const { config, envVars } = buildVpsConfig({}, TEMPLATE_DIR)

    expect(config.projectName).toMatch(/^vps-/)
    expect(config.fileUrl).toBe(TEMPLATE_DIR)
    expect(config.entrypoint).toBe('start.sh')
    expect(config.runtime).toBe(DeploymentRuntime.Shell)
    expect(config.image).toEqual(VPS_IMAGES[DEFAULT_VPS_IMAGE])
    expect(config.network).toBe('canary')
    expect(config.execution).toEqual({
      type: 'onetime',
      maxExecutionTimeInMs: 24 * 60 * 60 * 1000,
    })
    expect(config.numberOfReplicas).toBe(1)
    expect(config.onlyAttestedDevices).toBe(true)
    expect(config.requiredModules).toEqual(['Shell'])
    expect(config.minProcessorVersions).toEqual({ android: '1.26.0' })
    expect(config.benchmarkFilters).toBeUndefined()
    // NETWORK always forwarded so tunnel.py picks the right relays
    expect(envVars).toEqual([{ key: 'NETWORK', value: 'canary' }])
  })

  test('maps min-* options to benchmarkFilters', () => {
    const { config } = buildVpsConfig(
      { minMemory: '2GB', minStorage: '10GB', minComputeScore: '100' },
      TEMPLATE_DIR
    )
    expect(config.benchmarkFilters).toEqual({
      minRamTotalBytes: 2_000_000_000,
      minStorageAvailBytes: 10_000_000_000,
      minCpuSingleCoreScore: 100,
    })
  })

  test('collects ssh/callback env vars, skipping unset ones', () => {
    const { envVars } = buildVpsConfig(
      {
        authorizedSshKey: 'ssh-ed25519 AAAA key',
        sshPassword: 'hunter2',
        callbackUrl: 'https://webhook.watch/abc',
        network: 'mainnet',
      },
      TEMPLATE_DIR
    )
    expect(envVars).toEqual([
      { key: 'NETWORK', value: 'mainnet' },
      { key: 'SSH_PASSWORD', value: 'hunter2' },
      { key: 'SSH_AUTHORIZED_KEY', value: 'ssh-ed25519 AAAA key' },
      { key: 'CALLBACK_URL', value: 'https://webhook.watch/abc' },
    ])
  })

  test('devnet uses canary tunnel relays but keeps devnet in the config', () => {
    const { config, envVars } = buildVpsConfig(
      { network: 'devnet' },
      TEMPLATE_DIR
    )
    expect(config.network).toBe('devnet')
    expect(envVars).toContainEqual({ key: 'NETWORK', value: 'canary' })
  })

  test('parses duration strings and replica counts', () => {
    const { config } = buildVpsConfig(
      { duration: '90m', replicas: '3', maxCostPerExecution: '42' },
      TEMPLATE_DIR
    )
    expect(config.execution).toEqual({
      type: 'onetime',
      maxExecutionTimeInMs: 90 * 60 * 1000,
    })
    expect(config.numberOfReplicas).toBe(3)
    expect(config.maxCostPerExecution).toBe(42)
  })

  test('rejects unknown image alias, bad duration, bad network, bad numbers', () => {
    expect(() => buildVpsConfig({ image: 'arch' }, TEMPLATE_DIR)).toThrow(
      /Unknown image/
    )
    expect(() => buildVpsConfig({ duration: 'soon' }, TEMPLATE_DIR)).toThrow(
      /duration/i
    )
    expect(() => buildVpsConfig({ network: 'testnet' }, TEMPLATE_DIR)).toThrow(
      /network/i
    )
    expect(() =>
      buildVpsConfig({ minComputeScore: 'fast' }, TEMPLATE_DIR)
    ).toThrow(/min-compute-score/i)
    expect(() => buildVpsConfig({ replicas: '0' }, TEMPLATE_DIR)).toThrow(
      /replicas/i
    )
  })

  test('image aliases all define url and sha256', () => {
    for (const [alias, image] of Object.entries(VPS_IMAGES)) {
      expect(image.url).toMatch(/^https:\/\//)
      expect(image.sha256).toMatch(/^[0-9a-f]{64}$/)
      expect(alias).toMatch(/^[a-z0-9-]+$/)
    }
  })

  test('produces a config accepted by validateCliConfig', async () => {
    const { validateCliConfig } =
      await import('../src/util/validateCliConfig.js')
    const { config } = buildVpsConfig(
      { minMemory: '2GB', network: 'canary' },
      TEMPLATE_DIR
    )
    const result = validateCliConfig(config)
    expect(result.success).toBe(true)
  })
})
