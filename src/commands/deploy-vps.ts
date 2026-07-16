import { Command, Option } from 'commander'
import { confirm, input, select } from '@inquirer/prompts'

import { parseByteSize, jobToNumber } from '@acurast/sdk/chain'
import { probeVpsReady } from '@acurast/vps'

import {
  buildVpsConfig,
  resolveVpsOptions,
  VPS_IMAGE_NAMES,
  DEFAULT_VPS_IMAGE,
  DEFAULT_VPS_DURATION,
  DEFAULT_VPS_NETWORK,
  type VpsOptions,
} from '../util/buildVpsConfig.js'
import { persistVpsOptionsToEnv } from '../util/persistVpsEnv.js'
import { validateCliConfig } from '../util/validateCliConfig.js'
import { executeDeployFlow } from './deploy.js'
import { CLI_NETWORKS } from '../config.js'
import { parse as parseDuration } from '../util/parse-duration.js'
import { consoleOutput } from '../util/console-output.js'
import { acurastColor } from '../util.js'
import { humanTime } from '../util/humanTime.js'
import { filelogger } from '../util/fileLogger.js'
import * as ora from '../util/ora.js'

const IMAGE_LABELS: Record<string, string> = {
  ubuntu: 'Ubuntu 25.10 (questing)',
}

const SSH_KEY_PREFIX =
  /^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-\S+|sk-(ssh-ed25519|ecdsa-sha2-\S+))\s+\S+/

const validateSshKey = (value: string): true | string =>
  SSH_KEY_PREFIX.test(value.trim())
    ? true
    : 'Expected an SSH public key (e.g. "ssh-ed25519 AAAA... user@host")'

const validateDurationInput = (value: string): true | string => {
  const parsed = parseDuration(value) ?? 0
  return Number.isFinite(parsed) && parsed > 0
    ? true
    : 'Please enter a valid duration (e.g. 1h, 24h, 2d)'
}

const validateByteSizeInput = (value: string): true | string => {
  if (value === '') return true
  try {
    parseByteSize(value)
    return true
  } catch {
    return 'Please enter a valid size (e.g. 2GB, 512MB) or leave empty'
  }
}

