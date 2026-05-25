import { Command, Option } from 'commander'
import fs from 'fs'
import { ApiPromise, WsProvider } from '@polkadot/api'

import {
  AcurastService,
  walletFromMnemonic,
  getBalance,
  setEnvVars,
  getAcknowledgedProcessors,
  editScript,
  transferEditor,
} from '@acurast/sdk/chain'
import type { Job, EnvVar, AcurastDeployment } from '@acurast/sdk/types'
import { MultiOrigin } from '@acurast/sdk/types'

import {
  getEnv,
  getIndexerConfigForNetwork,
  getProjectEnvVars,
  getRpcForNetwork,
  getSymbolForNetwork,
  type CliNetwork,
} from '../config.js'
import { filelogger } from '../util/fileLogger.js'
import * as ora from '../util/ora.js'
import { ACURAST_DEPLOYMENTS_PATH } from '../constants.js'
import { LocalStorage } from '../util/LocalStorage.js'

export const addCommandDeployments = (program: Command) => {
  program
    .command('deployments')
    .description('Manage deployments')
    .argument('[arg]', 'Deployment ID or command (ls/list)')
    .addOption(
      new Option(
        '-e, --update-env-vars',
        'Load the environment variables of a deployment and update them.'
      )
    )
    .addOption(
      new Option(
        '-c, --cleanup',
        'Remove old, finished deployments. This will return any unused funds locked in the deployment back to the user.'
      )
    )
    .addOption(
      new Option(
        '-n, --network <network>',
        'Network to use (mainnet, canary, or devnet)'
      )
        .choices(['mainnet', 'canary', 'devnet'])
        .default('mainnet')
    )
    .action(
      async (
        arg: string,
        options: {
          updateEnvVars?: boolean
          cleanup?: boolean
          network: CliNetwork
        }
      ) => {
        const wallet = await walletFromMnemonic(getEnv('ACURAST_MNEMONIC'), {
          name: 'AcurastCli',
        })

        const readDeploymentFile = (
          deploymentId: number
        ): AcurastDeployment | undefined => {
          try {
            const deploymentFilename = fs
              .readdirSync(ACURAST_DEPLOYMENTS_PATH)
              .find((f) => f.endsWith(`-${deploymentId}.json`))
            if (deploymentFilename) {
              return JSON.parse(
                fs.readFileSync(
                  `${ACURAST_DEPLOYMENTS_PATH}/${deploymentFilename}`,
                  'utf8'
                )
              )
            }
          } catch {
            // Directory may not exist yet
          }
          return undefined
        }

        if (arg === 'ls' || arg === 'list') {
          const spinner = ora.default('Loading deployments...')
          spinner.start()

          const indexerConfig = getIndexerConfigForNetwork(options.network)

          let data: {
            result?: {
              items: {
                data: [{ Acurast: string }, number]
                block_time: string
              }[]
            }
            error?: { message: string }
          }

          try {
            const response = await fetch(indexerConfig.url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'API-Key': indexerConfig.apiKey,
              },
              body: JSON.stringify({
                jsonrpc: '2.0',
                method: 'getEvents',
                params: {
                  pallet: 'Acurast',
                  variant: 'JobRegistrationStoredV2',
                  account_id: wallet.address,
                  sort_order: 'desc',
                },
                id: 1,
              }),
            })

            data = (await response.json()) as typeof data
          } catch (err: any) {
            spinner.stop()
            console.log('Failed to fetch deployments:', err.message)
            return
          }

          spinner.stop()

          if (data.error) {
            console.log('Error fetching deployments:', data.error.message)
            return
          }

          const items = data.result?.items || []

          if (items.length === 0) {
            console.log('No deployments found')
          } else {
            console.log('You have the following deployments:')

            items.forEach((item) => {
              const jobId = item.data[1]
              const blockTime = new Date(item.block_time).toLocaleDateString()
              console.log(`${jobId} (registered ${blockTime})`)
            })
          }

          return
        }

        const deploymentId = Number(arg)

        if (options.cleanup) {
          const network = ((deploymentId &&
            readDeploymentFile(deploymentId)?.config.network) ||
            options.network) as CliNetwork
          const rpcForCleanup = getRpcForNetwork(network)
          filelogger.info(
            `Connecting to ${network} RPC: ${rpcForCleanup}`
          )
          const acurast = new AcurastService(rpcForCleanup)

          if (deploymentId) {
            const spinner = ora.default(
              `Cleaning up deployment ${deploymentId}...`
            )
            spinner.start()

            await acurast.deregisterJob(wallet, deploymentId)

            spinner.stop()
            console.log(`Done`)
          } else {
            const spinner = ora.default(`Cleaning up old deployments...`)
            spinner.start()
            const jobs = await acurast.getAllJobs()

            const now = Date.now()

            const filteredJobs = jobs
              .filter((job) => job.id[0].acurast === wallet.address)
              .filter((job) => job.registration.schedule.endTime < now)
              .sort((a, b) => a.id[1] - b.id[1])

            spinner.stop()
            console.log(`Found ${filteredJobs.length} deployments to clean up`)

            const rpcEndpoint = getRpcForNetwork(network)
            filelogger.info(
              `Connecting to ${network} RPC: ${rpcEndpoint}`
            )
            const wsProvider = new WsProvider(rpcEndpoint)
            const api = await ApiPromise.create({
              provider: wsProvider,
              noInitWarn: true,
            })

            let balanceBefore = await getBalance(api, wallet.address)

            for (const job of filteredJobs) {
              spinner.start(`Cleaning up deployment ${job.id[1]}...`)
              await acurast.deregisterJob(wallet, job.id[1])
              const balanceNew = await getBalance(api, wallet.address)
              const diff = balanceNew - balanceBefore
              const symbol = getSymbolForNetwork(network)
              spinner.succeed(
                `Deployment ${job.id[1]} cleaned up${diff > 0 ? `. ${symbol} regained: ${diff}` : ``}`
              )
              balanceBefore = balanceNew
            }

            await api.disconnect()

            spinner.stop()
          }
          await acurast.disconnect()
          return
        }

        if (!deploymentId || isNaN(deploymentId)) {
          console.log('Please provide a deployment ID')
          return
        }

        const deploymentFileData = readDeploymentFile(deploymentId)

        if (!deploymentFileData) {
          console.log('Could not find deployment file.')
          return
        }

        const network = deploymentFileData.config.network as CliNetwork
        const rpcEndpoint = getRpcForNetwork(network)
        filelogger.info(`Connecting to ${network} RPC: ${rpcEndpoint}`)

        const job: Job & { envVars?: EnvVar[] } = {
          id: deploymentFileData.deploymentId!,
          registration: deploymentFileData.registration,
        }

        if (options.updateEnvVars) {
          const envVars = getProjectEnvVars(deploymentFileData.config)
          job.envVars = envVars

          const spinner = ora.default(
            `Setting environment variables for deployment ${deploymentId}...`
          )
          spinner.start()

          if (!job.envVars || job.envVars.length === 0) {
            throw new Error('No environment variables found for deployment')
          }

          // TODO: drop this precheck once @acurast/sdk setEnvVars exposes
          // maxRetries / abortIfPastStartMs options. Today the SDK recurses
          // every 30s with no bail, so we gate the call here instead.
          const MAX_ATTEMPTS = 20
          const RETRY_MS = 30_000
          const startTime =
            deploymentFileData.registration?.schedule?.startTime
          const abortAtMs =
            startTime && startTime > Date.now()
              ? startTime - 60_000
              : undefined

          const precheckService = new AcurastService(rpcEndpoint)
          await precheckService.connect()
          if (!precheckService.api) {
            throw new Error('API not connected')
          }

          let ready = false
          let lastError: string | undefined
          for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            if (abortAtMs !== undefined && Date.now() >= abortAtMs) {
              lastError = `deployment start time is within 60s (or has passed) — env vars cannot reach processors in time.`
              break
            }
            const assignments = await getAcknowledgedProcessors(
              precheckService.api,
              job.id
            )
            if (
              assignments.some((a) => a.assignment.pubKeys.length > 0)
            ) {
              ready = true
              break
            }
            spinner.text = `Waiting for processor encryption keys (attempt ${attempt}/${MAX_ATTEMPTS})...`
            if (attempt < MAX_ATTEMPTS) {
              await new Promise((r) => setTimeout(r, RETRY_MS))
            } else {
              lastError = `no assigned processor has published encryption keys after ${MAX_ATTEMPTS} attempts.`
            }
          }
          await precheckService.disconnect()

          if (!ready) {
            spinner.fail(`Env vars not set: ${lastError}`)
            throw new Error(`setEnvVars aborted: ${lastError}`)
          }

          const { hash } = await setEnvVars(job, {
            wallet,
            rpcEndpoint,
            keyStore: new LocalStorage(),
          })

          spinner.succeed(`${job.envVars?.length} environment variables set`)

          console.log('Transaction ID:', hash)
        } else {
          if (job.id) {
            console.log('Click here to open the deployment in your browser:')
            console.log(
              `https://hub.acurast.com/job-detail/acurast-${job.id[0].acurast}-${deploymentId}`
            )
          }

          console.log('Deployment:', job)

          const acurast = new AcurastService(rpcEndpoint)
          await acurast.connect()

          if (!acurast.api) {
            throw new Error('API not connected')
          }

          const assignments = await getAcknowledgedProcessors(
            acurast.api,
            job.id
          )

          console.log('Assignments:', JSON.stringify(assignments, null, 2))

          acurast.disconnect()

          return
        }
      }
    )

  const deploymentsCommand = program.commands.find(
    (c) => c.name() === 'deployments'
  )!

  const updateCommand = deploymentsCommand
    .command('update')
    .description('Update deployment properties')

  const parseDeploymentId = (
    deploymentId: string
  ): { origin: 'Acurast'; address: string; number: number } | null => {
    const parts = deploymentId.split(':')
    if (parts.length !== 3) {
      console.error(
        'Invalid deployment ID format. Expected format: "origin:address:number" (e.g., "Acurast:5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL:123456")'
      )
      return null
    }
    const [origin, address, numberStr] = parts
    const number = Number(numberStr)
    if (isNaN(number)) {
      console.error('Invalid deployment number. Please provide a valid number.')
      return null
    }
    if (origin !== 'Acurast') {
      console.error('Invalid origin. Currently only "Acurast" is supported.')
      return null
    }
    if (!address.match(/^5[a-km-zA-HJ-NP-Z1-9]{47}$/)) {
      console.error(
        'Invalid address format. Please provide a valid AccountId32 address.'
      )
      return null
    }
    return { origin, address, number }
  }

  updateCommand
    .command('script')
    .description('Update the script of a mutable deployment')
    .argument(
      '<deployment-id>',
      'The deployment/job ID in format "origin:address:number" (e.g., "Acurast:5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL:123456")'
    )
    .argument(
      '<script-ipfs>',
      'IPFS hash of the new script (e.g., "ipfs://QmNewScriptHash")'
    )
    .addOption(
      new Option(
        '-n, --network <network>',
        'Network to use (mainnet, canary, or devnet)'
      )
        .choices(['mainnet', 'canary', 'devnet'])
        .default('mainnet')
    )
    .addOption(new Option('--dry-run', 'Preview the update without applying'))
    .action(
      async (
        deploymentId: string,
        scriptIpfs: string,
        options: { dryRun?: boolean; network: CliNetwork }
      ) => {
        const parsed = parseDeploymentId(deploymentId)
        if (!parsed) return

        if (!scriptIpfs.startsWith('ipfs://')) {
          console.error(
            'Invalid script format. Please provide an IPFS hash starting with "ipfs://"'
          )
          return
        }

        if (options.dryRun) {
          console.log(
            `[DRY RUN] Would update script for deployment [${parsed.origin}, ${parsed.address}, ${parsed.number}] with: ${scriptIpfs}`
          )
          return
        }

        const wallet = await walletFromMnemonic(getEnv('ACURAST_MNEMONIC'), {
          name: 'AcurastCli',
        })

        const rpcForUpdate = getRpcForNetwork(options.network)
        filelogger.info(`Connecting to ${options.network} RPC: ${rpcForUpdate}`)
        const acurast = new AcurastService(rpcForUpdate)
        const spinner = ora.default(
          `Updating script for deployment [${parsed.origin}, ${parsed.address}, ${parsed.number}]...`
        )
        spinner.start()

        try {
          await acurast.connect()
          if (!acurast.api) {
            throw new Error('API not connected')
          }
          const txHash = await editScript(
            acurast.api,
            wallet,
            [MultiOrigin.Acurast, parsed.address, parsed.number],
            scriptIpfs
          )
          spinner.succeed(`Script updated successfully`)
          console.log('Transaction ID:', txHash)
        } catch (error) {
          spinner.fail(`Failed to update script: ${error}`)
        } finally {
          await acurast.disconnect()
        }
      }
    )

  updateCommand
    .command('editor')
    .description('Transfer editor permissions for a mutable deployment')
    .argument(
      '<deployment-id>',
      'The deployment/job ID in format "origin:address:number" (e.g., "Acurast:5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL:123456")'
    )
    .argument(
      '<new-editor-address>',
      'The AccountId32 address of the new editor'
    )
    .addOption(
      new Option(
        '-n, --network <network>',
        'Network to use (mainnet, canary, or devnet)'
      )
        .choices(['mainnet', 'canary', 'devnet'])
        .default('mainnet')
    )
    .addOption(
      new Option('--dry-run', 'Preview the transfer without executing')
    )
    .action(
      async (
        deploymentId: string,
        newEditorAddress: string,
        options: { dryRun?: boolean; network: CliNetwork }
      ) => {
        const parsed = parseDeploymentId(deploymentId)
        if (!parsed) return

        if (!newEditorAddress.match(/^5[a-km-zA-HJ-NP-Z1-9]{47}$/)) {
          console.error(
            'Invalid editor address. Please provide a valid AccountId32 address.'
          )
          return
        }

        if (options.dryRun) {
          console.log(
            `[DRY RUN] Would transfer editor permissions for deployment [${parsed.origin}, ${parsed.address}, ${parsed.number}] to: ${newEditorAddress}`
          )
          return
        }

        const wallet = await walletFromMnemonic(getEnv('ACURAST_MNEMONIC'), {
          name: 'AcurastCli',
        })

        const rpcForUpdate = getRpcForNetwork(options.network)
        filelogger.info(`Connecting to ${options.network} RPC: ${rpcForUpdate}`)
        const acurast = new AcurastService(rpcForUpdate)
        const spinner = ora.default(
          `Transferring editor permissions for deployment [${parsed.origin}, ${parsed.address}, ${parsed.number}]...`
        )
        spinner.start()

        try {
          await acurast.connect()
          if (!acurast.api) {
            throw new Error('API not connected')
          }
          const txHash = await transferEditor(
            acurast.api,
            wallet,
            [MultiOrigin.Acurast, parsed.address, parsed.number],
            newEditorAddress
          )
          spinner.succeed(`Editor permissions transferred successfully`)
          console.log('Transaction ID:', txHash)
        } catch (error) {
          spinner.fail(`Failed to transfer editor permissions: ${error}`)
        } finally {
          await acurast.disconnect()
        }
      }
    )
}
