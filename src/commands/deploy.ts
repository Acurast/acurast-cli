import { Command, Option } from 'commander'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { Listr } from 'listr2'
import { BigNumber } from 'bignumber.js'
import { confirm, select, input } from '@inquirer/prompts'

import {
  loadAcurastConfig,
  deployProject,
  NOOP_LOGGER,
} from '@acurast/sdk/deploy'
import {
  walletFromMnemonic,
  getBalance,
  convertConfigToJob,
  DEFAULT_START_DELAY,
  isStartAtMsFromNow,
  isStartAtTimestamp,
  jobIdFromChainJson,
  listAssignedProcessorAddressesForJob,
} from '@acurast/sdk/chain'
import { parseByteSize, hasBenchmarkFilters } from '@acurast/sdk/chain'
import { checkMatch } from '@acurast/sdk/matcher'
import { DeploymentStatus, AssignmentStrategyVariant } from '@acurast/sdk/types'
import { validateCliConfig } from '../util/validateCliConfig.js'
import type {
  JobRegistration,
  AcurastProjectConfig,
  EnvVar,
} from '@acurast/sdk/types'
import { checkMatchWithReward } from '@acurast/sdk/matcher'
import type { PricingAdvice } from '@acurast/sdk/matcher'
import {
  getDevtoolsViewKey,
  buildDevtoolsUrl,
  injectDevtoolsSnippet,
} from '@acurast/devtools'

import {
  getEnv,
  validateDeployEnvVars,
  getProjectEnvVars,
  getRpcForNetwork,
  getSymbolForNetwork,
  getMatcherUrlForNetwork,
  getIpfsConfig,
  getHubUrl,
  type CliNetwork,
} from '../config.js'
import type { AcurastSigner } from '@acurast/sdk/chain'
import {
  getSigningMode,
  getLoggedInAddress,
  getExpiredAuth,
  touchAuth,
} from '../util/authStore.js'
import {
  signingNoticeLine,
  expiredSessionMessage,
} from '../util/signingNotice.js'
import { startSignServer } from '../util/cliServer.js'
import { RemoteSigner } from '../acurast/remoteSigner.js'
import { buildDeploySummary } from '../acurast/deploySummary.js'
import { storeDeployment } from '../acurast/storeDeployment.js'
import { acurastColor } from '../util.js'
import { humanTime } from '../util/humanTime.js'
import { consoleOutput } from '../util/console-output.js'
import { printBundleContents } from '../util/printBundleContents.js'
import { getFaucetLinkForAddress } from '../constants.js'
import * as ora from '../util/ora.js'
import { filelogger } from '../util/fileLogger.js'
import { fetchAndDisplayPricing } from '../util/fetchAndDisplayPricing.js'
import { LocalStorage } from '../util/LocalStorage.js'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const ACURAST_DECIMALS = 12

/**
 * Build the signer for a deploy. In `local` mode this is the mnemonic-derived
 * `KeyringPair` (default/fallback). In `remote` mode the browser wallet signs:
 * we start a local bridge server and return an injected {@link RemoteSigner}
 * bound to the address persisted by `acurast login`.
 */
/**
 * Render an on-chain job id as the composite "Acurast:<owner>:<number>" form.
 *
 * `jobIds[0]` from the match event is the `[MultiOrigin, number]` tuple, and
 * the origin carries the owning account. Returns undefined for shapes we
 * cannot read, or for non-Acurast origins, whose consumer is raw bytes rather
 * than an account — callers fall back to the bare number.
 */
export function compositeDeploymentId(raw: unknown): string | undefined {
  if (!Array.isArray(raw) || raw.length < 2) return undefined

  const [origin, number] = raw as [unknown, unknown]
  if (origin === null || typeof origin !== 'object') return undefined

  const entries = Object.entries(origin as Record<string, unknown>)
  const acurast = entries.find(([key]) => key.toLowerCase() === 'acurast')
  if (acurast === undefined || typeof acurast[1] !== 'string') return undefined

  const seq = String(number)
  if (!/^\d+$/.test(seq)) return undefined

  return `Acurast:${acurast[1]}:${seq}`
}

