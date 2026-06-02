import { Command } from 'commander'
import { getAuth, getSigningMode } from '../util/authStore.js'
import { acurastColor } from '../util.js'

export const addCommandWhoami = (program: Command) => {
  program
    .command('whoami')
    .description('Show the wallet address the CLI is logged in with (if any).')
    .action(async () => {
      const auth = getAuth()
      const mode = getSigningMode()

      if (!auth) {
        console.log(
          'Not logged in. Run `acurast login` to connect a browser wallet, or set ACURAST_MNEMONIC for local signing.'
        )
        console.log(`Signing mode: ${mode}`)
        return
      }

      console.log(acurastColor(`Logged in as ${auth.address}`))
      if (auth.network) console.log(`Network:        ${auth.network}`)
      console.log(`Signature type: ${auth.signatureType}`)
      console.log(`Logged in at:   ${auth.loggedInAt}`)
      if (auth.lastUsedAt) console.log(`Last used at:   ${auth.lastUsedAt}`)
      console.log(`Signing mode:   ${mode}`)
    })
}
