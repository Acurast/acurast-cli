import { Command, Option } from 'commander'
import fs from 'fs'

import { AcurastService, walletFromMnemonic } from '@acurast/sdk/chain'
import type { AcurastDeployment } from '@acurast/sdk/types'

import { getEnv, getRpcForNetwork } from '../config.js'
import { ACURAST_DEPLOYMENTS_PATH } from '../constants.js'
import * as ora from '../util/ora.js'

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

export const addCommandCancel = (program: Command) => {
  program
    .command('cancel')
    .description(
      'Cancel (deregister) a deployment on-chain and return any unused locked funds.'
    )
    .argument('<deployment-id>', 'Numeric local job / deployment ID')
    .addOption(
      new Option('-n, --network <network>', 'Network to use (mainnet or canary)')
        .choices(['mainnet', 'canary'])
        .default('mainnet')
    )
    .action(
      async (
        deploymentIdArg: string,
        options: { network: 'mainnet' | 'canary' }
      ) => {
        const deploymentId = Number(deploymentIdArg)

        if (!deploymentId || isNaN(deploymentId)) {
          console.log('Please provide a valid numeric deployment ID')
          return
        }

        const network =
          readDeploymentFile(deploymentId)?.config.network || options.network

        const wallet = await walletFromMnemonic(getEnv('ACURAST_MNEMONIC'), {
          name: 'AcurastCli',
        })

        const spinner = ora.default(
          `Cancelling deployment ${deploymentId} on ${network}...`
        )
        spinner.start()

        const acurast = new AcurastService(getRpcForNetwork(network))
        try {
          const hash = await acurast.deregisterJob(wallet, deploymentId)
          spinner.succeed('Deployment cancelled')
          console.log('Transaction ID:', hash.toString())
        } catch (error: any) {
          spinner.fail(`Failed to cancel deployment: ${error?.message ?? error}`)
        } finally {
          await acurast.disconnect()
        }
      }
    )
}
