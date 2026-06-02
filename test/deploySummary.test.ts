import {
  AssignmentStrategyVariant,
  ScriptMutability,
  type AcurastProjectConfig,
} from '@acurast/sdk/types'
import { buildDeploySummary } from '../src/acurast/deploySummary.js'

const config: AcurastProjectConfig = {
  projectName: 'demo',
  fileUrl: 'index.js',
  network: 'canary',
  onlyAttestedDevices: true,
  assignmentStrategy: { type: AssignmentStrategyVariant.Single },
  execution: { type: 'onetime', maxExecutionTimeInMs: 30_000 },
  maxAllowedStartDelayInMs: 60_000,
  usageLimit: { maxMemory: 0, maxNetworkRequests: 0, maxStorage: 0 },
  numberOfReplicas: 2,
  minProcessorReputation: 0,
  maxCostPerExecution: 4_000_000_000,
  includeEnvironmentVariables: ['API_KEY', 'SECRET'],
  mutability: ScriptMutability.Mutable,
} as AcurastProjectConfig

describe('buildDeploySummary', () => {
  test('maps the project config into a human-readable summary', () => {
    const summary = buildDeploySummary(config, { kind: 'deploy', ipfsRef: 'ipfs://cid' })
    expect(summary).toMatchObject({
      kind: 'deploy',
      projectName: 'demo',
      network: 'canary',
      ipfsRef: 'ipfs://cid',
      executionType: 'onetime',
      numberOfReplicas: 2,
      attestedOnly: true,
      mutability: 'Mutable',
      symbol: 'cACU',
    })
    expect(summary.totalRuns).toBe(2) // 1 execution * 2 replicas
  })

  test('includes env var KEYS only — never the values', () => {
    const summary = buildDeploySummary(config, { kind: 'deploy', ipfsRef: null })
    expect(summary.envVarKeys).toEqual(['API_KEY', 'SECRET'])
    // The serialized summary must not leak anything resembling a value.
    expect(JSON.stringify(summary)).not.toContain('value')
  })

  test('labels the second signature as setEnvironments', () => {
    const summary = buildDeploySummary(config, { kind: 'setEnvironments', ipfsRef: 'ipfs://cid' })
    expect(summary.kind).toBe('setEnvironments')
  })

  test('ipfsRef may be null before upload completes', () => {
    expect(buildDeploySummary(config, { kind: 'deploy', ipfsRef: null }).ipfsRef).toBeNull()
  })
})
