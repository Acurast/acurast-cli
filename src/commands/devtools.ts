import { Command } from 'commander'
import { getDevtoolsViewKey, buildDevtoolsUrl } from '../devtools/devtoolsApi.js'
import { acurastColor } from '../util.js'

export const addCommandDevtools = (program: Command) => {
  program
    .command('devtools <deployment-id>')
    .description(
      'Request a DevTools view key for a deployment and print the URL.'
    )
    .action(async (deploymentId: string) => {
      const viewKeyResponse = await getDevtoolsViewKey(deploymentId)

      console.log('')
      console.log(
        `DevTools: ${acurastColor(
          buildDevtoolsUrl(deploymentId, viewKeyResponse.viewKey)
        )}`
      )
      console.log(
        `View key expires at ${new Date(viewKeyResponse.expiresAt).toLocaleString()}`
      )
      console.log('')
    })
}