export async function resolveSigner(
  mode: 'local' | 'remote',
  config: AcurastProjectConfig,
  ipfsRef: { value: string | null }
): Promise<{ wallet: AcurastSigner; cleanup: () => void }> {
  if (mode === 'remote') {
    const address = getLoggedInAddress()
    if (!address) {
      throw new Error(
        'Remote signing requires a logged-in address. Run `acurast login` first, or set ACURAST_MNEMONIC.'
      )
    }
    const signServer = await startSignServer(getHubUrl())
    let closed = false
    const cleanup = (): void => {
      if (closed) return
      closed = true
      try {
        signServer.close()
      } catch {
        // ignore
      }
    }
    // `process.exit()` bypasses try/finally, so guarantee the server is closed
    // on normal exit and on Ctrl-C / termination.
    process.once('exit', cleanup)
    process.once('SIGINT', () => {
      cleanup()
      process.exit(130)
    })
    process.once('SIGTERM', () => {
      cleanup()
      process.exit(143)
    })

    const signer = new RemoteSigner({
      bridgeUrl: signServer.bridgeUrl,
      requestSignature: signServer.requestSignature,
      getSummary: (_payload, callIndex) =>
        buildDeploySummary(config, {
          kind: callIndex === 0 ? 'deploy' : 'setEnvironments',
          ipfsRef: ipfsRef.value,
        }),
      onOpen: (_id, url) => {
        console.log(
          '\nOpening your browser to sign the transaction with your wallet...'
        )
        console.log(`If it does not open automatically, visit:\n  ${url}\n`)
      },
    })
    touchAuth()
    return { wallet: { address, signer }, cleanup }
  }
  return {
    wallet: await walletFromMnemonic(getEnv('ACURAST_MNEMONIC'), {
      name: 'AcurastCli',
    }),
    cleanup: () => {},
  }
}

export async function promptPricingAdjustment(
  advice: PricingAdvice,
  config: AcurastProjectConfig,
  matcherUrl: string,
  accountId: string,
  options: { output: 'text' | 'json' }
): Promise<string | 'abort' | undefined> {
  const symbol = getSymbolForNetwork(config.network)

  if (advice.status === 'sufficient') {
    return undefined // No adjustment needed
  }

  if (advice.status === 'overpaying') {
    const suggestedDisplay = advice.suggestedPrice
      ? new BigNumber(advice.suggestedPrice)
          .shiftedBy(-ACURAST_DECIMALS)
          .toFixed()
      : null

    const choices: { value: string; name: string }[] = []
    if (suggestedDisplay && advice.suggestedPrice) {
      choices.push({
        value: 'suggested',
        name: `Lower to suggested price (${suggestedDisplay} ${symbol})`,
      })
    }
    choices.push(
      { value: 'keep', name: 'Keep current price' },
      { value: 'custom', name: 'Enter a custom price' }
    )

    const action = await select({
      message: 'Your price is higher than needed. What would you like to do?',
      choices,
    })

    if (action === 'keep') return undefined
    if (action === 'suggested' && advice.suggestedPrice) {
      return advice.suggestedPrice.toFixed()
    }
    if (action === 'custom') {
      return promptCustomPrice(config, matcherUrl, accountId, symbol)
    }
  }

  if (advice.status === 'insufficient') {
    const suggestedDisplay = advice.suggestedPrice
      ? new BigNumber(advice.suggestedPrice)
          .shiftedBy(-ACURAST_DECIMALS)
          .toFixed()
      : null

    const choices: { value: string; name: string }[] = []
    if (suggestedDisplay && advice.suggestedPrice) {
      choices.push({
        value: 'suggested',
        name: `Use suggested price (${suggestedDisplay} ${symbol} — covers ${advice.requiredProcessors} ${advice.requiredProcessors === 1 ? 'processor' : 'processors'})`,
      })
    }
    choices.push(
      { value: 'custom', name: 'Enter a custom price' },
      { value: 'keep', name: 'Continue with current price (may not match)' },
      { value: 'abort', name: 'Abort deployment' }
    )

    const action = await select({
      message:
        'Not enough processors at your current price. What would you like to do?',
      choices,
    })

    if (action === 'abort') return 'abort'
    if (action === 'keep') return undefined
    if (action === 'suggested' && advice.suggestedPrice) {
      return advice.suggestedPrice.toFixed()
    }
    if (action === 'custom') {
      return promptCustomPrice(config, matcherUrl, accountId, symbol)
    }
  }

  return undefined
}

