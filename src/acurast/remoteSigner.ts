import type { Signer, SignerResult } from '@polkadot/api/types'
import type { SignerPayloadJSON, SignerPayloadRaw } from '@polkadot/types/types'
import { randomBytes } from 'node:crypto'
import open from 'open'
import type { DeploySummary } from './deploySummary.js'

export interface RemoteSignerDeps {
  /** Build the local bridge URL for a given request id. */
  bridgeUrl: (id: string) => string
  /** Register a payload and resolve when the browser wallet returns a signature. */
  requestSignature: (
    id: string,
    payload: unknown,
    summary?: DeploySummary,
    timeoutMs?: number,
  ) => Promise<string>
  /**
   * Build a human-readable summary of what is being signed, shown on the hub.
   * `callIndex` is 0 for the first signature (the deploy extrinsic) and 1+ for
   * subsequent ones (setEnvironments).
   */
  getSummary?: (payload: SignerPayloadJSON | SignerPayloadRaw, callIndex: number) => DeploySummary | undefined
  /** Notification just before the browser is opened; receives the bridge URL. */
  onOpen?: (id: string, bridgeUrl: string) => void
}

/**
 * A `@polkadot/api` {@link Signer} that delegates signing to a browser wallet
 * via the local bridge server. Each `signPayload`/`signRaw` call registers the
 * payload, opens the bridge page, and waits for the wallet's signature.
 *
 * A single instance serves multiple sequential signatures (a deploy signs
 * `deploy`, then later `setEnvironments`), so polkadot.js assembles and submits
 * the extrinsic over the CLI's own RPC connection — the CLI keeps full control
 * of submission + progress reporting.
 */
export class RemoteSigner implements Signer {
  private counter = 0

  constructor(private readonly deps: RemoteSignerDeps) {}

  public async signPayload(payload: SignerPayloadJSON): Promise<SignerResult> {
    return this.request(payload)
  }

  public async signRaw(raw: SignerPayloadRaw): Promise<SignerResult> {
    return this.request(raw)
  }

  private async request(payload: SignerPayloadJSON | SignerPayloadRaw): Promise<SignerResult> {
    const callIndex = this.counter
    const id = ++this.counter
    // Unguessable routing id (the bridge endpoints are additionally token-guarded).
    const reqId = randomBytes(16).toString('hex')
    const summary = this.deps.getSummary?.(payload, callIndex)
    const signaturePromise = this.deps.requestSignature(reqId, payload, summary)
    const url = this.deps.bridgeUrl(reqId)
    this.deps.onOpen?.(reqId, url)
    try {
      await open(url)
    } catch {
      // Non-interactive environment: the bridge URL was surfaced via onOpen.
    }
    const signature = await signaturePromise
    return { id, signature: signature as `0x${string}` }
  }
}