const validatePositiveIntInput = (value: string): true | string => {
  if (value === '') return true
  const n = Number(value)
  return Number.isInteger(n) && n > 0
    ? true
    : 'Please enter a positive integer or leave empty'
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Interactively fill in every option that was not provided via flags or
 * `VPS_*` environment variables.
 */
const runVpsWizard = async (opts: VpsOptions): Promise<VpsOptions> => {
  const result = { ...opts }

  if (result.network === undefined) {
    result.network = await select({
      message: 'Which network should the VPS deploy to?',
      choices: CLI_NETWORKS.map((network) => ({ value: network as string })),
      default: DEFAULT_VPS_NETWORK,
    })
  }

  if (result.image === undefined && VPS_IMAGE_NAMES.length > 1) {
    result.image = await select({
      message: 'Which image should the VPS run?',
      choices: VPS_IMAGE_NAMES.map((alias) => ({
        value: alias,
        name: IMAGE_LABELS[alias] ?? alias,
      })),
      default: DEFAULT_VPS_IMAGE,
    })
  }

  if (result.duration === undefined) {
    result.duration = await input({
      message: 'How long should the VPS run? (e.g. 1h, 24h, 2d):',
      default: DEFAULT_VPS_DURATION,
      validate: validateDurationInput,
    })
  }

  if (
    result.minMemory === undefined &&
    result.minStorage === undefined &&
    result.minComputeScore === undefined &&
    result.minCpuMultiScore === undefined
  ) {
    const setRequirements = await confirm({
      message: 'Set minimum hardware requirements for the processor?',
      default: false,
    })
    if (setRequirements) {
      result.minMemory =
        (await input({
          message: 'Minimum total RAM (e.g. 2GB, empty to skip):',
          validate: validateByteSizeInput,
        })) || undefined
      result.minStorage =
        (await input({
          message: 'Minimum available storage (e.g. 10GB, empty to skip):',
          validate: validateByteSizeInput,
        })) || undefined
      result.minComputeScore =
        (await input({
          message: 'Minimum CPU benchmark score (e.g. 100, empty to skip):',
          validate: validatePositiveIntInput,
        })) || undefined
    }
  }

  if (result.authorizedSshKey === undefined) {
    result.authorizedSshKey = await input({
      message:
        'Authorized SSH public key (required, e.g. contents of ~/.ssh/id_ed25519.pub):',
      validate: validateSshKey,
    })
  }

  if (result.callbackUrl === undefined) {
    result.callbackUrl =
      (await input({
        message:
          'Callback URL for tunnel lifecycle events (e.g. from https://webhook.watch, empty to skip):',
        validate: (value) =>
          value === '' || /^https?:\/\/\S+$/.test(value)
            ? true
            : 'Please enter a valid URL or leave empty',
      })) || undefined
  }

  return result
}

/**
 * Poll the precomputed tunnel domain until dropbear answers, then print the
 * SSH connect command. The processor boots the rootfs (image download +
 * apt-get) after the start time, so this can take a while.
 */
const waitForVpsReady = async (
  domain: string,
  sshCommand: string,
  log: (msg: string) => void,
  deadlineMs: number
): Promise<void> => {
  const spinner = ora.default(
    'Waiting for the VPS to boot (image download + setup can take a few minutes)...'
  )
  spinner.start()
  const deadline = Date.now() + deadlineMs

  while (Date.now() < deadline) {
    const result = await probeVpsReady(domain, { timeoutMs: 10_000 })
    if (result.ready) {
      spinner.stop()
      log(`✅ VPS is up (${result.banner ?? 'SSH banner received'})`)
      log('')
      log('Connect with:')
      log(`  ${sshCommand}`)
      log('')
      return
    }
    filelogger.debug(`VPS probe not ready yet: ${result.error}`)
    await sleep(15_000)
  }

  spinner.stop()
  log(
    '⚠️ The VPS did not become reachable in time. It may still be booting — retry the SSH command in a few minutes:'
  )
  log(`  ${sshCommand}`)
  log('')
}

export const addCommandDeployVps = (deployCmd: Command) => {
  deployCmd
    .command('vps')
    .description(
      'Deploy an SSH-able VPS on an Acurast processor, exposed via the Acurast tunnel.'
    )
    .addOption(
      new Option(
        '--image <alias>',
        `VPS image. One of: ${VPS_IMAGE_NAMES.join(', ')}`
      ).choices(VPS_IMAGE_NAMES)
    )
    .addOption(
      new Option('--min-memory <size>', 'Minimum total RAM (e.g. 2GB, 512MiB)')
    )
    .addOption(
      new Option(
        '--min-storage <size>',
        'Minimum available storage capacity (e.g. 10GB)'
      )
    )
    .addOption(
      new Option(
        '--min-compute-score <n>',
        'Minimum CPU single-core benchmark score'
      )
    )
    .addOption(
      new Option(
        '--min-cpu-multi-score <n>',
        'Minimum CPU multi-core benchmark score'
      )
    )
    .addOption(
      new Option(
        '--authorized-ssh-key <key>',
        'SSH public key added to /root/.ssh/authorized_keys on the VPS (required; the VPS is key-auth only)'
      )
    )
    .addOption(
      new Option(
        '--duration <duration>',
        `How long the VPS runs (e.g. 1h, 24h, 2d). Default: ${DEFAULT_VPS_DURATION}`
      )
    )
    .addOption(
      new Option(
        '--callback-url <url>',
        'Webhook that receives tunnel lifecycle events (log/started/error) as JSON'
      )
    )
    .addOption(
      new Option(
        '--http-port <port>',
        'Also serve plain HTTP from this VPS port on the tunnel subdomain (>= 1024)'
      )
    )
    .addOption(
      new Option('--network <network>', 'Target network').choices([
        ...CLI_NETWORKS,
      ])
    )
    .addOption(
      new Option(
        '--max-cost-per-execution <amount>',
        'Maximum reward paid per execution (in the smallest token unit)'
      )
    )
    .addOption(
      new Option(
        '-d, --dry-run',
        'Prepare everything without actually deploying.'
      )
    )
    .addOption(
      new Option(
        '-o, --output <format>',
        'Output a json on each of the steps of the deployment process.'
      )
        .choices(['text', 'json'])
        .default('text')
    )
    .addOption(
      new Option(
        '-ee, --exit-early',
        'Do not wait for the deployment to finish.'
      )
    )
    .addOption(
      new Option(
        '-n, --non-interactive',
        'Do not ask for any input; missing options fall back to VPS_* env vars and defaults.'
      )
    )
    .action(
      async (
        options: VpsOptions & {
          dryRun?: boolean
          output: 'text' | 'json'
          exitEarly?: boolean
          nonInteractive?: boolean
        }
      ) => {
        const log = consoleOutput(options.output)
        const toAcurastColor = (text: string) =>
          options.output === 'json' ? text : acurastColor(text)
        const isInteractive =
          !options.nonInteractive && options.output === 'text'

        // flags > VPS_* env vars > wizard/defaults
        let vpsOptions = resolveVpsOptions(options)
        if (isInteractive) {
          const beforeWizard = { ...vpsOptions }
          vpsOptions = await runVpsWizard(vpsOptions)

          const wizardAnswered = (
            Object.keys(vpsOptions) as (keyof VpsOptions)[]
          ).some(
            (key) =>
              vpsOptions[key] !== undefined && beforeWizard[key] === undefined
          )
          if (wizardAnswered) {
            const save = await confirm({
              message:
                'Save these settings to .env (as VPS_* variables) so future runs skip the questions?',
              default: true,
            })
            if (save) {
              const written = persistVpsOptionsToEnv(vpsOptions)
              log(`Saved to .env: ${written.join(', ')}`)
            }
          }
        }

        let plan
        try {
          plan = buildVpsConfig(vpsOptions)
        } catch (e: any) {
          log(e.message)
          return
        }
        const { envVars, domain, sshCommand } = plan

        const configResult = validateCliConfig(plan.config)
        if (!configResult.success) {
          log('')
          log('⚠️ Generated VPS config is invalid:')
          log('')
          log(configResult.error)
          filelogger.error(
            `VPS config is invalid ${JSON.stringify(configResult.error)}`
          )
          return
        }
        const config = configResult.data

        log('')
        log(`Deploying VPS "${config.projectName}"`)
        log('')
        log(
          `  Image:    ${IMAGE_LABELS[vpsOptions.image ?? DEFAULT_VPS_IMAGE] ?? vpsOptions.image}`
        )
        log(
          `  Duration: ${humanTime(
            config.execution.type === 'onetime'
              ? config.execution.maxExecutionTimeInMs
              : 0,
            true
          )}`
        )
        log(`  Network:  ${config.network}`)
        log(`  Tunnel:   ${toAcurastColor(`https://${domain}`)}`)
        if (config.benchmarkFilters) {
          const activeFilters = Object.fromEntries(
            Object.entries(config.benchmarkFilters).filter(
              ([, value]) => value !== undefined
            )
          )
          if (Object.keys(activeFilters).length > 0) {
            log(`  Requirements: ${JSON.stringify(activeFilters)}`)
          }
        }

        await executeDeployFlow(
          config,
          () => envVars,
          options,
          configResult.notes,
          async ({ jobId }) => {
            log('')
            if (jobId && Array.isArray(jobId) && jobId[0]?.acurast) {
              log(
                `Hub: ${toAcurastColor(
                  `https://hub.acurast.com/job-detail/acurast-${jobId[0].acurast}-${jobToNumber(jobId as any)}`
                )}`
              )
            }
            log('')

            if (options.exitEarly) {
              log('Once the VPS is up, connect with:')
              log(`  ${sshCommand}`)
              log('')
              return
            }

            // Start delay (~3 min) + rootfs download and setup on the device.
            await waitForVpsReady(domain, sshCommand, log, 15 * 60_000)
          }
        )
      }
    )
}
