import { Command, Option } from 'commander'
import { confirm, input, password, select } from '@inquirer/prompts'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

import { parseByteSize, jobToNumber } from '@acurast/sdk/chain'

import {
  buildVpsConfig,
  resolveVpsOptions,
  VPS_IMAGES,
  DEFAULT_VPS_IMAGE,
  DEFAULT_VPS_DURATION,
  type VpsOptions,
} from '../util/buildVpsConfig.js'
import { validateCliConfig } from '../util/validateCliConfig.js'
import { executeDeployFlow } from './deploy.js'
import { CLI_NETWORKS } from '../config.js'
import { parse as parseDuration } from '../util/parse-duration.js'
import { consoleOutput } from '../util/console-output.js'
import { acurastColor } from '../util.js'
import { humanTime } from '../util/humanTime.js'
import { filelogger } from '../util/fileLogger.js'

const IMAGE_LABELS: Record<string, string> = {
  ubuntu24: 'Ubuntu 24.04 LTS (noble)',
  ubuntu25: 'Ubuntu 25.10 (questing)',
}

const SSH_KEY_PREFIX =
  /^(ssh-(rsa|ed25519|dss)|ecdsa-sha2-\S+|sk-(ssh-ed25519|ecdsa-sha2-\S+))\s+\S+/

const validateSshKey = (value: string): true | string =>
  value === '' || SSH_KEY_PREFIX.test(value.trim())
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

/**
 * Interactively fill in every option that was not provided via flags or
 * `VPS_*` environment variables.
 */
const runVpsWizard = async (opts: VpsOptions): Promise<VpsOptions> => {
  const result = { ...opts }

  if (result.image === undefined) {
    result.image = await select({
      message: 'Which image should the VPS run?',
      choices: Object.keys(VPS_IMAGES).map((alias) => ({
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
    result.minComputeScore === undefined
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
    result.authorizedSshKey =
      (await input({
        message: 'Authorized SSH public key (empty to use password only):',
        validate: validateSshKey,
      })) || undefined
  }

  if (result.sshPassword === undefined) {
    result.sshPassword =
      (await password({
        message: `Root password (empty = default "password", not recommended):`,
        mask: '*',
      })) || undefined
  }

  if (result.callbackUrl === undefined) {
    result.callbackUrl =
      (await input({
        message:
          'Callback URL to receive the SSH connect command (e.g. from https://webhook.watch, empty to skip):',
        validate: (value) =>
          value === '' || /^https?:\/\/\S+$/.test(value)
            ? true
            : 'Please enter a valid URL or leave empty',
      })) || undefined
  }

  return result
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
        `VPS image. One of: ${Object.keys(VPS_IMAGES).join(', ')}`
      ).choices(Object.keys(VPS_IMAGES))
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
        '--authorized-ssh-key <key>',
        'SSH public key added to /root/.ssh/authorized_keys on the VPS'
      )
    )
    .addOption(
      new Option(
        '--ssh-password <password>',
        'Root password for the SSH session (default: "password")'
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
        'Webhook that receives the SSH connect command once the tunnel is up (e.g. from https://webhook.watch)'
      )
    )
    .addOption(
      new Option('--network <network>', 'Target network').choices([
        ...CLI_NETWORKS,
      ])
    )
    .addOption(new Option('--replicas <n>', 'Number of VPS instances'))
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
    .addOption(new Option('-u, --only-upload', 'Only upload to IPFS and quit.'))
    .action(
      async (
        options: VpsOptions & {
          dryRun?: boolean
          output: 'text' | 'json'
          exitEarly?: boolean
          nonInteractive?: boolean
          onlyUpload?: boolean
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
          vpsOptions = await runVpsWizard(vpsOptions)
        }

        const templateDir = join(
          dirname(fileURLToPath(import.meta.url)),
          '..',
          'templates',
          'vps',
          'app'
        )

        let config, envVars
        try {
          ;({ config, envVars } = buildVpsConfig(vpsOptions, templateDir))
        } catch (e: any) {
          log(e.message)
          return
        }

        const configResult = validateCliConfig(config)
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
        config = configResult.data

        const usesDefaultPassword = !vpsOptions.sshPassword
        const authMethods = [
          vpsOptions.authorizedSshKey ? 'SSH key' : undefined,
          usesDefaultPassword ? 'password (default: "password")' : 'password',
        ].filter(Boolean)

        log('')
        log(`Deploying VPS "${config.projectName}"`)
        log('')
        log(
          `  Image:    ${IMAGE_LABELS[vpsOptions.image ?? DEFAULT_VPS_IMAGE]}`
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
        log(`  SSH auth: ${authMethods.join(' + ')}`)
        if (config.benchmarkFilters) {
          log(`  Requirements: ${JSON.stringify(config.benchmarkFilters)}`)
        }
        if (usesDefaultPassword && !vpsOptions.authorizedSshKey) {
          log('')
          log(
            '⚠️ Using the default root password "password". Anyone with the tunnel URL can log in — set --ssh-password or --authorized-ssh-key for anything sensitive.'
          )
        }

        await executeDeployFlow(
          config,
          () => envVars,
          options,
          configResult.notes,
          ({ jobId, jobIdString }) => {
            log('')
            if (jobId && Array.isArray(jobId) && jobId[0]?.acurast) {
              log(
                `Hub: ${toAcurastColor(
                  `https://hub.acurast.com/job-detail/acurast-${jobId[0].acurast}-${jobToNumber(jobId as any)}`
                )}`
              )
            }
            if (jobIdString) {
              log(
                `Logs: run ${toAcurastColor(`acurast devtools ${jobIdString}`)} to get a DevTools URL for this deployment.`
              )
            }
            log('')
            if (vpsOptions.callbackUrl) {
              log(
                `Once the tunnel is up, your callback URL will receive a "started" event containing the web URL and the exact SSH connect command:`
              )
              log(`  ${toAcurastColor(vpsOptions.callbackUrl)}`)
            } else {
              log(
                'No callback URL was set — find the SSH connect command in the deployment logs (see DevTools above). It looks like:'
              )
              log(
                `  ssh -o ProxyCommand='openssl s_client -quiet -servername <clientId>.<domain> -connect <clientId>.<domain>:443' root@<clientId>`
              )
            }
            log('')
          }
        )
      }
    )
}
