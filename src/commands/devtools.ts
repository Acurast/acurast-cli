import { Command } from 'commander'
import { getDevtoolsViewKey, buildDevtoolsUrl } from '@acurast/devtools'
import { acurastColor } from '../util.js'
import { getEnv, CLI_NETWORKS, type CliNetwork } from '../config.js'
import { filelogger } from '../util/fileLogger.js'
import { walletFromMnemonic } from '@acurast/sdk/chain'

export const addCommandDevtools = (program: Command) => {
  program
    .command('devtools <deployment-id>')
    .description(
      'Request a DevTools view key for a deployment and print the URL.'
    )
    .option(
      '-n, --network <network>',
      `Network the deployment lives on (${CLI_NETWORKS.join(' | ')})`,
      'mainnet'
    )
    .action(async (deploymentId: string, options: { network: string }) => {
      const network = options.network as CliNetwork
      if (!CLI_NETWORKS.includes(network)) {
        console.error(
          `Invalid network "${options.network}". Expected one of: ${CLI_NETWORKS.join(', ')}`
        )
        process.exitCode = 1
        return
      }

      // The API verifies the signature against the deployment's owner on
      // chain, so this must be the account that registered it. Deployments are
      // registered with the sr25519 key derived from this mnemonic.
      const wallet = await walletFromMnemonic(getEnv('ACURAST_MNEMONIC'), {
        name: 'AcurastCli',
      })

      const viewKeyResponse = await getDevtoolsViewKey(deploymentId, {
        apiUrl: getEnv('ACURAST_DEVTOOLS_API_URL'),
        signer: wallet,
        network,
        logger: filelogger,
      })

      console.log('')
      console.log(
        `DevTools: ${acurastColor(
          buildDevtoolsUrl(
            getEnv('ACURAST_DEVTOOLS_URL'),
            viewKeyResponse.jobNumber,
            viewKeyResponse.viewKey
          )
        )}`
      )
      console.log(
        `View key expires at ${new Date(viewKeyResponse.expiresAt).toLocaleString()}`
      )
      console.log('')
    })
}
