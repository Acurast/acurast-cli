import { Command } from 'commander'
import { clearAuth, getGlobalAuth, getProjectAuth } from '../util/authStore.js'

export const addCommandLogout = (program: Command) => {
  program
    .command('logout')
    .description('Log out of the Acurast CLI (forget the stored browser-wallet address)')
    .option('--project', 'Remove only this project’s pinned login (./.acurast).')
    .option('--all', 'Remove both the project pin and the global login.')
    .action(async (options: { project?: boolean; all?: boolean }) => {
      const project = getProjectAuth()
      const global = getGlobalAuth()

      if (options.all) {
        if (!project && !global) {
          console.log('You are not logged in.')
          return
        }
        if (project) clearAuth('project')
        if (global) clearAuth('global')
        console.log('Logged out of both the project pin and the global login.')
        return
      }

      if (options.project) {
        if (!project) {
          console.log('No project-pinned login to remove.')
          return
        }
        clearAuth('project')
        console.log(`Removed the project pin (${project.address}).`)
        return
      }

      // Default: clear the global login.
      if (!global) {
        console.log(
          project
            ? 'No global login. This project has a pinned login — use `acurast logout --project`.'
            : 'You are not logged in.'
        )
        return
      }
      clearAuth('global')
      console.log(`Logged out (${global.address}).`)
    })
}