async function promptCustomPrice(
  config: AcurastProjectConfig,
  matcherUrl: string,
  accountId: string,
  symbol: string,
  retries: number = 3
): Promise<string | 'abort' | undefined> {
  for (let i = 0; i < retries; i++) {
    const priceStr = await input({
      message: `Enter price in ${symbol} (e.g., 0.05):`,
      validate: (val) => {
        const n = new BigNumber(val)
        if (n.isNaN() || n.lte(0)) return 'Please enter a valid positive number'
        return true
      },
    })

    const priceSatoshi = new BigNumber(priceStr)
      .shiftedBy(ACURAST_DECIMALS)
      .integerValue(BigNumber.ROUND_CEIL)

    // Verify match with the new price
    const job = convertConfigToJob({
      ...config,
      maxCostPerExecution: priceSatoshi.toNumber(),
    })
    const result = await checkMatchWithReward(
      matcherUrl,
      config,
      job,
      accountId,
      priceSatoshi.toFixed()
    )

    if (result.ok) {
      const matched = result.data.matched_processors
      console.log(
        `  At ${priceStr} ${symbol}: ${matched} ${matched === 1 ? 'processor' : 'processors'} matched (${config.numberOfReplicas} required)`
      )

      if (result.data.matched_processors >= config.numberOfReplicas) {
        const proceed = await confirm({
          message: `Use ${priceStr} ${symbol} per execution?`,
          default: true,
        })
        if (proceed) return priceSatoshi.toFixed()
      } else {
        if (i < retries - 1) {
          console.log('  Still not enough processors. Try a higher price.')
        }
      }
    } else {
      console.log(`  Could not verify price: ${result.error}`)
    }
  }

  const action = await select({
    message: 'Could not find a sufficient price. What would you like to do?',
    choices: [
      { value: 'keep', name: 'Continue with original price' },
      { value: 'abort', name: 'Abort deployment' },
    ],
  })

  return action === 'abort' ? 'abort' : undefined
}

export const addCommandDeploy = (program: Command): Command => {
  const deployCmd = program
    .command('deploy [project]')
    // Options shared with the `vps` subcommand (e.g. --dry-run) must not be
    // consumed by `deploy` when they appear after the subcommand name.
    .enablePositionalOptions()
    .description('Deploy the current project to the Acurast platform.')
    .addOption(
      new Option(
        '-d, --dry-run',
        'Run the deploy step without actually deploying the project.'
      )
    )
    .addOption(
      new Option(
        '-o, --output <format>',
        'Output a json on each of the steps of the deployment process. This is useful if the CLI is started from a script or another program.'
      )
        .choices(['text', 'json'])
        .default('text')
    )
    .addOption(
      new Option(
        '-ee, --exit-early',
        'Do not wait for the deployment to finish. The CLI will exit as soon as it has submitted the deployment to the Acurast platform. Note: If environment variables are set, the CLI will have to wait longer.'
      )
    )
    .addOption(
      new Option(
        '-n, --non-interactive',
        'Do not ask for any input. Use this when triggering the CLI in a CD/CI pipeline.'
      )
    )
    .addOption(new Option('-u, --only-upload', 'Only upload to IPFS and quit.'))
    .addOption(
      new Option(
        '--min-memory <size>',
        'Minimum total RAM (e.g. 4GB, 512MiB). Merges with benchmarkFilters in acurast.json.'
      )
    )
    .addOption(
      new Option(
        '--min-cpu-score <n>',
        'Minimum CPU single-core benchmark score'
      ).argParser((v) => {
        const n = Number.parseInt(v, 10)
        if (Number.isNaN(n) || n < 0) {
          throw new Error(`Invalid --min-cpu-score: ${v}`)
        }
        return n
      })
    )
    .addOption(
      new Option(
        '--min-storage <size>',
        'Minimum available storage capacity (e.g. 64GB)'
      )
    )
    .addOption(
      new Option(
        '--min-cpu-multi-score <n>',
        'Minimum CPU multi-core benchmark score'
      ).argParser((v) => {
        const n = Number.parseInt(v, 10)
        if (Number.isNaN(n) || n < 0) {
          throw new Error(`Invalid --min-cpu-multi-score: ${v}`)
        }
        return n
      })
    )
    .action(
      async (
        project: string,
        options: {
          dryRun?: boolean
          output: 'text' | 'json'
          exitEarly?: boolean
          // Currently this command has no interactive parts, so this option is not used
          nonInteractive?: boolean
          onlyUpload?: boolean
          minMemory?: string
          minCpuScore?: number
          minStorage?: string
          minCpuMultiScore?: number
        }
      ) => {
        const log = consoleOutput(options.output)
        const toAcurastColor = (text: string) => {
          if (options.output === 'json') {
            return text
          }
          return acurastColor(text)
        }
        const DEBUG = getEnv('DEBUG')
        if (DEBUG === 'true' && options) {
          // console.log("Options", options);
        }

        let config
        try {
          config = loadAcurastConfig({ project })
        } catch (e: any) {
          log(e.message)
          return
        }
        // console.log(config);

        if (!config) {
          throw new Error('No project found')
        }

        const configResult = validateCliConfig(config)

        if (!configResult.success) {
          log('')
          log('⚠️ Project config is invalid:')
          log('')
          log(configResult.error)

          filelogger.error(
            `Config is invalid ${JSON.stringify(configResult.error)}`
          )

          return
        }

        config = configResult.data

        try {
          const bf = { ...config.benchmarkFilters }
          if (options.minMemory !== undefined) {
            bf.minRamTotalBytes = Number(parseByteSize(options.minMemory))
          }
          if (options.minCpuScore !== undefined) {
            bf.minCpuSingleCoreScore = options.minCpuScore
          }
          if (options.minStorage !== undefined) {
            bf.minStorageAvailBytes = Number(parseByteSize(options.minStorage))
          }
          if (options.minCpuMultiScore !== undefined) {
            bf.minCpuMultiCoreScore = options.minCpuMultiScore
          }
          if (
            options.minMemory !== undefined ||
            options.minCpuScore !== undefined ||
            options.minStorage !== undefined ||
            options.minCpuMultiScore !== undefined
          ) {
            config.benchmarkFilters = bf
          }
        } catch (e: any) {
          log(`Invalid benchmark deploy option: ${e.message}`)
          return
        }

        const benchValidation = validateCliConfig(config)
        if (!benchValidation.success) {
          log('')
          log('⚠️ Project config is invalid after benchmark options:')
          log('')
          log(benchValidation.error)
          return
        }
        config = benchValidation.data

        await executeDeployFlow(
          config,
          () => getProjectEnvVars(config),
          options,
          configResult.notes
        )
      }
    )

  return deployCmd
}

