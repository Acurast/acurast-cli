import {
  buildVpsConfig,
  resolveVpsOptions,
  DEFAULT_VPS_MAX_COST_PER_EXECUTION,
} from '../src/util/buildVpsConfig.js'
import { DeploymentRuntime } from '@acurast/sdk/types'
import { TUNNEL_SCRIPT_IPFS, VPS_IMAGE_PRESETS } from '@acurast/vps'

const SSH_KEY = 'ssh-ed25519 AAAA key'

describe('resolveVpsOptions', () => {
  test('flags win over VPS_* env vars', () => {
    const resolved = resolveVpsOptions(
      { image: 'ubuntu', minMemory: '4GB' },
      {
        VPS_IMAGE: 'other',
        VPS_MIN_MEMORY: '1GB',
        VPS_MIN_STORAGE: '20GB',
      }
    )
    expect(resolved.image).toBe('ubuntu')
    expect(resolved.minMemory).toBe('4GB')
    expect(resolved.minStorage).toBe('20GB')
  })

  test('reads all VPS_* env vars when no flags given', () => {
    const resolved = resolveVpsOptions(
      {},
      {
        VPS_IMAGE: 'ubuntu',
        VPS_MIN_MEMORY: '2GB',
        VPS_MIN_STORAGE: '10GB',
        VPS_MIN_COMPUTE_SCORE: '100',
        VPS_MIN_CPU_MULTI_SCORE: '200',
        VPS_AUTHORIZED_SSH_KEY: SSH_KEY,
        VPS_DURATION: '2h',
        VPS_CALLBACK_URL: 'https://webhook.watch/abc',
        VPS_HTTP_PORT: '8080',
        VPS_NETWORK: 'mainnet',
        VPS_MAX_COST_PER_EXECUTION: '123',
      }
    )
    expect(resolved).toMatchObject({
      image: 'ubuntu',
      minMemory: '2GB',
      minStorage: '10GB',
      minComputeScore: '100',
      minCpuMultiScore: '200',
      authorizedSshKey: SSH_KEY,
      duration: '2h',
      callbackUrl: 'https://webhook.watch/abc',
      httpPort: '8080',
      network: 'mainnet',
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
  test('defaults: pinned tunnel bundle, 24h onetime execution, canary', () => {
    const { config, envVars, clientId, domain, sshCommand } = buildVpsConfig({
      authorizedSshKey: SSH_KEY,
    })

    expect(config.projectName).toBe(`vps-${clientId}`)
    expect(config.fileUrl).toBe(TUNNEL_SCRIPT_IPFS)
    expect(config.entrypoint).toBe('start.sh')
    expect(config.runtime).toBe(DeploymentRuntime.Shell)
    expect(config.image).toEqual(VPS_IMAGE_PRESETS.ubuntu)
    expect(config.network).toBe('canary')
    expect(config.execution).toEqual({
      type: 'onetime',
      maxExecutionTimeInMs: 24 * 60 * 60 * 1000,
    })
    expect(config.numberOfReplicas).toBe(1)
    expect(config.onlyAttestedDevices).toBe(true)
    expect(config.requiredModules).toEqual(['Shell'])
    expect(config.maxCostPerExecution).toBe(DEFAULT_VPS_MAX_COST_PER_EXECUTION)

    expect(clientId).toMatch(/^[0-9a-f]{16}$/)
    expect(domain).toBe(`${clientId}.canary.acu.run`)
    expect(sshCommand).toContain(`root@${domain}`)

    // The tunnel key is generated locally; NETWORK steers tunnel.py's relays.
    const keys = envVars.map((v) => v.key)
    expect(keys).toEqual(['TUNNEL_KEY', 'SSH_AUTHORIZED_KEY', 'NETWORK'])
    expect(envVars).toContainEqual({ key: 'NETWORK', value: 'canary' })
    expect(envVars).toContainEqual({
      key: 'SSH_AUTHORIZED_KEY',
      value: SSH_KEY,
    })
  })

  test('each call generates a fresh tunnel identity', () => {
    const a = buildVpsConfig({ authorizedSshKey: SSH_KEY })
    const b = buildVpsConfig({ authorizedSshKey: SSH_KEY })
    expect(a.clientId).not.toBe(b.clientId)
  })

  test('maps min-* options to benchmarkFilters', () => {
    const { config } = buildVpsConfig({
      authorizedSshKey: SSH_KEY,
      minMemory: '2GB',
      minStorage: '10GB',
      minComputeScore: '100',
      minCpuMultiScore: '200',
    })
    expect(config.benchmarkFilters).toMatchObject({
      minRamTotalBytes: 2_000_000_000,
      minStorageAvailBytes: 10_000_000_000,
      minCpuSingleCoreScore: 100,
      minCpuMultiCoreScore: 200,
    })
  })

  test('forwards callback URL and http port env vars', () => {
    const { envVars, domain } = buildVpsConfig({
      authorizedSshKey: SSH_KEY,
      callbackUrl: 'https://webhook.watch/abc',
      httpPort: '8080',
      network: 'mainnet',
    })
    expect(domain).toMatch(/\.acu\.run$/)
    expect(envVars).toContainEqual({ key: 'NETWORK', value: 'mainnet' })
    expect(envVars).toContainEqual({
      key: 'CALLBACK_URL',
      value: 'https://webhook.watch/abc',
    })
    expect(envVars).toContainEqual({ key: 'HTTP_PORT', value: '8080' })
  })

  test('devnet uses canary tunnel relays and domain but keeps devnet in the config', () => {
    const { config, envVars, domain, clientId } = buildVpsConfig({
      authorizedSshKey: SSH_KEY,
      network: 'devnet',
    })
    expect(config.network).toBe('devnet')
    expect(envVars).toContainEqual({ key: 'NETWORK', value: 'canary' })
    expect(domain).toBe(`${clientId}.canary.acu.run`)
  })

  test('parses duration strings and reward', () => {
    const { config } = buildVpsConfig({
      authorizedSshKey: SSH_KEY,
      duration: '90m',
      maxCostPerExecution: '42',
    })
    expect(config.execution).toEqual({
      type: 'onetime',
      maxExecutionTimeInMs: 90 * 60 * 1000,
    })
    expect(config.maxCostPerExecution).toBe(42)
  })

  test('requires an SSH public key', () => {
    expect(() => buildVpsConfig({})).toThrow(/SSH public key/i)
  })

  test('rejects unknown image alias, bad duration, bad network, bad numbers', () => {
    const base = { authorizedSshKey: SSH_KEY }
    expect(() => buildVpsConfig({ ...base, image: 'arch' })).toThrow(
      /Unknown image/
    )
    expect(() => buildVpsConfig({ ...base, duration: 'soon' })).toThrow(
      /duration/i
    )
    expect(() => buildVpsConfig({ ...base, network: 'testnet' })).toThrow(
      /network/i
    )
    expect(() => buildVpsConfig({ ...base, minComputeScore: 'fast' })).toThrow(
      /min-compute-score/i
    )
    expect(() => buildVpsConfig({ ...base, httpPort: '80' })).toThrow(
      /http-port/i
    )
  })

  test('produces a config accepted by validateCliConfig', async () => {
    const { validateCliConfig } =
      await import('../src/util/validateCliConfig.js')
    const { config } = buildVpsConfig({
      authorizedSshKey: SSH_KEY,
      minMemory: '2GB',
      network: 'canary',
    })
    const result = validateCliConfig(config)
    expect(result.success).toBe(true)
  })
})
