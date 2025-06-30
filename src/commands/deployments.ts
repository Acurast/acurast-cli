import { Command, Option } from 'commander'
import { AcurastService } from '../acurast/env/acurastService.js'
import { getProjectEnvVars, RPC } from '../config.js'
import fs from 'fs'
import { readFilesInDeployFolder } from '../util/readFilesInDeployFolder.js'
import type { EnvVar, Job } from '../acurast/env/types.js'
import type { AcurastDeployment } from '../types.js'
import { toNumber } from '../util/jobToNumber.js'
import { getWallet } from '../util/getWallet.js'
import * as ora from '../util/ora.js'
import { getBalance } from '../util/getBalance.js'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { setEnvVars } from '../util/setEnvVars.js'
import { ACURAST_DEPLOYMENTS_PATH } from '../constants.js'
import { getAcknowledgedProcessors } from '../acurast/jobAssignments.js'
import { MultiOrigin } from '../types.js'
import { editScript } from '../acurast/editScript.js'
import { transferEditor } from '../acurast/transferEditor.js'

export const addCommandDeployments = (program: Command) => {
  const deploymentsCommand = program
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
    .action(
      async (
        arg: string,
        options: {
          updateEnvVars?: boolean
          cleanup?: boolean
        }
      ) => {
        const acurast = new AcurastService()
        const wallet = await getWallet()
        if (arg === 'ls' || arg === 'list') {
          const spinner = ora.default('Loading deployments...')
          spinner.start()
          const jobs = await acurast.getAllJobs()

          const filteredJobs = jobs
            .filter((job) => job.id[0].acurast === wallet.address)
            .sort((a, b) => b.id[1] - a.id[1])

          spinner.stop()

          if (filteredJobs.length === 0) {
            console.log('No deployments found')
          } else {
            console.log('You have the following deployments:')

            const now = Date.now()

            filteredJobs.forEach((job) => {
              const status =
                job.registration.schedule.startTime > now
                  ? 'planned'
                  : job.registration.schedule.endTime < now
                    ? 'ended'
                    : 'running'
              console.log(`${job.id[1]} - ${status}`)
            })
          }

          await acurast.disconnect()
          return
        }

        const deploymentId = Number(arg)

        if (options.cleanup) {
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

            const wsProvider = new WsProvider(RPC)
            const api = await ApiPromise.create({
              provider: wsProvider,
              noInitWarn: true,
            })

            let balanceBefore = await getBalance(wallet.address, api)

            for (const job of filteredJobs) {
              spinner.start(`Cleaning up deployment ${job.id[1]}...`)
              await acurast.deregisterJob(wallet, job.id[1])
              const balanceNew = await getBalance(wallet.address, api)
              const diff = balanceNew - balanceBefore
              spinner.succeed(
                `Deployment ${job.id[1]} cleaned up${diff > 0 ? `. cACU regained: ${diff}` : ``}`
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
          await acurast.disconnect()
          return
        }

        const deploymentFilename = await readFilesInDeployFolder(
          `${toNumber(arg)}.json`
        )

        let job: (Job & { envVars?: EnvVar[] }) | undefined

        if (deploymentFilename) {
          // File found, we can read details from file

          const deploymentFileData: AcurastDeployment = JSON.parse(
            fs.readFileSync(
              `${ACURAST_DEPLOYMENTS_PATH}/${deploymentFilename}`,
              'utf8'
            )
          )

          const envVars = getProjectEnvVars(deploymentFileData.config)

          job = {
            id: deploymentFileData.deploymentId!,
            registration: deploymentFileData.registration,
            // envInfo: deploymentFileData.envInfo,
            envVars,
          }
        } else {
          console.log('Could not find deployment file.')
          await acurast.disconnect()
          return
          // const jobs = await acurast.getAllJobs()

          // job = jobs.find((job) => job.id[1] === Number(id))
        }

        if (!job) {
          console.log('Deployment not found')
          return
        }

        if (options.updateEnvVars) {
          const spinner = ora.default(
            `Setting environment variables for deployment ${deploymentId}...`
          )
          spinner.start()

          if (!job.envVars) {
            throw new Error('No environment variables found for deployment')
          }

          const { hash } = await setEnvVars(job)

          spinner.succeed(`${job.envVars?.length} environment variables set`)
          spinner.stop()

          console.log('Transaction ID:', hash)

          await acurast.disconnect()

          // If no file found, have user select the deployment config to be used

          // TODO: Introduce a flag in .env to store or not store encryption key.
          // TODO: Setting of .env var flag should be stored in deployment file
        } else {
          if (job.id) {
            console.log('Click here to open the deployment in your browser:')
            console.log(
              `https://hub.acurast.com/job-detail/acurast-${job.id[0].acurast}-${deploymentId}`
            )
          }

          console.log('Deployment:', job)

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

  // Update subcommands
  const updateCommand = deploymentsCommand
    .command('update')
    .description('Update deployment properties')

  // Update script subcommand
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
    .addOption(new Option('--dry-run', 'Preview the update without applying'))
    .addOption(new Option('--force', 'Skip confirmation prompts'))
    .action(
      async (
        deploymentId: string,
        scriptIpfs: string,
        options: { dryRun?: boolean; force?: boolean }
      ) => {
        // Parse deploymentId in format "origin:address:number"
        const deploymentIdParts = deploymentId.split(':')
        if (deploymentIdParts.length !== 3) {
          console.error(
            'Invalid deployment ID format. Expected format: "origin:address:number" (e.g., "Acurast:5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL:123456")'
          )
          return
        }

        const [origin, address, numberStr] = deploymentIdParts
        const deploymentIdNumber = Number(numberStr)

        if (isNaN(deploymentIdNumber)) {
          console.error(
            'Invalid deployment number. Please provide a valid number.'
          )
          return
        }

        // Validate origin
        if (origin !== 'Acurast') {
          console.error(
            'Invalid origin. Currently only "Acurast" is supported.'
          )
          return
        }

        // Validate address format (AccountId32)
        if (!address.match(/^5[a-km-zA-HJ-NP-Z1-9]{47}$/)) {
          console.error(
            'Invalid address format. Please provide a valid AccountId32 address.'
          )
          return
        }

        // Validate IPFS hash format
        if (!scriptIpfs.startsWith('ipfs://')) {
          console.error(
            'Invalid script format. Please provide an IPFS hash starting with "ipfs://"'
          )
          return
        }

        if (options.dryRun) {
          console.log(
            `[DRY RUN] Would update script for deployment [${origin}, ${address}, ${deploymentIdNumber}] with: ${scriptIpfs}`
          )
          return
        }

        const spinner = ora.default(
          `Updating script for deployment [${origin}, ${address}, ${deploymentIdNumber}]...`
        )
        spinner.start()

        try {
          const txHash = await editScript(
            [MultiOrigin.Acurast, address, deploymentIdNumber],
            scriptIpfs
          )
          spinner.succeed(`Script updated successfully`)
          console.log('Transaction ID:', txHash)
        } catch (error) {
          spinner.fail(`Failed to update script: ${error}`)
        }
      }
    )

  // Update editor subcommand
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
      new Option('--dry-run', 'Preview the transfer without executing')
    )
    .addOption(new Option('--force', 'Skip confirmation prompts'))
    .action(
      async (
        deploymentId: string,
        newEditorAddress: string,
        options: { dryRun?: boolean; force?: boolean }
      ) => {
        // Parse deploymentId in format "origin:address:number"
        const deploymentIdParts = deploymentId.split(':')
        if (deploymentIdParts.length !== 3) {
          console.error(
            'Invalid deployment ID format. Expected format: "origin:address:number" (e.g., "Acurast:5CiPPseXPECbkjWCa6MnjNokrgYjMqmKndv2rSnekmSK2DjL:123456")'
          )
          return
        }

        const [origin, address, numberStr] = deploymentIdParts
        const deploymentIdNumber = Number(numberStr)

        if (isNaN(deploymentIdNumber)) {
          console.error(
            'Invalid deployment number. Please provide a valid number.'
          )
          return
        }

        // Validate origin
        if (origin !== 'Acurast') {
          console.error(
            'Invalid origin. Currently only "Acurast" is supported.'
          )
          return
        }

        // Validate address format (AccountId32)
        if (!address.match(/^5[a-km-zA-HJ-NP-Z1-9]{47}$/)) {
          console.error(
            'Invalid address format. Please provide a valid AccountId32 address.'
          )
          return
        }

        // Basic validation for AccountId32 format (starts with 5 and is 48 characters)
        if (!newEditorAddress.match(/^5[a-km-zA-HJ-NP-Z1-9]{47}$/)) {
          console.error(
            'Invalid editor address. Please provide a valid AccountId32 address.'
          )
          return
        }

        if (options.dryRun) {
          console.log(
            `[DRY RUN] Would transfer editor permissions for deployment [${origin}, ${address}, ${deploymentIdNumber}] to: ${newEditorAddress}`
          )
          return
        }

        const spinner = ora.default(
          `Transferring editor permissions for deployment [${origin}, ${address}, ${deploymentIdNumber}]...`
        )
        spinner.start()

        try {
          const txHash = await transferEditor(
            [MultiOrigin.Acurast, address, deploymentIdNumber],
            newEditorAddress
          )
          spinner.succeed(`Editor permissions transferred successfully`)
          console.log('Transaction ID:', txHash)
        } catch (error) {
          spinner.fail(`Failed to transfer editor permissions: ${error}`)
        }
      }
    )
}
