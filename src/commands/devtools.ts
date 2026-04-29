import { Command } from 'commander'
import { getDevtoolsViewKey, buildDevtoolsUrl } from '@acurast/devtools'
import { acurastColor } from '../util.js'
import { getEnv } from '../config.js'
import { filelogger } from '../util/fileLogger.js'

export const addCommandDevtools = (program: Command) => {
  program
    .command('devtools <deployment-id>')
    .description(
      'Request a DevTools view key for a deployment and print the URL.'
    )
    .action(async (deploymentId: string) => {
      const viewKeyResponse = await getDevtoolsViewKey(deploymentId, {
        apiUrl: getEnv('ACURAST_DEVTOOLS_API_URL'),
        mnemonic: getEnv('ACURAST_MNEMONIC'),
        logger: filelogger,
      })

      console.log('')
      console.log(
        `DevTools: ${acurastColor(
          buildDevtoolsUrl(
            getEnv('ACURAST_DEVTOOLS_URL'),
            deploymentId,
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
