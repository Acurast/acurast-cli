import { Command } from 'commander'
import {
  getActiveAuth,
  getSigningMode,
  getAuthSource,
  getProjectAuth,
} from '../util/authStore.js'
import { acurastColor } from '../util.js'

const sourceLabel: Record<string, string> = {
  project: 'project pin (./.acurast)',
  global: 'global login (~/.acurast)',
  mnemonic: 'local mnemonic (ACURAST_MNEMONIC)',
  none: 'none',
}

export const addCommandWhoami = (program: Command) => {
  program
    .command('whoami')
    .description('Show the wallet address the CLI is logged in with (if any).')
    .action(async () => {
      const auth = getActiveAuth()
      const mode = getSigningMode()
      const source = getAuthSource()

      if (!auth) {
        console.log(
          'Not logged in. Run `acurast login` to connect a browser wallet, or set ACURAST_MNEMONIC for local signing.'
        )
        console.log(`Signing mode: ${mode}`)
        console.log(`Source:       ${sourceLabel[source]}`)
        return
      }

      console.log(acurastColor(`Logged in as ${auth.address}`))
      if (auth.network) console.log(`Network:        ${auth.network}`)
      console.log(`Signature type: ${auth.signatureType}`)
      console.log(`Logged in at:   ${auth.loggedInAt}`)
      if (auth.lastUsedAt) console.log(`Last used at:   ${auth.lastUsedAt}`)
      console.log(`Signing mode:   ${mode}`)
      console.log(`Source:         ${sourceLabel[source]}`)
      if (getProjectAuth() && getAuthSource() === 'project') {
        console.log('(This project pins its own account; run `acurast logout --project` to unpin.)')
      }
    })
}
