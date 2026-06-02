import { Command } from 'commander'
import { clearAuth, getLoggedInAddress } from '../util/authStore.js'

export const addCommandLogout = (program: Command) => {
  program
    .command('logout')
    .description('Log out of the Acurast CLI (forget the stored browser-wallet address)')
    .action(async () => {
      const address = getLoggedInAddress()
      if (!address) {
        console.log('You are not logged in.')
        return
      }
      clearAuth()
      console.log(`Logged out (${address}).`)
    })
}
