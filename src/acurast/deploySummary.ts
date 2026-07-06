import type { AcurastProjectConfig } from '@acurast/sdk/types'
import { getFeeAnalysis } from '@acurast/sdk/matcher'
import { getSymbolForNetwork } from '../config.js'

/**
 * Human-readable description of an extrinsic the CLI is asking the browser
 * wallet to sign. The CLI already holds the rich project config + fee analysis,
 * so it sends this alongside the raw `SignerPayloadJSON` through the signing
 * bridge; the hub renders it verbatim (no SCALE decoding) before prompting the
 * wallet. Secret values are never included — only environment-variable KEYS.
 */
export interface DeploySummary {
  /** Which signature this is: the deploy extrinsic, or the later setEnvironments. */
  kind: 'deploy' | 'setEnvironments'
  projectName: string
  network: string
  /** `ipfs://<cid>` once the bundle is uploaded, or null if not yet known. */
  ipfsRef: string | null
  executionType: 'onetime' | 'interval' | string
  numberOfExecutions: number
  numberOfReplicas: number
  totalRuns: number
  maxCostPerExecutionCACU: string
  maxTotalCostCACU: string
  symbol: string
  attestedOnly: boolean
  mutability: string
  /** Environment-variable KEYS only — never the values. */
  envVarKeys: string[]
}

/**
 * Build a {@link DeploySummary} from the project config the CLI already has in
 * scope at deploy time. `ipfsRef` becomes available once the bundle is uploaded
 * (the deploy flow primes it from the `Uploaded`/`Prepared` status callback).
 */
export const buildDeploySummary = (
  config: AcurastProjectConfig,
  opts: { kind: DeploySummary['kind']; ipfsRef: string | null },
): DeploySummary => {
  const fee = getFeeAnalysis(config)
  return {
    kind: opts.kind,
    projectName: config.projectName,
    network: config.network,
    ipfsRef: opts.ipfsRef,
    executionType: config.execution.type,
    numberOfExecutions: fee.numberOfExecutions.toNumber(),
    numberOfReplicas: fee.numberOfReplicas.toNumber(),
    totalRuns: fee.totalRuns.toNumber(),
    maxCostPerExecutionCACU: fee.maxCostPerExecutionCACU.toFixed(),
    maxTotalCostCACU: fee.maxTotalCostCACU.toFixed(),
    symbol: getSymbolForNetwork(config.network),
    attestedOnly: config.onlyAttestedDevices ?? false,
    mutability: String(config.mutability ?? 'Immutable'),
    // KEYS ONLY — values are intentionally excluded so secrets never cross the bridge.
    envVarKeys: [...(config.includeEnvironmentVariables ?? [])],
  }
}
