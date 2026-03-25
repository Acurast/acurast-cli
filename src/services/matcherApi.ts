import axios from 'axios'
import type { AcurastProjectConfig, JobRegistration } from '../types.js'
import { RequiredModules } from '../types.js'
import { convertConfigToJob } from '../acurast/convertConfigToJob.js'

const TIMEOUT_MS = 10_000

// --- Result wrapper ---

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// --- Response types ---

export interface MatchCheckResult {
  matchable: boolean
  matched_processors: number
}

export interface AveragePriceResult {
  average_price: string | null
}

export interface PriceDistributionBucket {
  range_min: string
  range_max: string
  count: number
}

export interface PriceDistributionResult {
  buckets: PriceDistributionBucket[]
}

export interface ProcessorCountResult {
  count: number
}

// --- JSON-RPC helpers ---

let rpcId = 0

async function jsonRpcCall<T>(
  url: string,
  method: string,
  params: Record<string, unknown>
): Promise<ApiResult<T>> {
  try {
    const response = await axios.post(
      url,
      {
        jsonrpc: '2.0',
        id: ++rpcId,
        method,
        params,
      },
      {
        headers: { 'Content-Type': 'application/json' },
        timeout: TIMEOUT_MS,
      }
    )

    if (response.data.error) {
      return {
        ok: false,
        error: response.data.error.message ?? JSON.stringify(response.data.error),
      }
    }

    return { ok: true, data: response.data.result as T }
  } catch (err: any) {
    const message =
      err.code === 'ECONNABORTED'
        ? 'Matcher API request timed out'
        : err.message ?? 'Unknown error'
    return { ok: false, error: message }
  }
}

// --- Config-to-API mapping ---

export function jobToMatchCheckParams(
  config: AcurastProjectConfig,
  job: JobRegistration,
  accountId: string
): Record<string, unknown> {
  const minProcessorVersion =
    job.extra.requirements.processorVersion?.min.map((v) => ({
      platform: v.platform,
      build_number: v.buildNumber,
    })) ?? null

  return {
    kind: config.assignmentStrategy.type,
    account_id: accountId,
    start_time: job.schedule.startTime,
    end_time: job.schedule.endTime,
    interval: job.schedule.interval,
    duration: job.schedule.duration,
    max_start_delay: job.schedule.maxStartDelay,
    slots: job.extra.requirements.slots,
    reward: String(job.extra.requirements.reward),
    min_reputation: config.minProcessorReputation || null,
    min_processor_version: minProcessorVersion,
    min_metrics: null,
    requires_encryption:
      config.requiredModules?.includes(RequiredModules.DataEncryption) ?? false,
    requires_llm:
      config.requiredModules?.includes(RequiredModules.LLM) ?? false,
    only_verified: config.onlyAttestedDevices,
  }
}

// --- Public API functions ---

export async function checkMatch(
  matcherUrl: string,
  config: AcurastProjectConfig,
  job: JobRegistration,
  accountId: string
): Promise<ApiResult<MatchCheckResult>> {
  const params = jobToMatchCheckParams(config, job, accountId)
  return jsonRpcCall<MatchCheckResult>(
    `${matcherUrl}/matches`,
    'check',
    params
  )
}

export async function checkMatchWithReward(
  matcherUrl: string,
  config: AcurastProjectConfig,
  job: JobRegistration,
  accountId: string,
  reward: string
): Promise<ApiResult<MatchCheckResult>> {
  const params = jobToMatchCheckParams(config, job, accountId)
  params.reward = reward
  return jsonRpcCall<MatchCheckResult>(
    `${matcherUrl}/matches`,
    'check',
    params
  )
}

export async function getAveragePrice(
  matcherUrl: string,
  duration: number,
  maxAge: number = 60
): Promise<ApiResult<AveragePriceResult>> {
  return jsonRpcCall<AveragePriceResult>(`${matcherUrl}/processors`, 'average_price', {
    'max-age': maxAge,
    duration,
  })
}

export async function getPriceDistribution(
  matcherUrl: string,
  duration: number,
  buckets: number = 10,
  maxAge: number = 60
): Promise<ApiResult<PriceDistributionResult>> {
  return jsonRpcCall<PriceDistributionResult>(
    `${matcherUrl}/processors`,
    'price_distribution',
    {
      'max-age': maxAge,
      duration,
      buckets,
    }
  )
}

export async function getProcessorCount(
  matcherUrl: string,
  maxAge: number = 60
): Promise<ApiResult<ProcessorCountResult>> {
  return jsonRpcCall<ProcessorCountResult>(
    `${matcherUrl}/processors`,
    'count',
    { 'max-age': maxAge }
  )
}