export interface DeployFlowOptions {
  dryRun?: boolean
  output: 'text' | 'json'
  exitEarly?: boolean
  nonInteractive?: boolean
  onlyUpload?: boolean
}

/**
 * The shared deploy pipeline: signer resolution, balance check, pricing
 * advice, on-chain submission and progress rendering. Used by
 * `acurast deploy` and `acurast deploy vps`.
 */
export async function executeDeployFlow(
  config: AcurastProjectConfig & { network: CliNetwork },
  getEnvVars: () => EnvVar[],
  options: DeployFlowOptions,
  notes?: { message: string }[],
  beforeExit?: (info: {
    jobId?: unknown
    jobIdString?: string
  }) => void | Promise<void>
): Promise<void> {
  const log = consoleOutput(options.output)
  const toAcurastColor = (text: string) => {
    if (options.output === 'json') {
      return text
    }
    return acurastColor(text)
  }
  const signingMode = getSigningMode()
  filelogger.info(`Signing mode: ${signingMode}`)

  // An aged-out login silently resolves back to `local`, so without a mnemonic
  // the env-var check below would blame a missing ACURAST_MNEMONIC. Say what
  // actually happened instead.
  if (signingMode === 'local' && !process.env.ACURAST_MNEMONIC) {
    const expired = getExpiredAuth()
    if (expired) {
      filelogger.warn(
        `Login expired (${expired.scope}), last logged in at ${expired.record.loggedInAt}`
      )
      log(expiredSessionMessage(expired))
      return
    }
  }

  try {
    validateDeployEnvVars({ requireMnemonic: signingMode === 'local' })
  } catch (e: any) {
    filelogger.error(`Deploy env vars are invalid ${JSON.stringify(e.message)}`)
    log(e.message)
    return
  }

  let envVars: EnvVar[] = []

  try {
    envVars = getEnvVars()
  } catch (e: any) {
    filelogger.error(
      `Project env vars are invalid ${JSON.stringify(e.message)}`
    )
    log(e.message)
    return
  }

  log('')
  log(`Deploying project "${config.projectName}"`)
  log('')

  if (notes) {
    filelogger.warn(
      `Project config is valid, but here are some notes: ${JSON.stringify(
        notes
      )}`
    )
    log('⚠️ Project config is valid, but here are some notes:')
    notes.forEach((issue) => {
      log(`- ${issue.message}`)
    })
    log('')
  }

  const spinner = ora.default('Fetching account balance...')
  spinner.start()

  // Primed from the `Uploaded` status callback so the remote-signing
  // summary shown on the hub can include the IPFS reference.
  const ipfsRef = { value: null as string | null }
  const { wallet } = await resolveSigner(signingMode, config, ipfsRef)

  log(signingNoticeLine(signingMode, wallet.address))
  log('')

  const rpcEndpoint = getRpcForNetwork(config.network)
  filelogger.info(`Connecting to ${config.network} RPC: ${rpcEndpoint}`)
  const wsProvider = new WsProvider(rpcEndpoint)
  const api = await ApiPromise.create({
    provider: wsProvider,
    noInitWarn: true,
  })

  const balance = await getBalance(api, wallet.address)

  const symbol = getSymbolForNetwork(config.network)

  filelogger.debug(`Balance: ${balance} ${symbol}`)

  await api.disconnect()

  spinner.stop()

  if (balance === 0) {
    if (config.network === 'canary') {
      log(
        `Your balance is 0. Visit ${toAcurastColor(
          getFaucetLinkForAddress(wallet.address)
        )} to get some tokens.`
      )
    } else {
      log(`Your balance is 0. You need ${symbol} tokens to deploy.`)
      log(
        `Acquire ${symbol} (see ${toAcurastColor('https://docs.acurast.com/token-holders/how-to-get-acu/')}) and send it to your address:`
      )
      log(`  ${toAcurastColor(wallet.address)}`)
    }
    log('')
    return
  } else if (balance < 1) {
    if (config.network === 'canary') {
      log(
        `Your balance is low. Visit ${toAcurastColor(
          getFaucetLinkForAddress(wallet.address)
        )} to get some tokens.`
      )
    } else {
      log(`Your balance is low. You need more ${symbol} tokens to deploy.`)
      log(
        `Acquire ${symbol} (see ${toAcurastColor('https://docs.acurast.com/token-holders/how-to-get-acu/')}) and send it to your address:`
      )
      log(`  ${toAcurastColor(wallet.address)}`)
    }
    log('')
  }

  log('The CLI will use the following address: ' + wallet.address)
  log('')

  // TODO: Deduplicate this code
  const now = Date.now()
  let startTime = now + DEFAULT_START_DELAY
  if (config.startAt) {
    if (isStartAtMsFromNow(config.startAt)) {
      startTime = now + config.startAt.msFromNow
    }
    if (isStartAtTimestamp(config.startAt)) {
      startTime = new Date(config.startAt.timestamp).getTime()
    }
  }

  if (startTime < now) {
    log(`Start time cannot be in the past`)
    filelogger.error(`Start time cannot be in the past: ${startTime}`)
    return
  }

  filelogger.debug(`Start time: ${startTime}`)

  filelogger.debug(
    `The deployment will be scheduled to start in ${humanTime(now - startTime, true)}. (${new Date(startTime).toLocaleString()}) It will run for ${
      config.execution.type === 'onetime'
        ? humanTime(config.execution.maxExecutionTimeInMs, true)
        : humanTime(
            config.execution.numberOfExecutions * config.execution.intervalInMs
          )
    }.`
  )

  log(
    `The deployment will be scheduled to start in ${toAcurastColor(
      `${humanTime(now - startTime, true)}`
    )}. (${new Date(startTime).toLocaleString()}) It will run for ${toAcurastColor(
      config.execution.type === 'onetime'
        ? humanTime(config.execution.maxExecutionTimeInMs, true)
        : humanTime(
            config.execution.numberOfExecutions * config.execution.intervalInMs
          )
    )}.`
  )
  log('')

  // Gate on the actual env vars, not config.includeEnvironmentVariables:
  // `deploy vps` passes vars directly without listing them in the config. If
  // this is false the CLI exits right after acknowledgements — while the SDK
  // is still submitting the env vars — and they never reach the processor.
  const hasEnvironmentVariables: boolean = envVars.length > 0

  // --- Pricing check via matcher API ---
  const matcherUrl = getMatcherUrlForNetwork(config.network)
  const isInteractive = !options.nonInteractive && options.output === 'text'
  const hasInstantMatch =
    config.assignmentStrategy.type === AssignmentStrategyVariant.Single &&
    config.assignmentStrategy.instantMatch &&
    config.assignmentStrategy.instantMatch.length > 0

  if (hasInstantMatch) {
    log('Instant match processors specified — skipping market pricing check.')
    log('')
  }

  const pricingSpinner = ora.default('Checking processor pricing...')
  const pricingAdvice = await fetchAndDisplayPricing(
    config,
    wallet.address,
    options,
    pricingSpinner
  )

  // Interactive pricing adjustment (deploy-specific)
  if (pricingAdvice && isInteractive && !options.dryRun && matcherUrl) {
    const adjustedPrice = await promptPricingAdjustment(
      pricingAdvice,
      config,
      matcherUrl,
      wallet.address,
      options
    )
    if (adjustedPrice === 'abort') {
      log('Deployment aborted.')
      return
    }
    if (adjustedPrice !== undefined) {
      config.maxCostPerExecution = Number(adjustedPrice)
      log(
        `Updated max cost per execution to ${toAcurastColor(
          new BigNumber(adjustedPrice).shiftedBy(-12).toFixed()
        )} ${symbol}`
      )
      log('')
    }
  }

  if (hasBenchmarkFilters(config) && matcherUrl && !hasInstantMatch) {
    const previewJob = convertConfigToJob(config)
    const matchRes = await checkMatch(
      matcherUrl,
      config,
      previewJob,
      wallet.address
    )

    if (options.output === 'text') {
      if (matchRes.ok) {
        log(
          `Processors matching benchmark filters at current reward: ${matchRes.data.matched_processors} (${config.numberOfReplicas} required)`
        )
      } else {
        log(`Could not verify benchmark filter match: ${matchRes.error}`)
      }
      log(
        'Assigned processor addresses are listed from chain storage after the deployment is matched.'
      )
      log('')
    }

    // A dry run submits nothing, so an insufficient match must not abort it —
    // otherwise it never reaches the "Dry run, not deploying" exit.
    if (options.nonInteractive && !options.dryRun) {
      if (
        !matchRes.ok ||
        matchRes.data.matched_processors < config.numberOfReplicas
      ) {
        log(
          'Deploy aborted: benchmark filters do not yield enough processors at the current price (non-interactive mode).'
        )
        return
      }
    } else if (isInteractive && !options.dryRun) {
      const go = await confirm({
        message: 'Deploy with these benchmark filters?',
        default: true,
      })
      if (!go) {
        log('Deployment cancelled.')
        return
      }
    }
  }

  if (options.dryRun) {
    filelogger.debug('🧪 Dry run, not deploying.')
    log('🧪 Dry run, not deploying.')
    return
  }

  filelogger.debug('🚀 Deploying...')
  log('🚀 Deploying...')
  log('')

  const originalConfig = structuredClone(config)

  const deploymentTime = new Date()
  let jobRegistrationTemp: JobRegistration | undefined = undefined
  let deployedJobId: string | undefined = undefined
  let deployedJobIdRaw: unknown = undefined

  const job = convertConfigToJob(config)

  const devtoolsApiUrl = getEnv('ACURAST_DEVTOOLS_API_URL')

  const jobRegistration = deployProject(config, job, {
    wallet,
    rpcEndpoint,
    ipfs: getIpfsConfig(),
    envVars,
    onlyUpload: options.onlyUpload ?? false,
    keyStore: new LocalStorage(),
    logger: filelogger,
    transformBundle: async ({ zipPath, entrypoint }) => {
      const finalPath = config.enableDevtools
        ? await injectDevtoolsSnippet(zipPath, entrypoint, devtoolsApiUrl)
        : zipPath
      if (options.output === 'text') {
        printBundleContents(finalPath, config.projectName, log)
      }
      return finalPath
    },
    statusCallback: async (status: DeploymentStatus, data) => {
      // console.log(status, data)
      if (options.output === 'json') {
        log('', JSON.stringify({ status, data }))
      }
      if (status === DeploymentStatus.Uploaded) {
        // Make the IPFS reference available to the remote-signing summary.
        if (data?.ipfsHash) ipfsRef.value = data.ipfsHash as string
      } else if (status === DeploymentStatus.Prepared) {
        // console.log(status, data);
        jobRegistrationTemp = data.job as JobRegistration

        await storeDeployment(
          deploymentTime,
          originalConfig,
          jobRegistrationTemp
        )
      } else if (status === DeploymentStatus.Submit) {
        // txHash
        // console.log(status, data);
      } else if (status === DeploymentStatus.WaitingForMatch) {
        if (!jobRegistrationTemp) {
          throw new Error('Deployment Registration is null!')
        }
        deployedJobId = String(data.jobIds[0]?.[1] ?? data.jobIds[0])
        deployedJobIdRaw = data.jobIds[0]
        await storeDeployment(
          deploymentTime,
          originalConfig,
          jobRegistrationTemp,
          data.jobIds[0]
        )

        if (
          options.output === 'json' &&
          options.exitEarly &&
          !hasEnvironmentVariables
        ) {
          process.exit(0)
        }
        // jobIds
        // console.log(status, data);
      } else if (status === DeploymentStatus.Matched) {
        // console.log(status, data);
      } else if (status === DeploymentStatus.Acknowledged) {
        // acknowledged
        // console.log(status, data);
      } else if (status === DeploymentStatus.Started) {
        // console.log(status, data);
      } else if (status === DeploymentStatus.EnvironmentVariablesSet) {
        // console.log(status, data);
        if (
          options.output === 'json' &&
          options.exitEarly &&
          hasEnvironmentVariables
        ) {
          process.exit(0)
        }
      } else if (status === DeploymentStatus.ExecutionDone) {
        // console.log(status, data);
      } else if (status === DeploymentStatus.Finalized) {
        // console.log(status, data);
        process.exit(0)
      } else {
        throw new Error('Unknown status')
      }

      if (statusPromises[status]) {
        statusPromises[status].resolve(data)
      }
    },
  })

  type StatusPromises = {
    [key in DeploymentStatus]: {
      promise: Promise<any>
      resolve: (data: any) => void
    }
  }

  const statusPromises: StatusPromises = {
    [DeploymentStatus.Uploaded]: createStatusPromise(),
    [DeploymentStatus.Prepared]: createStatusPromise(),
    [DeploymentStatus.Submit]: createStatusPromise(),
    [DeploymentStatus.WaitingForMatch]: createStatusPromise(),
    [DeploymentStatus.Matched]: createStatusPromise(),
    [DeploymentStatus.Acknowledged]: createStatusPromise(),
    [DeploymentStatus.EnvironmentVariablesSet]: createStatusPromise(),
    [DeploymentStatus.Started]: createStatusPromise(),
    [DeploymentStatus.ExecutionDone]: createStatusPromise(),
    [DeploymentStatus.Finalized]: createStatusPromise(),
  }

  function createStatusPromise() {
    let resolveFunction
    const promise = new Promise<any>((resolve) => {
      resolveFunction = resolve
    })
    return { promise, resolve: resolveFunction! }
  }

  if (options.output === 'text') {
    async function awaitStatus(status: DeploymentStatus) {
      return statusPromises[status].promise
    }

    let count = 1_000_000 // TODO: replace with duration until start time
    let deployingTimer: NodeJS.Timeout
    const cancelUpdateTitle = (
      task: { title?: string | undefined },
      success: boolean
    ) => {
      deployingTimer && clearTimeout(deployingTimer)
      task.title = 'Deploying project'

      if (!success) {
        tasks.tasks.forEach((task) => {
          task.complete()
        })
      }
    }
    const updateTitle = (task: { title?: string | undefined }) => {
      deployingTimer = setTimeout(() => {
        task.title =
          'Deploying project (first execution scheduled in ' + count + 's)'
        // task.title =
        //   'Waiting for executions (first execution scheduled in ' +
        //   count +
        //   's)'
        if (count > 0) {
          count--
          updateTitle(task)
        } else {
          cancelUpdateTitle(task, false)
        }
      }, 1000)
    }

    const tasks = new Listr(
      [
        {
          title: 'Deploying project',
          task: (ctx, deployTask): Listr =>
            deployTask.newListr([
              {
                title: 'Submit to Acurast',
                task: async (ctx, task): Promise<void> => {
                  const { job } = await awaitStatus(DeploymentStatus.Prepared)

                  count = Math.floor(
                    (job.schedule.startTime - Date.now()) / 1000
                  )

                  updateTitle(tasks.tasks[0])

                  task.title = `Submitted to Acurast (${job.script})`
                },
              },
              {
                title: 'Waiting for deployment to be registered',
                task: async (ctx, task): Promise<void> => {
                  await awaitStatus(DeploymentStatus.Submit)

                  const { jobIds } = await awaitStatus(
                    DeploymentStatus.WaitingForMatch
                  )

                  task.title =
                    'Deployment registered' +
                    ` (ID: ${jobIds.map((jobId: any) => jobId[1]).join(' | ')})`
                },
              },
              {
                title: 'Waiting for deployment to be matched with processors',
                enabled: () =>
                  !options.exitEarly ||
                  (options.exitEarly && hasEnvironmentVariables),
                task: async (ctx, task): Promise<void> => {
                  const matchData = await awaitStatus(DeploymentStatus.Matched)
                  task.title = 'Matched'
                  if (options.output !== 'text' || !matchData?.jobIds?.length) {
                    return
                  }
                  const provider = new WsProvider(rpcEndpoint)
                  const api = await ApiPromise.create({
                    provider,
                    noInitWarn: true,
                  })
                  try {
                    log('')
                    log('Assigned processors:')
                    for (const rawJobId of matchData.jobIds as unknown[]) {
                      try {
                        const jobId = jobIdFromChainJson(rawJobId)
                        const addresses =
                          await listAssignedProcessorAddressesForJob(api, jobId)
                        if (addresses.length === 0) {
                          log(
                            `  Job ${jobId[1]}: no rows yet (storage may update shortly)`
                          )
                        } else {
                          log(`  Job ${jobId[1]}:`)
                          for (const a of addresses) {
                            log(`    ${a}`)
                          }
                        }
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : String(e)
                        filelogger.debug(
                          `assignedProcessors list failed: ${msg}`
                        )
                        log(`  (Could not list assigned processors: ${msg})`)
                      }
                    }
                    log('')
                  } finally {
                    await api.disconnect()
                  }
                },
              },
              {
                title: 'Waiting for processor acknowledgements',
                enabled: () =>
                  !options.exitEarly ||
                  (options.exitEarly && hasEnvironmentVariables),
                task: (ctx, task): Listr =>
                  task.newListr(
                    [
                      {
                        title: `Acknowledged by 0/${config.numberOfReplicas}`,
                        task: async (ctx, task): Promise<void> => {
                          filelogger.info(
                            `Waiting for processor acknowledgements: ${config.numberOfReplicas} expected`
                          )
                          let allAcknowledged = false
                          // while (!allAcknowledged) {
                          // TODO: Make reactive
                          const { acknowledged } = await awaitStatus(
                            DeploymentStatus.Acknowledged
                          )

                          filelogger.info(
                            `Acknowledged by ${acknowledged}/${config.numberOfReplicas}`
                          )
                          task.title = `Acknowledged by ${acknowledged}/${config.numberOfReplicas}`
                          // }
                        },
                      },
                      // {
                      //   title: 'DEMO: 5Ffda...fdkga',
                      //   task: async (ctx, task): Promise<void> => {
                      //     await delay(3000)
                      //   },
                      // },
                      // {
                      //   title: 'DEMO: 5Dcar...gdahs',
                      //   task: async (ctx, task): Promise<void> => {
                      //     await delay(2000)
                      //     throw new Error(
                      //       task.title + ' Processor did not acknowledge'
                      //     )
                      //   },
                      // },
                      // {
                      //   title: 'DEMO: 5Dacs...lwpfd',
                      //   task: async (ctx, task): Promise<void> => {
                      //     await delay(1000)
                      //   },
                      // },
                    ],
                    { concurrent: true, exitOnError: true }
                  ),
              },
              {
                title: 'Setting environment variables',
                enabled: () => hasEnvironmentVariables,
                task: async (ctx, task): Promise<void> => {
                  const result = await awaitStatus(
                    DeploymentStatus.EnvironmentVariablesSet
                  )
                  if (result?.error) {
                    throw result.error
                  }
                  task.title = `Environment variables set`
                },
              },
            ]),
        },
        // {
        //   title:
        //     'Waiting for executions (this may take a while, feel free to cancel this task and check back later)',
        //   task: (ctx, task): Listr =>
        //     task.newListr(
        //       [
        //         {
        //           title: 'Waiting for Execution',
        //           task: async (ctx, task): Promise<void> => {
        //             await delay(3000)
        //             task.title = 'DEMO: Execution succeeded'
        //           },
        //         },
        //         {
        //           title: 'Waiting for Execution',
        //           task: async (ctx, task): Promise<void> => {
        //             await delay(3000)
        //             throw new Error('DEMO: Execution failed')
        //           },
        //         },
        //       ],
        //       { exitOnError: false }
        //     ),
        // },
        // {
        //   title: 'Waiting for job to Finalize',
        //   task: async (ctx, task): Promise<void> => {
        //     await delay(3000)
        //     task.title = 'Finalized'
        //   },
        // },
      ],
      { concurrent: false, rendererOptions: { collapseSubtasks: false } }
    )

    jobRegistration
      .then((job) => {
        // console.log(job);
      })
      .catch((err) => {
        // console.error(err)
        // if (err.message) {
        //   throw new Error(err.message)
        // }
        throw err
      })
    try {
      await tasks.run()

      if (config.enableDevtools && deployedJobId) {
        try {
          // Send the full "Acurast:<owner>:<number>" id: the devtools API
          // resolves the owner from it to confirm we own this deployment. A
          // bare number leaves it dependent on an indexer lookup instead.
          const deploymentId = compositeDeploymentId(deployedJobIdRaw) ?? deployedJobId

          const viewKeyResponse = await getDevtoolsViewKey(deploymentId, {
            apiUrl: getEnv('ACURAST_DEVTOOLS_API_URL'),
            // The deployment's own signer: the API checks the signature
            // against the owner recorded on chain, so it must be the account
            // that registered the job. Also covers remote signing, where
            // there is no mnemonic to fall back on.
            signer: wallet,
            network: config.network,
            logger: filelogger,
          })
          log('')
          log(
            `DevTools: ${toAcurastColor(
              buildDevtoolsUrl(
                getEnv('ACURAST_DEVTOOLS_URL'),
                deployedJobId,
                viewKeyResponse.viewKey
              )
            )}`
          )
          log(
            `View key expires at ${new Date(viewKeyResponse.expiresAt).toLocaleString()}`
          )
          log('')
        } catch (e: any) {
          filelogger.error(`Failed to get devtools view key: ${e.message}`)
          log(`Warning: Could not retrieve DevTools view key: ${e.message}`)
        }
      }

      if (beforeExit) {
        await beforeExit({
          jobId: deployedJobIdRaw,
          jobIdString: deployedJobId,
        })
      }

      process.exit(0)
    } catch (e) {
      console.log('Error', e)
      process.exit(1)
    }
  }
}
